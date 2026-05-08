/**
 * 元认知 —— 面向对象封装
 *
 * 插件职责：在合适的时机将对应的 skill 文档注入 Agent 的 system context
 * Agent 职责：自行阅读 skill、判断偏差、决定是否 revise
 *
 * v4.0.0 变更：
 * - 修复 regulation 注入：从事件文件读取未处理偏差，条件注入 regulation skill
 * - 修复 monitoring 职责：从"偏差检测器"重定义为"偏差预防提醒 + 自我监控指引"
 * - 新增文件上下文提示：从 tasks/{runId}.json 读取历史文件列表注入 planning skill
 * - 移除 Session 复用相关描述，改为文件系统上下文保持
 *
 * Plan 状态机：
 *   draft → pending_approval → active → completed
 *   ├─ draft: Agent 制定并汇报 Plan
 *   ├─ pending_approval: 等待用户确认
 *   └─ active: 用户确认后按 phases 执行
 */

import { promises as fs } from 'fs';
import { generatePlan, assignSessionsToPhases, getNow, getToday } from '../common/utils.js';
import { Stream } from '../common/stream.js';

// v3.5.0: 状态标记正则
const STATUS_PATTERN = /\[STATUS:\s*(\w+)\]/;
const REASON_PATTERN = /\[REASON:\s*([^\]]+)\]/;

export class Metacognition {
  constructor({ api, config, state, skills, logger, log, plan, deviation, attribution }) {
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

    // v3.4.1: 流式输出处理
    this.stream = new Stream();

    // v3.4.1: 按 runId 记录无 task 时的注入次数，防重复疲劳
    this._injectCount = new Map();
  }

  register() {
    if (!this.enabled) {
      this.logger.info('[Meta] 元认知模块已禁用');
      return;
    }

    this.logger.info('[Meta] 注册元认知 Hooks');
    this._registerPlanning();
    this._registerMonitoring();
    this._registerFinalize();
    this._registerCleanup();
  }

  // ── Plan 制定与确认: before_prompt_build ──
  _registerPlanning() {
    if (!this.planningEnabled) return;
    this.api.on('before_prompt_build', this.onBeforePromptBuild.bind(this), { priority: 55 });
  }

  // ── 监控: llm_output ──
  _registerMonitoring() {
    if (!this.monitoringEnabled) return;
    this.api.on('llm_output', this.onLlmOutput.bind(this));
  }

  // ── 决策: before_agent_finalize ──
  _registerFinalize() {
    this.api.on('before_agent_finalize', this.onBeforeAgentFinalize.bind(this));
  }

  // ── 清理: agent_end ──
  _registerCleanup() {
    this.api.on('agent_end', this.onAgentEnd.bind(this));
  }

