/**
 * 元认知 —— 面向对象封装
 *
 * v4.1.0 变更：
 * - before_prompt_build 改为最小化注入（tool-driven 模式）
 * - 保留 legacy 模式完整 skill 注入（向后兼容）
 * - before_agent_finalize [NEED_PLAN] 不再自动创建 task，只记录日志
 * - before_agent_finalize 新增 tool 调用结果解析（ctx.toolCalls）
 * - [STATUS]/[NEED_PLAN] 标记 deprecated，向后兼容
 *
 * 插件职责：被动响应，不主动代劳
 * Agent 职责：自行调用 tools 获取指导、推进任务
 */

import { promises as fs } from 'fs';
import { generatePlan, assignSessionsToPhases, getNow, getToday } from '../common/utils.js';
import { Stream } from '../common/stream.js';
import { HookRegistry } from '../common/hook.js';
import { resolveEventFilePath, resolveTaskFilePath } from '../common/project-context.js';

// v3.5.0: 状态标记正则
const STATUS_PATTERN = /\[STATUS:\s*(\w+)\]/;
const REASON_PATTERN = /\[REASON:\s*([^\]]+)\]/;

// v4.1.0: 可用 tools 列表（用于最小化注入）
const AVAILABLE_TOOLS = [
  'get_planning_guide',
  'get_monitoring_guide',
  'get_regulation_guide',
  'get_development_guide',
  'get_task_status',
  'get_task_files',
  'self_diagnose',
  'create_plan',
  'update_task_status',
  'advance_phase',
  'record_deviation',
  'record_attribution',
  'archive_task'
];

export class Metacognition {
  constructor({ api, config, state, skills, logger, log, plan, deviation, attribution, injectionMode }) {
    this.api = api;
    this.config = config || {};
    this.state = state;
    this.skills = skills;
    this.logger = logger;
    this.log = log;
    this.plan = plan;
    this.deviation = deviation;
    this.attribution = attribution;
    this.enabled = this.config.enabled !== false;
    this.planningEnabled = this.enabled && this.config.planning !== false;
    this.monitoringEnabled = this.enabled && this.config.monitoring !== false;

    // v4.1.0: 注入模式
    this.injectionMode = injectionMode || 'tool-driven';

    this.stream = new Stream();

    // v4.1.0: Hook 抽象层基类
    this.hookRegistry = new HookRegistry({
      api: this.api,
      logger: this.logger,
      pluginId: 'agent-self-development'
    });

    // v3.4.1: 按 runId 记录无 task 时的注入次数，防重复疲劳
    this._injectCount = new Map();
  }

  register() {
    if (!this.enabled) {
      this.logger.info('[Meta] 元认知模块已禁用');
      return;
    }

    this.logger.info(`[Meta] 注册元认知 Hooks (injectionMode=${this.injectionMode})`);
    this._registerPlanning();
    this._registerMonitoring();
    this._registerFinalize();
    this._registerCleanup();
  }

  // ── Plan 制定与确认: before_prompt_build ──
  _registerPlanning() {
    if (!this.planningEnabled) return;
    this.hookRegistry.register('before_prompt_build', this.onBeforePromptBuild, this, { priority: 55 });
  }

  // ── 监控: llm_output ──
  _registerMonitoring() {
    if (!this.monitoringEnabled) return;
    this.hookRegistry.register('llm_output', this.onLlmOutput, this);
  }

  // ── 决策: before_agent_finalize ──
  _registerFinalize() {
    this.hookRegistry.register('before_agent_finalize', this.onBeforeAgentFinalize, this);
  }

  // ── 清理: agent_end ──
  _registerCleanup() {
    this.hookRegistry.register('agent_end', this.onAgentEnd, this);
  }

