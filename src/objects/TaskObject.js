/**
 * TaskObject — v4.3.0
 *
 * task.json 的唯一写入者。
 * 负责任务全生命周期的业务规则、数据校验和状态机管理。
 *
 * 职责边界：
 * - TaskObject = 业务规则 + 生命周期编排
 * - State = 原始 JSON 读写（纯 IO）
 */

import { generatePlan, assignSessionsToPhases, getNow } from '../common/utils.js';
import { getTraceStats, getRecentTraces, archiveTraces } from '../common/cognitive-trace.js';
import { resolveEventFilePath, resolveTaskFilePath } from '../common/project-context.js';
import { promises as fs } from 'fs';

// 有效状态枚举
const VALID_STATUSES = ['draft', 'pending_approval', 'active', 'revising', 'completed'];
const VALID_TASK_TYPES = ['coding', 'research', 'documentation'];

// 状态机：当前状态 → 允许的新状态
const STATE_MACHINE = {
  draft: ['pending_approval', 'completed'],
  pending_approval: ['active', 'revising', 'completed'],
  active: ['revising', 'completed'],
  revising: ['draft'],
  completed: []
};

export class TaskObject {
  constructor(deps) {
    this.state = deps.state;
    this.logger = deps.logger;
    this.log = deps.log;
    this.caseIndex = deps.caseIndex;
    this.events = deps.events; // MemoryArchive（Event 实例），可选
    this.maxArchivedTasks = deps.maxArchivedTasks || 50;
    this.taskSchema = deps.taskSchema || {};
  }

  // ── 创建 ──