  /**
   * v3.4.1: 聚合流式输出，获取完整文本
   * 根据事件类型决定是缓冲 chunk 还是直接返回完整输出
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

  // v4.0.0: 根据 task 推断事件文件路径
  _resolveEventFilePath(task) {
    const createdAt = task.createdAt;
    if (!createdAt) return null;
    const date = new Date(createdAt);
    const dateStr = date.toISOString().slice(0, 10);
    // 尝试从 task.eventFilePath 直接获取
    if (task.eventFilePath) {
      return task.eventFilePath;
    }
    // 根据 createdAt 推断：HH-MM-SS.md
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `.openclaw/events/${dateStr}/${hh}-${mm}-${ss}.md`;
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
      const content = await fs.readFile(`.openclaw/tasks/${runId}.json`, 'utf-8');
      const taskIndex = JSON.parse(content);
      return taskIndex.files ? taskIndex.files.map(f => f.path) : [];
    } catch {
      return [];
    }
  }

  /**
   * before_prompt_build 逻辑：
   * 1. 无 task → 注入 planning skill（评估阶段）
   * 2. task=draft → 注入 planning skill（制定阶段）+ 文件上下文提示
   * 3. task=pending_approval → 注入 planning skill（处理用户反馈）
   * 4. task=active → 注入 monitoring（偏差预防）+ 执行上下文 + regulation（条件）+ WM文件上下文（条件）
   * 5. task=revising → 注入 planning skill（修订阶段）+ regulation（条件）
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
        // 首次：注入完整 skill
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

      // 第2+次：仅注入精简提醒
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

    // v4.0.0: 文件上下文提示（从 tasks/{runId}.json 读取）
    const filePaths = await this._getTaskFilePaths(runId);
    const fileContext = filePaths.length > 0
      ? `\n【文件上下文】当前任务已涉及以下文件（从 .openclaw/tasks/${runId}.json 读取）：\n${filePaths.map(p => `- ${p}`).join('\n')}\n如需了解文件详情，请自行读取。\n`
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

    // v4.0.0: 从事件文件读取偏差信息
    const eventFilePath = this._resolveEventFilePath(task);
    const eventData = eventFilePath ? await this._readEventFile(eventFilePath) : null;

    // v4.0.0: monitoring 职责重定义 — 偏差预防提醒 + 自我监控指引
    let monitoringPrefix = '';
    if (this.monitoringEnabled) {
      const monitoringSkill = await this.skills.load('monitoring');
      if (monitoringSkill) {
        monitoringPrefix = `${monitoringSkill}\n\n`;
      }
    }

    // v4.0.0: regulation 条件注入 — 事件文件中有未处理偏差时注入
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
4. 每次写入文件后，更新 .openclaw/tasks/${task.runId}.json（追加新文件路径）
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

    // v4.0.0: revising 状态下如有未处理偏差，同时注入 regulation
    const eventFilePath = this._resolveEventFilePath(task);
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
   * llm_output：
   * 1. 检测 [NEED_PLAN] 标记 → 创建 task → 注入 planning skill
   * 2. task=active → 注入 monitoring skill
   *
   * v3.4.1: 支持流式输出缓冲聚合
   */
  /**
   * llm_output —— v3.5.0：纯观察，禁止返回注入
   * 1. 聚合流式输出到 Stream
   * 2. 保存 output 到 task（如果 task 存在）
   */
  async onLlmOutput(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const resolved = this._resolveOutput(event, runId);

    // 流式 chunk：只缓冲
    if (resolved.type === 'chunk') {
      return null;
    }

    // 流结束或非流式：获取完整输出
    const output = resolved.output || '';

    // 保存 output 到 task（如果 task 存在）
    const task = await this._getTask(runId);
    if (task) {
      task.plan = task.plan || {};
      task.plan.output = output;
      await this._saveTask(task);
    }
  }

  /**
   * before_agent_finalize —— v3.5.0：统一质量检查与状态转换
   * 1. 解析 Agent 输出的 [STATUS: xxx] 标记 → 写入 State
   * 2. 检测 [NEED_PLAN] → 创建 draft task
   * 3. 检测不完整输出 / TODO / 关键步骤缺失
   */
  async onBeforeAgentFinalize(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const output = event.output || '';

    // ── 1. 解析状态标记 ──
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
        this.logger.debug(`[Meta] 状态转换: runId=${runId}, status=${status}, reason=${reason}`);
      }
    }

    // ── 2. 检测 [NEED_PLAN] → 创建 draft task ──
    const needPlan = output.includes('[NEED_PLAN]');
    if (needPlan) {
      const existingTask = await this._getTask(runId);
      if (!existingTask) {
        // 读取之前保存的原始 prompt
        const prompt = ctx.state?.[`prompt:${runId}`] || event.prompt || '';
        const task = await this._createTask(runId, prompt);
        this.logger.debug(`[Meta] 检测到 [NEED_PLAN]，创建 draft task: runId=${runId}`);
        if (this.log) {
          await this.log.write({
            level: 'INFO',
            module: 'Meta',
            runId,
            message: 'Detected [NEED_PLAN], draft task created',
            extra: { taskStatus: 'draft', phaseCount: task.plan.execution.phases.length }
          });
        }
        return {
          action: 'revise',
          reason: '检测到 [NEED_PLAN]，已创建 draft task，需要重新构建 prompt 注入 planning skill',
          retry: {
            instruction: '请根据刚刚注入的 planning skill，继续制定完整的 Plan 并汇报给用户。',
            idempotencyKey: `need-plan:${runId}`,
            maxAttempts: 2
          }
        };
      }
    }

    // ── 3. 质量检查：不完整输出 / TODO ──
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
   * v3.5.0: Gateway 停止时清理资源
   */
  stop() {
    this.logger.info('[Meta] 元认知模块停止，清理资源');
    this._injectCount.clear();
    // Stream 模块如有全局缓冲可在此清理
  }

  async onAgentEnd(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    // v3.4.1: 清理残留流式缓冲
    const remaining = this.stream.peek(runId);
    if (remaining) {
      this.logger.warn(`[Meta] agent_end residual stream buffer: runId=${runId}, len=${remaining.length}`);
      this.stream.purge(runId);
    }

    // v3.4.1: 清理该 runId 的注入计数，防止 Map 无限增长
    this._injectCount.delete(runId);

    // v3.4.1: 不再擅自标记 completed，归档职责归 WorkingMemory
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
  }
}