  /**
   * v3.4.1: 聚合流式输出，获取完整文本
   */
  _resolveOutput(event, runId) {
    const eventType = this.stream.classify(event);
    const eventKeys = Object.keys(event || {});

    this.logger.debug(`[Meta] llm_output classify: ${eventType}, keys=[${eventKeys.join(', ')}]`);

    switch (eventType) {
      case 'chunk': {
        const text = this.stream.extract(event);
        this.stream.accumulate(runId, text);
        this.logger.debug(`[Meta] stream chunk: runId=${runId}, len=${text.length}, buffered=${this.stream.peek(runId).length}`);
        return { type: 'chunk', output: null };
      }
      case 'end': {
        const flushed = this.stream.drain(runId);
        return { type: 'end', output: flushed };
      }
      case 'full': {
        const output = event.output || event.text || '';
        return { type: 'full', output };
      }
      default: {
        this.logger.warn(`[Meta] llm_output unknown format: keys=[${eventKeys.join(', ')}]`);
        const fallback = event.output || event.text || '';
        return { type: 'unknown', output: fallback };
      }
    }
  }

  async _getTask(runId) {
    return this.state.getTask(runId);
  }

  async _saveTask(task) {
    task.updatedAt = getNow();
    await this.state.saveTask(task.runId, task);
  }