  async create(params) {
    const { runId, prompt, taskType, planInput } = params || {};

    // 参数校验
    const validation = this._validateCreateParams(params);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    // 重复检查
    const existing = await this.state.getTask(runId);
    if (existing) {
      return { error: `task 已存在: ${runId}` };
    }

    const normalizedTaskType = VALID_TASK_TYPES.includes(taskType) ? taskType : undefined;
    const now = Date.now();

    let task;
    if (planInput && planInput.phases && planInput.phases.length > 0) {
      task = this._buildTaskFromPlanInput(runId, prompt, normalizedTaskType, planInput, now);
    } else {
      task = this._buildTaskFromTemplate(runId, prompt, normalizedTaskType, now);
    }

    await this.state.saveTask(runId, task);

    this.logger?.info?.(`[TaskObject] create: runId=${runId}, phases=${task.plan.execution.phases.length}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'TaskObject',
        runId,
        message: `create: ${task.plan.execution.phases.length} phases`,
        extra: { status: 'draft', phaseCount: task.plan.execution.phases.length }
      });
    }

    // 相似案例推荐
    let similarCases = [];
    if (this.caseIndex) {
      try {
        const searchGoal = planInput?.goal || prompt || '';
        similarCases = await this.caseIndex.findSimilarCases(searchGoal, 3);
      } catch (err) {
        this.logger?.warn?.(`[TaskObject] 相似案例查询失败: ${err.message}`);
      }
    }

    return { task, similarCases };
  }

  // ── 查询 ──

  async get(runId) {
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }
    const task = await this.state.getTask(runId);
    if (!task) {
      return { task: null };
    }
    return { task };
  }

  // ── 查询关联文件 ──

  async getFiles(runId) {
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    try {
      const content = await fs.readFile(resolveTaskFilePath(runId), 'utf-8');
      const taskIndex = JSON.parse(content);
      const files = taskIndex.files ? taskIndex.files.map(f => ({
        path: f.path,
        type: f.type || 'unknown',
        description: f.description || ''
      })) : [];

      this.logger?.debug?.(`[TaskObject] getFiles: runId=${runId}, files=${files.length}`);
      return { files, count: files.length };
    } catch {
      return { files: [], count: 0, note: '无项目级文件索引' };
    }
  }

  // ── 更新 ──

  async update(params) {
    const { runId, status, reason } = params || {};

    if (!runId || !status) {
      return { error: '缺少 runId 或 status 参数' };
    }

    if (!VALID_STATUSES.includes(status)) {
      return { error: `无效状态: ${status}，有效值: ${VALID_STATUSES.join(', ')}` };
    }

    const task = await this.state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const previousStatus = task.status;

    // 状态机校验
    const allowed = STATE_MACHINE[previousStatus] || [];
    if (!allowed.includes(status)) {
      return { error: `不允许从 ${previousStatus} 转换到 ${status}` };
    }

    task.status = status;
    if (reason) {
      task.revisionReason = reason;
    }
    task.updatedAt = Date.now();

    await this.state.saveTask(runId, task);

    this.logger?.info?.(`[TaskObject] update: runId=${runId}, ${previousStatus} -> ${status}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'TaskObject',
        runId,
        message: `update: ${status}`,
        extra: { status, previousStatus, reason: reason || '' }
      });
    }

    return { task, previousStatus };
  }

  // ── 推进阶段 ──

  async advance(params) {
    const { runId, phaseId } = params || {};

    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await this.state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const phases = task.plan?.execution?.phases || [];
    const currentPhase = task.plan?.execution?.currentPhase ?? 0;

    if (phases.length === 0) {
      return { error: '任务无阶段定义' };
    }

    let nextPhase = currentPhase;

    if (phaseId) {
      const idx = phases.findIndex(p => p.id === phaseId);
      if (idx === -1) {
        return { error: `阶段不存在: ${phaseId}` };
      }
      nextPhase = idx;
      // 标记目标阶段及之前所有阶段为 completed
      for (let i = 0; i <= idx; i++) {
        if (phases[i]) phases[i].status = 'completed';
      }
    } else {
      if (currentPhase < phases.length) {
        phases[currentPhase].status = 'completed';
        nextPhase = currentPhase + 1;
      }
    }

    task.plan.execution.currentPhase = nextPhase;
    task.updatedAt = Date.now();

    const isComplete = nextPhase >= phases.length;
    if (isComplete) {
      task.status = 'completed';
    }

    await this.state.saveTask(runId, task);

    this.logger?.info?.(`[TaskObject] advance: runId=${runId}, ${currentPhase} -> ${nextPhase}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'TaskObject',
        runId,
        message: `advance: ${currentPhase} -> ${nextPhase}`,
        extra: { previousPhase: currentPhase, nextPhase, isComplete }
      });
    }

    return {
      task,
      previousPhase: currentPhase,
      nextPhase,
      isComplete
    };
  }

  // ── 归档 ──

  async archive(runId) {
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await this.state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    if (task.status !== 'completed') {
      return { error: `task 状态不是 completed（当前: ${task.status}），无法归档` };
    }

    // 系统级归档（State adapter）
    const archived = await this.state.archiveTask(runId);
    if (!archived) {
      return { error: '归档失败' };
    }

    const archivedAt = new Date().toISOString();

    // 归档认知轨迹
    const tracesArchived = archiveTraces(runId);
    if (tracesArchived) {
      this.logger?.debug?.(`[TaskObject] archive: 认知轨迹已归档 runId=${runId}`);
    }

    // 写入案例索引
    if (this.caseIndex) {
      try {
        await this.caseIndex.indexTask(task);
      } catch (err) {
        this.logger?.warn?.(`[TaskObject] 案例索引写入失败: ${err.message}`);
      }
    }

    // 触发系统级归档（MemoryArchive）
    if (this.events) {
      try {
        await this.events.archiveTask({
          runId,
          status: task.status,
          deviations: task.deviations || [],
          attributions: task.attributions || [],
          outcome: task.outcome || {},
          archivedAt: Date.now()
        });
      } catch (err) {
        this.logger?.warn?.(`[TaskObject] 项目级归档失败: ${err.message}`);
      }
    }

    this.logger?.info?.(`[TaskObject] archive: runId=${runId}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'TaskObject',
        runId,
        message: 'archive: completed',
        extra: { status: 'completed' }
      });
    }

    return { archived: true, archivedAt };
  }

  // ── 诊断 ──

  async diagnose(runId) {
    const diagnosis = {
      plugin: 'agent-self-development',
      version: '4.3.0',
      timestamp: new Date().toISOString()
    };

    if (runId) {
      const taskResult = await this.get(runId);
      const task = taskResult.task;

      if (task) {
        diagnosis.mode = 'task';
        diagnosis.taskStatus = task.status;
        diagnosis.phase = task.plan?.execution?.currentPhase ?? 0;
        diagnosis.totalPhases = task.plan?.execution?.phases?.length ?? 0;
        diagnosis.deviations = task.deviations?.length ?? 0;
        diagnosis.attributions = task.attributions?.length ?? 0;

        // 认知轨迹摘要
        const traceStats = getTraceStats(runId);
        const recentTraces = getRecentTraces(runId, 5);
        diagnosis.cognitiveTraceSummary = {
          toolCallCount: traceStats.count,
          lastToolCall: traceStats.lastToolCall,
          elapsedSinceLastCall: traceStats.elapsedSinceLastCall,
          recentCalls: recentTraces.map(t => ({ tool: t.tool, t: t.t }))
        };

        // 趋势分析
        const trend = this._buildTrendAnalysis(task, runId);
        diagnosis.trendAnalysis = trend;

        diagnosis.toolsAvailable = [
          'task.create', 'task.update', 'task.advance', 'task.query',
          'task.files', 'task.diagnose', 'task.archive',
          'event.record', 'event.query',
          'guide.planning', 'guide.monitoring', 'guide.regulation', 'guide.development'
        ];
      } else {
        diagnosis.mode = 'task';
        diagnosis.taskStatus = 'none';
        diagnosis.note = '当前会话尚无 task';
        diagnosis.toolsAvailable = ['guide.planning', 'task.diagnose', 'task.create'];
      }
    } else {
      // 全局诊断
      diagnosis.mode = 'global';
      diagnosis.toolsAvailable = [
        'task.create', 'task.update', 'task.advance', 'task.query',
        'task.files', 'task.diagnose', 'task.archive',
        'event.record', 'event.query',
        'guide.planning', 'guide.monitoring', 'guide.regulation', 'guide.development'
      ];
    }

    // 全局统计
    try {
      const tasks = await this.state.listTasks();
      diagnosis.activeTasks = tasks.filter(t => t.status !== 'completed').length;
      diagnosis.completedTasks = tasks.filter(t => t.status === 'completed').length;
    } catch {
      diagnosis.activeTasks = -1;
      diagnosis.completedTasks = -1;
    }

    this.logger?.debug?.(`[TaskObject] diagnose: runId=${runId || 'none'}`);
    return { diagnosis };
  }

  // ── 记录偏差（单一动词方法）──

  async deviate(params) {
    const { runId, type, description, impact } = params || {};

    if (!runId || !type || !description) {
      return { error: '缺少 runId、type 或 description 参数' };
    }

    const task = await this.state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const deviation = {
      id: `dev-${Date.now()}`,
      type,
      description,
      impact: impact || '',
      timestamp: Date.now(),
      attributed: false
    };

    task.deviations = task.deviations || [];
    task.deviations.push(deviation);
    task.updatedAt = Date.now();
    await this.state.saveTask(runId, task);

    this.logger?.info?.(`[TaskObject] deviate: runId=${runId}, type=${type}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'TaskObject',
        runId,
        message: `deviate: ${type}`,
        extra: { deviationId: deviation.id, type }
      });
    }

    return { deviation, success: true };
  }

  // ── 记录归因（单一动词方法）──

  async attribute(params) {
    const { runId, rootCause, strategy, impact } = params || {};

    if (!runId || !rootCause || !strategy) {
      return { error: '缺少 runId、rootCause 或 strategy 参数' };
    }

    const task = await this.state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const attribution = {
      id: `attr-${Date.now()}`,
      rootCause,
      impact: impact || '',
      strategy,
      timestamp: Date.now()
    };

    task.attributions = task.attributions || [];
    task.attributions.push(attribution);

    // 标记相关偏差为已归因
    if (task.deviations) {
      for (const dev of task.deviations) {
        if (!dev.attributed) {
          dev.attributed = true;
          dev.attributionId = attribution.id;
        }
      }
    }

    task.updatedAt = Date.now();
    await this.state.saveTask(runId, task);

    this.logger?.info?.(`[TaskObject] attribute: runId=${runId}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'TaskObject',
        runId,
        message: `attribute: ${attribution.id}`,
        extra: { attributionId: attribution.id }
      });
    }

    return { attribution, success: true };
  }

  // ── 校验 ──

  validate(task) {
    const errors = [];

    if (!task || typeof task !== 'object') {
      return { valid: false, errors: ['task 必须是一个对象'] };
    }

    if (!task.runId || typeof task.runId !== 'string') {
      errors.push('runId 不能为空且必须是字符串');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(task.runId)) {
      errors.push('runId 只能包含字母、数字、下划线和连字符');
    }

    if (!task.status || !VALID_STATUSES.includes(task.status)) {
      errors.push(`status 必须是有效枚举值: ${VALID_STATUSES.join(', ')}`);
    }

    if (!task.createdAt || typeof task.createdAt !== 'number' || task.createdAt <= 0) {
      errors.push('createdAt 必须是正整数时间戳');
    }

    if (!task.updatedAt || typeof task.updatedAt !== 'number' || task.updatedAt < task.createdAt) {
      errors.push('updatedAt 必须是不小于 createdAt 的时间戳');
    }

    if (!task.plan || typeof task.plan !== 'object') {
      errors.push('plan 必须是一个对象');
    } else {
      if (!task.plan.prompt || typeof task.plan.prompt !== 'string') {
        errors.push('plan.prompt 不能为空且必须是字符串');
      }
      if (!task.plan.context || typeof task.plan.context !== 'object') {
        errors.push('plan.context 必须是一个对象');
      }
      if (!task.plan.workspace || typeof task.plan.workspace !== 'object') {
        errors.push('plan.workspace 必须是一个对象');
      }
      if (!task.plan.execution || typeof task.plan.execution !== 'object') {
        errors.push('plan.execution 必须是一个对象');
      } else {
        const phases = task.plan.execution.phases;
        if (!Array.isArray(phases) || phases.length === 0) {
          errors.push('plan.execution.phases 必须是非空数组');
        } else {
          for (let i = 0; i < phases.length; i++) {
            const ph = phases[i];
            if (!ph.id || typeof ph.id !== 'string') {
              errors.push(`phases[${i}].id 不能为空`);
            }
            if (!ph.name || typeof ph.name !== 'string') {
              errors.push(`phases[${i}].name 不能为空`);
            }
            if (!ph.status || !['pending', 'in_progress', 'completed'].includes(ph.status)) {
              errors.push(`phases[${i}].status 必须是 pending/in_progress/completed 之一`);
            }
          }
        }
      }
    }

    // deviations / attributions 可选，若存在则校验结构
    if (task.deviations && Array.isArray(task.deviations)) {
      for (let i = 0; i < task.deviations.length; i++) {
        const d = task.deviations[i];
        if (!d.id) errors.push(`deviations[${i}].id 不能为空`);
        if (!d.type) errors.push(`deviations[${i}].type 不能为空`);
        if (!d.description) errors.push(`deviations[${i}].description 不能为空`);
        if (!d.timestamp) errors.push(`deviations[${i}].timestamp 不能为空`);
      }
    }

    if (task.attributions && Array.isArray(task.attributions)) {
      for (let i = 0; i < task.attributions.length; i++) {
        const a = task.attributions[i];
        if (!a.id) errors.push(`attributions[${i}].id 不能为空`);
        if (!a.rootCause) errors.push(`attributions[${i}].rootCause 不能为空`);
        if (!a.strategy) errors.push(`attributions[${i}].strategy 不能为空`);
        if (!a.timestamp) errors.push(`attributions[${i}].timestamp 不能为空`);
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  // ── 内部辅助 ──

  _validateCreateParams(params) {
    const errors = [];
    if (!params?.runId || typeof params.runId !== 'string') {
      errors.push('runId 不能为空且必须是字符串');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(params.runId)) {
      errors.push('runId 只能包含字母、数字、下划线和连字符');
    }
    if (!params?.prompt || typeof params.prompt !== 'string') {
      errors.push('prompt 不能为空且必须是字符串');
    }
    if (params?.taskType && !VALID_TASK_TYPES.includes(params.taskType)) {
      // 无效 taskType 被忽略（归一化为 undefined），不报错
    }
    return { valid: errors.length === 0, errors };
  }

  _buildTaskFromPlanInput(runId, prompt, taskType, planInput, now) {
    const phases = planInput.phases.map((ph, idx) => ({
      id: ph.id || `p${idx + 1}`,
      name: ph.name || `阶段 ${idx + 1}`,
      goal: ph.goal || '',
      outputs: ph.outputs || [],
      status: ph.status || 'pending',
      tools: ph.tools || [],
      skills: ph.skills || []
    }));

    return {
      runId,
      status: 'draft',
      taskType,
      createdAt: now,
      updatedAt: now,
      plan: {
        prompt: prompt.slice(0, 500),
        createdAt: now,
        context: {
          goal: planInput.goal || '',
          constraints: planInput.constraints || [],
          successCriteria: planInput.successCriteria || []
        },
        workspace: {
          artifacts: [],
          tools: [],
          skills: []
        },
        execution: {
          phases,
          currentPhase: 0
        }
      },
      deviations: [],
      attributions: [],
      outcome: {},
      sessionIds: [],
      tools: [],
      revisionReason: '',
      eventFilePath: ''
    };
  }

  _buildTaskFromTemplate(runId, prompt, taskType, now) {
    const planTemplate = generatePlan(prompt);
    const phases = assignSessionsToPhases(planTemplate.execution.phases, prompt);

    return {
      runId,
      status: 'draft',
      taskType,
      createdAt: now,
      updatedAt: now,
      plan: {
        prompt: prompt.slice(0, 500),
        createdAt: now,
        context: planTemplate.context,
        workspace: planTemplate.workspace,
        execution: {
          phases,
          currentPhase: 0
        }
      },
      deviations: [],
      attributions: [],
      outcome: {},
      sessionIds: [],
      tools: [],
      revisionReason: '',
      eventFilePath: ''
    };
  }

  _buildTrendAnalysis(task, runId) {
    const allTraces = getRecentTraces(runId, 50);
    const taskStartTime = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
    const now = Date.now();

    let phaseStartTime = taskStartTime;
    const advanceTraces = allTraces.filter(t => t.tool === 'task.advance' || t.tool === 'advance_phase');
    if (advanceTraces.length > 0) {
      phaseStartTime = advanceTraces[advanceTraces.length - 1].t;
    }
    const phaseElapsedMs = now - phaseStartTime;

    const deviationTraces = allTraces.filter(t => t.tool === 'event.record' || t.tool === 'record_deviation');
    const taskDurationHours = Math.max((now - taskStartTime) / 3600000, 0.01);
    const deviationRate = deviationTraces.length / taskDurationHours;

    let avgPhaseMs = null;
    if (this.caseIndex) {
      try {
        const searchGoal = task.plan?.context?.goal || task.plan?.prompt || '';
        const similarCases = this.caseIndex.findSimilarCases ?
          this.caseIndex.findSimilarCases(searchGoal, 10) : Promise.resolve([]);
        // Note: caseIndex.findSimilarCases is async; handle synchronously by not awaiting
      } catch {}
    }

    const riskFlags = [];
    if (avgPhaseMs && phaseElapsedMs > avgPhaseMs * 1.5) {
      riskFlags.push(`phase_time_over_avg: 当前阶段耗时超过历史均值 50%`);
    }
    if (deviationRate > 2) {
      riskFlags.push(`high_deviation_rate: 偏差频率 ${deviationRate.toFixed(1)}/小时 高于正常水平`);
    }
    if (task.deviations?.length > 0 && task.deviations.every(d => !d.attributed)) {
      riskFlags.push(`unattributed_deviations: 存在 ${task.deviations.length} 条未归因偏差，建议调用 event.record`);
    }

    return {
      phaseElapsedTime: this._formatDuration(phaseElapsedMs),
      avgPhaseTime: avgPhaseMs ? this._formatDuration(avgPhaseMs) : null,
      deviationRate: `${deviationRate.toFixed(1)}/小时`,
      riskFlags: riskFlags.slice(0, 3)
    };
  }

  _formatDuration(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)}秒`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`;
    return `${Math.round(ms / 3600000 * 10) / 10}小时`;
  }
}
