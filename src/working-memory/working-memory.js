/**
 * 工作记忆 —— 面向对象封装
 *
 * 核心概念：
 * - 会话（Session）= 任务空间：执行特定任务的内存空间
 * - 同一任务族的 Agent 在同一会话中处理任务
 * - Agent 是软件，在任务空间中执行任务
 * - 支持并行：一个 Agent 可同时持有多个任务空间
 *
 * 插件职责：追踪任务空间生命周期，在 agent_end 时更新 task JSON 和全局索引
 * Agent 职责：自行阅读 skill、管理任务空间看板、决定复用/创建/销毁策略
 */

import { getToday, getNow, inferTaskFamily } from '../common/utils.js';

export class WorkingMemory {
  constructor({ api, config, state, skills, logger, log, session, events }) {
    this.api = api;
    this.config = config || {};
    this.state = state;
    this.skills = skills;
    this.logger = logger;
    this.log = log;
    this.session = session;
    this.events = events;
    this.enabled = this.config.enabled !== false;
    this.trackSubagents = this.enabled && this.config.trackSubagents !== false;
    this.autoArchive = this.enabled && this.config.autoArchive !== false;
  }

  /**
   * 注册所有工作记忆相关的 hooks
   */
  register() {
    if (!this.enabled) {
      this.logger.info('[WM] 工作记忆模块已禁用');
      return;
    }

    this.logger.info('[WM] 注册工作记忆 Hooks');
    this._registerSessionTracking();
    this._registerToolResult();
    this._registerArchive();
  }

  // ── 任务空间追踪: before_tool_call ──
  _registerSessionTracking() {
    if (!this.trackSubagents) return;
    this.api.on('before_tool_call', this.onBeforeToolCall.bind(this));
  }

  // ── 工具结果记录: after_tool_call ──
  _registerToolResult() {
    this.api.on('after_tool_call', this.onAfterToolCall.bind(this));
  }

  // ── 归档与状态更新: agent_end ──
  _registerArchive() {
    if (!this.autoArchive) return;
    // priority 40 > Personality 30，确保 WM 先完成 aggregateEvents
    this.api.on('agent_end', this.onAgentEnd.bind(this), { priority: 40 });
  }

  // ── 辅助：获取 task JSON（不自动创建）──
  async _getTask(runId) {
    return this.state.getTask(runId);
  }

  async _saveTask(task) {
    task.updatedAt = getNow();
    await this.state.saveTask(task.runId, task);
  }