  async _createTask(runId, prompt) {
    const planTemplate = generatePlan(prompt);
    const phases = assignSessionsToPhases(planTemplate.execution.phases, prompt);
    const task = {
      runId,
      status: 'draft',
      createdAt: getNow(),
      updatedAt: getNow(),
      plan: {
        prompt: prompt.slice(0, 500),
        createdAt: Date.now(),
        context: planTemplate.context,
        workspace: planTemplate.workspace,
        execution: {
          phases,
          currentPhase: 0
        }
      },
      deviations: [],
      attributions: [],
      sessionIds: [],
      tools: []
    };
    await this._saveTask(task);
    this.logger.debug(`[Meta] Task 创建[draft]: ${phases.length} 阶段`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'Meta',
        runId,
        message: `Task created[draft]: ${phases.length} phases`,
        extra: { status: 'draft', phaseCount: phases.length }
      });
    }
    return task;
  }

  // v4.0.0: 读取事件文件，提取偏差和归因信息
  async _readEventFile(eventFilePath) {
    try {
      const content = await fs.readFile(eventFilePath, 'utf-8');
      const hasDeviation = content.includes('## 5. 偏差（Deviation）');
      const hasAttribution = content.includes('## 6. 归因（Attribution）');

      let deviationSection = '';
      if (hasDeviation) {
        const match = content.match(/## 5\. 偏差[\s\S]*?(?=## 6\. |## 7\. |$)/);
        if (match) deviationSection = match[0];
      }

      let attributionSection = '';
      if (hasAttribution) {
        const match = content.match(/## 6\. 归因[\s\S]*?(?=## 7\. |$)/);
        if (match) attributionSection = match[0];
      }

      return { content, hasDeviation, hasAttribution, deviationSection, attributionSection };
    } catch {
      return { content: '', hasDeviation: false, hasAttribution: false, deviationSection: '', attributionSection: '' };
    }
  }

  // v4.0.0: 从 tasks/{runId}.json 读取文件列表
  async _getTaskFilePaths(runId) {
    try {
      const content = await fs.readFile(resolveTaskFilePath(runId), 'utf-8');
      const taskIndex = JSON.parse(content);
      return taskIndex.files ? taskIndex.files.map(f => f.path) : [];
    } catch {
      return [];
    }
  }

  // ── v4.1.0: 最小化注入模板（tool-driven 模式）──
  _buildMinimalInjection(task, runId) {
    const status = task ? task.status : 'none';
    const currentPhase = task?.plan?.execution?.currentPhase ?? 0;
    const totalPhases = task?.plan?.execution?.phases?.length ?? 0;

    const phaseInfo = task && totalPhases > 0
      ? `当前阶段：${currentPhase + 1}/${totalPhases}`
      : '';

    let injection = `【Agent Self-Development 插件】\n\n`;
    injection += `当前任务状态：${status}（runId: ${runId}）\n`;
    if (phaseInfo) {
      injection += `${phaseInfo}\n`;
    }
    injection += `\n可用工具：${AVAILABLE_TOOLS.join(', ')}\n`;
    injection += `\n你可以随时调用上述工具获取指导或推进任务。如需了解某个工具的用法，直接调用即可。`;

    // v4.1.0: 标记 deprecated 的提示（仅在非 none 状态时）
    if (status !== 'none') {
      injection += `\n\n（注：[STATUS]/[NEED_PLAN] 标记已废弃，推荐使用 tool 调用。）`;
    }

    this.logger.debug(`[Meta] 最小化注入: runId=${runId}, status=${status}, mode=tool-driven`);
    if (this.log) {
      this.log.write({
        level: 'DEBUG',
        module: 'Meta',
        runId,
        message: 'Minimal injection (tool-driven)',
        extra: { status, phaseInfo, mode: 'tool-driven' }
      }).catch(() => {});
    }

    return { prependSystemContext: injection };
  }

  /**
   * v4.1.0 before_prompt_build：
   * - tool-driven 模式：始终最小化注入（1-3 句）
   * - legacy 模式：保留 v4.0.0 完整 skill 注入（向后兼容）
   */
  async onBeforePromptBuild(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const task = await this._getTask(runId);

    // v3.5.0: 保存用户原始 prompt 供 before_agent_finalize 使用
    if (event.prompt) {
      ctx.state = ctx.state || {};
      ctx.state[`prompt:${runId}`] = event.prompt;
    }

    // v4.1.0: tool-driven 模式 → 最小化注入
    if (this.injectionMode === 'tool-driven') {
      return this._buildMinimalInjection(task, runId);
    }

    // ── legacy 模式：保留 v4.0.0 完整注入逻辑 ──
    return this._legacyBeforePromptBuild(event, ctx, task, runId);
  }

  /**
   * v4.0.0 legacy 注入逻辑（向后兼容）
   */
  async _legacyBeforePromptBuild(event, ctx, task, runId) {
    // ── 阶段一：无 task → 注入 planning skill（评估阶段）──
    if (!task) {
      const planningSkill = await this.skills.load('planning');
      if (!planningSkill) {
        this.logger.error(`[Meta] planning skill 加载失败，无法注入评估指导: runId=${runId}`);
        return {
          prependSystemContext: '⚠️ [系统提示] 核心 planning skill 加载失败。你仍须自行评估任务复杂度：若任务涉及多步骤、多工具或子任务，必须询问用户是否需要制定 Plan，并在确认后输出 [NEED_PLAN] 标记。'
        };
      }

      const count = this._injectCount.get(runId) || 0;
      this._injectCount.set(runId, count + 1);

      if (count === 0) {
        this.logger.debug(`[Meta] 首次注入 planning skill（评估阶段）: runId=${runId}`);
        if (this.log) {
          await this.log.write({
            level: 'DEBUG',
            module: 'Meta',
            runId,
            message: 'Inject planning skill (assessment, full)',
            extra: { injectType: 'full', count: 1, taskStatus: 'none' }
          });
        }
        return {
          prependSystemContext: `${planningSkill}\n\n【当前状态】本次会话尚无 task。你必须根据上方 planning skill 中的"职责 A：任务评估"章节，严格执行任务评估流程，严禁跳过。\n`
        };
      }

      this.logger.debug(`[Meta] 重复提醒（第${count + 1}次）: runId=${runId}`);
      if (this.log) {
        await this.log.write({
          level: 'DEBUG',
          module: 'Meta',
          runId,
          message: `Inject planning skill reminder (#${count + 1})`,
          extra: { injectType: 'reminder', count: count + 1, taskStatus: 'none' }
        });
      }
      return {
        prependSystemContext: `【提醒】本次会话尚无 task（第${count + 1}次提醒）。如果你已评估过任务复杂度，请输出 [NEED_PLAN] 标记创建 Plan；如果任务简单，可直接回答。`
      };
    }

    // ── 阶段二：根据 task.status 注入不同的 skill ──
    const planningSkill = await this.skills.load('planning');
    if (!planningSkill) {
      this.logger.error(`[Meta] planning skill 加载失败，无法注入: runId=${runId}, status=${task.status}`);
      return {
        prependSystemContext: '⚠️ [系统提示] planning skill 加载失败。请根据当前 task 状态自行推进。'
      };
    }

    // v4.0.0: 文件上下文提示
    const filePaths = await this._getTaskFilePaths(runId);
    const fileContext = filePaths.length > 0
      ? `\n【文件上下文】当前任务已涉及以下文件（从 .agent/tasks/${runId}.json 读取）：\n${filePaths.map(p => `- ${p}`).join('\n')}\n如需了解文件详情，请自行读取。\n`
      : '';

    if (task.status === 'draft') {
      return this._buildDraftContext(planningSkill, task.plan, fileContext);
    }

    if (task.status === 'pending_approval') {
      return this._buildPendingApprovalContext(planningSkill, task.plan, fileContext);
    }

    if (task.status === 'active') {
      return await this._buildExecutionContext(task, fileContext);
    }

    if (task.status === 'revising') {
      return await this._buildRevisingContext(task, fileContext);
    }

    return null;
  }

  _buildDraftContext(planningSkill, plan, fileContext = '') {
    const { execution, workspace } = plan;
    const assignedSessions = execution.phases.filter(ph => ph.sessionId).length;

    const draftContext = `
【Plan 状态】draft — 需制定并汇报

【可用上下文】
- 阶段总数：${execution.phases.length}，已分配任务空间：${assignedSessions}
- 当前状态：status = "draft"，currentPhase = 0
- 可用工具：${workspace.tools.join(' / ') || '无'}
${fileContext}
【执行指导】
1. 制定完整 Plan 后向用户汇报，等待确认
2. 如需引用已有文件，在 phases 中标注前置文件路径
3. 汇报完成后，通知插件将 status 更新为 "pending_approval"
`;

    return {
      prependSystemContext: `${planningSkill}\n${draftContext}`
    };
  }

  _buildPendingApprovalContext(planningSkill, plan, fileContext = '') {
    const pendingContext = `
【Plan 待确认 - 处理用户反馈】

当前 Plan 状态：pending_approval（等待用户确认）
${fileContext}
【Agent 职责 - 必做】
1. 读取用户反馈内容
2. 如果用户确认（"确认"、"可以"、"开始执行"等）：
   - 将 task.status 更新为 "active"
   - 开始按 phases 执行
3. 如果用户要求修改：
   - 修改 task.plan.context / task.plan.execution.phases
   - 重新向用户汇报修改后的 Plan
   - 保持 task.status 为 "pending_approval"
4. 如果用户取消任务：
   - 将 task.status 更新为 "completed"
   - 说明取消原因
`;

    return {
      prependSystemContext: `${planningSkill}\n${pendingContext}`
    };
  }

  async _buildExecutionContext(task, fileContext = '') {
    const { execution, workspace } = task.plan;
    const currentPhase = execution.phases[execution.currentPhase];
    const completedCount = execution.phases.filter(ph => ph.status === 'completed').length;

    let phaseInfo = '';
    if (currentPhase) {
      phaseInfo = `当前阶段：${execution.currentPhase + 1}/${execution.phases.length}（ID: ${currentPhase.id}）`;
    } else {
      phaseInfo = '所有阶段已完成';
    }

    const eventFilePath = resolveEventFilePath(task);
    const eventData = eventFilePath ? await this._readEventFile(eventFilePath) : null;

    let monitoringPrefix = '';
    if (this.monitoringEnabled) {
      const monitoringSkill = await this.skills.load('monitoring');
      if (monitoringSkill) {
        monitoringPrefix = `${monitoringSkill}\n\n`;
      }
    }

    let regulationPrefix = '';
    if (eventData && eventData.hasDeviation && !eventData.hasAttribution) {
      const regulationSkill = await this.skills.load('regulation');
      if (regulationSkill) {
        regulationPrefix = `${regulationSkill}\n\n【偏差处理】事件文件中的未处理偏差：\n${eventData.deviationSection}\n\n`;
        this.logger.debug(`[Meta] 注入 regulation skill（未处理偏差）: runId=${task.runId}`);
      }
    }

    const execContext = `
【Plan 状态】active — 按阶段推进

【当前上下文】
- ${phaseInfo}
- 已完成阶段：${completedCount} 个
- 已产出物数量：${workspace.artifacts.length}
${fileContext}
【执行指导】
1. 当前阶段已确认，按目标推进
2. 阶段完成后通知插件：phase.status = "completed"，currentPhase++
3. 产出物追加到 task.plan.workspace.artifacts
4. 每次写入文件后，更新 .agent/tasks/${task.runId}.json（追加新文件路径）
5. 如需调节 Plan，先说明理由并通知插件更新
6. 本轮执行后若发现偏差，请输出 [STATUS: revising] [REASON: xxx]
`;

    return {
      prependSystemContext: `${monitoringPrefix}${regulationPrefix}${execContext}`
    };
  }

  async _buildRevisingContext(task, fileContext = '') {
    const planningSkill = await this.skills.load('planning');
    const revisionReason = task.revisionReason || '用户要求修改';

    const eventFilePath = resolveEventFilePath(task);
    const eventData = eventFilePath ? await this._readEventFile(eventFilePath) : null;
    let regulationPrefix = '';
    if (eventData && eventData.hasDeviation && !eventData.hasAttribution) {
      const regulationSkill = await this.skills.load('regulation');
      if (regulationSkill) {
        regulationPrefix = `${regulationSkill}\n\n【偏差处理】事件文件中的未处理偏差：\n${eventData.deviationSection}\n\n`;
      }
    }

    return {
      prependSystemContext: `${planningSkill}\n${regulationPrefix}\n【Plan 修订】\n当前 Plan：${JSON.stringify(task.plan)}\n修改原因：${revisionReason}\n请重新制定 Plan`
    };
  }

  /**
   * llm_output —— v3.5.0：纯观察，禁止返回注入
   */
  async onLlmOutput(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const resolved = this._resolveOutput(event, runId);

    if (resolved.type === 'chunk') {
      return null;
    }

    const output = resolved.output || '';

    const task = await this._getTask(runId);
    if (task) {
      task.plan = task.plan || {};
      task.plan.output = output;
      await this._saveTask(task);
    }
  }

  /**
   * v4.1.0 before_agent_finalize：
   * 1. 保留 [STATUS] 标记解析（deprecated，向后兼容）
   * 2. [NEED_PLAN] 不再自动创建 task，只记录日志（deprecated）
   * 3. 新增：解析 ctx.toolCalls 中的 tool 调用结果，更新 task 状态
   * 4. 质量检查：不完整输出 / TODO
   */
  async onBeforeAgentFinalize(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const output = event.output || '';

    // ── 1. 解析 [STATUS] 标记（deprecated，向后兼容）──
    const statusMatch = output.match(STATUS_PATTERN);
    const status = statusMatch ? statusMatch[1] : null;

    if (status) {
      const reasonMatch = output.match(REASON_PATTERN);
      const reason = reasonMatch ? reasonMatch[1] : '';

      const task = await this._getTask(runId);
      if (task) {
        task.status = status;
        if (status === 'revising' && reason) {
          task.revisionReason = reason;
        }
        await this._saveTask(task);
        this.logger.debug(`[Meta] [STATUS] 解析（deprecated）: runId=${runId}, status=${status}, reason=${reason}`);
      }
    }

    // ── 2. 解析 ctx.toolCalls（v4.1.0 新增）──
    const toolCalls = ctx.toolCalls || event.toolCalls || [];
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        await this._parseToolCallResult(toolCall, runId);
      }
    }

    // ── 3. 检测 [NEED_PLAN] —— deprecated，不再自动创建 task ──
    const needPlan = output.includes('[NEED_PLAN]');
    if (needPlan) {
      const existingTask = await this._getTask(runId);
      if (!existingTask) {
        this.logger.warn(`[Meta] 检测到 [NEED_PLAN]（deprecated），但不再自动创建 task。请使用 create_plan tool。runId=${runId}`);
        if (this.log) {
          await this.log.write({
            level: 'WARN',
            module: 'Meta',
            runId,
            message: 'Detected [NEED_PLAN] but not auto-creating task (deprecated, use create_plan tool)',
            extra: { deprecated: true, mark: '[NEED_PLAN]' }
          });
        }
        // v4.1.0: 不再自动创建 task，只记录日志
        // 返回 revise 提示 Agent 使用 tool
        return {
          action: 'revise',
          reason: '检测到 [NEED_PLAN]（已废弃）。请使用 create_plan tool 创建 Plan，而不是输出标记。',
          retry: {
            instruction: '请调用 create_plan tool 创建 draft task，而不是输出 [NEED_PLAN] 标记。',
            idempotencyKey: `need-plan-deprecated:${runId}`,
            maxAttempts: 1
          }
        };
      }
    }

    // ── 4. 质量检查：不完整输出 / TODO ──
    const hasIncomplete = /\[INCOMPLETE\]/i.test(output);
    const hasTodo = /TODO:|FIXME:|待完成/i.test(output);
    if (hasIncomplete || hasTodo) {
      this.logger.debug(`[Meta] 检测到不完整标记: runId=${runId}`);
      return {
        action: 'revise',
        reason: `检测到未完成标记（${hasIncomplete ? '[INCOMPLETE]' : 'TODO'}），需要修正`
      };
    }

    return { action: 'finalize' };
  }

  /**
   * v4.2.0: 解析 tool 调用结果，改为只读校验模式
   * Tool Handler 是状态更新的唯一写入者，Hook 层只做一致性校验
   */
  async _parseToolCallResult(toolCall, runId) {
    if (!toolCall || !toolCall.name) return;

    const { name, result } = toolCall;
    const task = await this._getTask(runId);
    if (!task) return;

    this.logger.debug(`[Meta] 校验 tool 调用结果: runId=${runId}, tool=${name}`);

    switch (name) {
      case 'update_task_status': {
        if (result && result.success && result.status) {
          if (task.status !== result.status) {
            this.logger.warn(`[Meta] 状态不一致: tool 返回 ${result.status}, 但 task 当前为 ${task.status}。Tool Handler 应为唯一写入者。`);
          } else {
            this.logger.debug(`[Meta] 状态校验通过: ${task.status}`);
          }
        }
        break;
      }
      case 'advance_phase': {
        if (result && result.success && typeof result.nextPhase === 'number') {
          const expectedPhase = task.plan?.execution?.currentPhase;
          if (expectedPhase !== result.nextPhase) {
            this.logger.warn(`[Meta] 阶段不一致: tool 返回 nextPhase=${result.nextPhase}, 但 task 当前为 ${expectedPhase}。Tool Handler 应为唯一写入者。`);
          } else {
            this.logger.debug(`[Meta] 阶段校验通过: ${expectedPhase}`);
          }
        }
        break;
      }
      case 'create_plan': {
        if (result && result.success && result.task) {
          this.logger.info(`[Meta] tool 解析: create_plan -> draft task created`);
        }
        break;
      }
      case 'record_deviation': {
        if (result && result.success && result.deviation) {
          const hasDeviation = task.deviations?.some(d => d.id === result.deviation.id);
          if (!hasDeviation) {
            this.logger.warn(`[Meta] 偏差未找到: deviationId=${result.deviation.id}。Tool Handler 应为唯一写入者。`);
          } else {
            this.logger.debug(`[Meta] 偏差校验通过: ${result.deviation.id}`);
          }
        }
        break;
      }
      case 'record_attribution': {
        if (result && result.success && result.attribution) {
          const hasAttribution = task.attributions?.some(a => a.id === result.attribution.id);
          if (!hasAttribution) {
            this.logger.warn(`[Meta] 归因未找到: attributionId=${result.attribution.id}。Tool Handler 应为唯一写入者。`);
          } else {
            this.logger.debug(`[Meta] 归因校验通过: ${result.attribution.id}`);
          }
        }
        break;
      }
      case 'archive_task': {
        if (result && result.success) {
          this.logger.info(`[Meta] tool 解析: archive_task -> completed`);
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * v3.5.0: Gateway 停止时清理资源
   */
  stop() {
    this.logger.info('[Meta] 元认知模块停止，清理资源');
    this._injectCount.clear();
    if (this.hookRegistry) {
      this.hookRegistry.stop();
    }
  }

  async onAgentEnd(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const remaining = this.stream.peek(runId);
    if (remaining) {
      this.logger.warn(`[Meta] agent_end residual stream buffer: runId=${runId}, len=${remaining.length}`);
      this.stream.purge(runId);
    }

    this._injectCount.delete(runId);

    const task = await this.state.getTask(runId);
    if (task) {
      this.logger.debug(`[Meta] agent_end: runId=${runId}, task.status=${task.status}, 不修改状态`);
      if (this.log) {
        await this.log.write({
          level: 'INFO',
          module: 'Meta',
          runId,
          message: 'agent_end cleanup finished',
          extra: { taskStatus: task.status, hasRemaining: !!remaining }
        });
      }
    }

    // v4.1.0-M4: flush hook 调用链
    if (this.hookRegistry) {
      this.hookRegistry.flushChain(runId, 'complete');
    }
  }
}