  /**
   * 追踪任务空间创建
   */
  async onBeforeToolCall(event, ctx) {
    const toolName = event.toolName;
    const isSpawnTool = toolName === 'sessions_spawn' || toolName === 'agent' || toolName === 'subagent';
    if (!isSpawnTool) return;

    const runId = ctx.runId;
    const sessionId = event.params?.id || event.params?.name || `sub-${Date.now()}`;
    const purpose = event.params?.purpose || event.params?.instruction || '';
    const taskFamily = inferTaskFamily(purpose);

    // 保存 Session 到全局
    await this.state.saveSession(sessionId, {
      sessionId,
      taskFamily,
      role: event.params?.role || '助手',
      task: purpose,
      status: 'active',
      createdAt: getNow(),
      lastActive: getNow()
    });

    // 把 sessionId 关联到当前 task（如果 task 存在）
    const task = await this._getTask(runId);
    if (task && !task.sessionIds.includes(sessionId)) {
      task.sessionIds.push(sessionId);
      await this._saveTask(task);
    }

    // 更新全局活跃任务空间索引
    await this._updateActiveSession(sessionId, taskFamily, 'active');

    this.logger.debug(`[WM] 创建任务空间: ${sessionId} (taskFamily=${taskFamily}, parent=${runId})`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'WM',
        runId,
        message: `Session created: ${sessionId}`,
        extra: { sessionId, taskFamily, role: event.params?.role || '助手', status: 'active' }
      });
    }
  }

  /**
   * 记录工具错误和任务空间完成状态
   */
  async onAfterToolCall(event, ctx) {
    const runId = ctx.runId;
    const result = event.result;
    const toolName = event.toolName;

    const task = await this._getTask(runId);
    if (!task) return;

    const isError = result && (result.error || result.status === 'error');
    if (isError) {
      task.tools.push({
        time: getNow(),
        type: 'tool_error',
        toolName,
        summary: String(result.error || 'unknown error').slice(0, 200)
      });
    }

    const isSpawnTool = toolName === 'sessions_spawn' || toolName === 'agent' || toolName === 'subagent';
    if (isSpawnTool) {
      const sessionId = event.params?.id || event.params?.name;
      const status = isError ? 'killed' : 'completed';

      task.tools.push({
        type: 'subagent_complete',
        sessionId,
        resultSummary: this.summarizeResult(result),
        status,
        timestamp: getNow()
      });

      // 更新 Session 状态
      const session = await this.state.getSession(sessionId);
      if (session) {
        session.status = status;
        session.lastActive = getNow();
        await this.state.saveSession(sessionId, session);
      }

      // 同步更新全局活跃任务空间索引
      const taskFamily = session?.taskFamily;
      if (taskFamily) {
        await this._updateActiveSession(sessionId, taskFamily, status);
      }
    }

    await this._saveTask(task);
    if (isError && this.log) {
      await this.log.write({
        level: 'ERROR',
        module: 'WM',
        runId,
        message: `Tool error: ${toolName}`,
        extra: { toolName, error: String(result.error || 'unknown error').slice(0, 200) }
      });
    }
  }

  /**
   * 归档 completed 任务空间，更新 task JSON 状态
   */
  async onAgentEnd(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const task = await this._getTask(runId);
    if (!task) {
      this.logger.debug(`[WM] runId=${runId} 无 task，跳过归档`);
      return;
    }

    // 遍历本次任务关联的 sessions
    const completedSessions = [];
    const killedSessions = [];
    const pausedSessions = [];

    for (const sessionId of task.sessionIds) {
      const session = await this.state.getSession(sessionId);
      if (!session) continue;

      if (session.status === 'completed') {
        completedSessions.push(session);
        // 回到 idle 状态，供后续同任务族复用
        await this._updateActiveSession(sessionId, session.taskFamily, 'idle');
      } else if (session.status === 'killed') {
        killedSessions.push(session);
        await this._removeActiveSession(sessionId);
      } else if (session.status === 'paused') {
        pausedSessions.push(session);
      }
    }

    // 更新 task.event.outcome
    task.event.outcome = {
      archivedAt: getNow(),
      completedSessions: completedSessions.map(s => s.sessionId),
      killedSessions: killedSessions.map(s => s.sessionId),
      pausedSessions: pausedSessions.map(s => s.sessionId),
      toolCount: task.tools.length
    };
    task.event.status = 'completed';
    task.status = 'completed';
    await this._saveTask(task);

    // 聚合事件到 Memory
    if (this.events) {
      const aggResult = await this.events.aggregateEvents(runId);
      this.logger.debug(`[WM] 事件聚合: runId=${runId}, transferred=${aggResult.transferred}`);
    }

    this.logger.debug(`[WM] 任务归档: runId=${runId}, completed=${completedSessions.length}, killed=${killedSessions.length}`);

    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'WM',
        runId,
        message: 'Task archived',
        extra: {
          completedSessions: completedSessions.length,
          killedSessions: killedSessions.length,
          pausedSessions: pausedSessions.length,
          toolCount: task.tools.length,
          taskStatus: task.status
        }
      });
    }

    // 将 completed task 移至 archive，保留最近 50 个
    const archived = await this.state.archiveTask(runId);
    if (archived) {
      this.logger.debug(`[WM] Task 已归档: runId=${runId} → archive/tasks_archive.json`);
    }

    // 注入 working_memory skill
    const workingMemorySkill = await this.skills.load('working_memory');
    if (workingMemorySkill) {
      return {
        prependSystemContext: `${workingMemorySkill}\n\n【Agent 职责】本次运行已结束。completed 的任务空间已标记为 idle，可供同任务族后续复用。请检查「活跃会话清单」状态。\n`
      };
    }
  }

  /**
   * 更新全局活跃任务空间索引
   */
  async _updateActiveSession(sessionId, taskFamily, status) {
    const activeSessions = await this.state.getSession('working_memory:active_sessions') || [];
    const existingIndex = activeSessions.findIndex(s => s.sessionId === sessionId);

    if (existingIndex >= 0) {
      activeSessions[existingIndex] = {
        ...activeSessions[existingIndex],
        taskFamily,
        status,
        lastActive: getNow()
      };
    } else {
      activeSessions.push({
        sessionId,
        taskFamily,
        status,
        lastActive: getNow()
      });
    }

    await this.state.saveSession('working_memory:active_sessions', activeSessions);
  }

  /**
   * 从全局活跃索引中移除任务空间
   */
  async _removeActiveSession(sessionId) {
    const activeSessions = await this.state.getSession('working_memory:active_sessions') || [];
    const updated = activeSessions.filter(s => s.sessionId !== sessionId);
    await this.state.saveSession('working_memory:active_sessions', updated);
  }

  /**
   * 将工具结果摘要化为短字符串
   */
  summarizeResult(result) {
    if (!result) return '无结果';
    if (typeof result === 'string') return result.slice(0, 200);
    if (result.summary) return result.summary;
    if (result.status) return `status=${result.status}`;
    return JSON.stringify(result).slice(0, 200);
  }
}
