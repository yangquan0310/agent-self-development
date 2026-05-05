/**
 * Heartbeat — 系统层状态聚合
 *
 * v3.5.0: 后台监控模块，仅在 Heartbeat 回合运行。
 * 职责：聚合当前系统状态（活跃任务、会话、事件），为 Agent 提供后台上下文。
 *
 * 官方钩子：heartbeat_prompt_contribution —— 返回 prependContext / appendContext
 */

export class Heartbeat {
  constructor({ api, config, state, memory, logger, log }) {
    this.api = api;
    this.config = config || {};
    this.state = state;
    this.memory = memory;
    this.logger = logger;
    this.log = log;
    this.enabled = this.config.enabled !== false;
  }

  register() {
    if (!this.enabled) {
      this.logger.info('[Heartbeat] 心跳模块已禁用');
      return;
    }

    this.logger.info('[Heartbeat] 注册心跳 Hook');
    this.api.on('heartbeat_prompt_contribution', this.onHeartbeatPromptContribution.bind(this));
  }

  /**
   * heartbeat_prompt_contribution —— 仅 Heartbeat 回合运行
   * 聚合系统状态并返回上下文
   */
  async onHeartbeatPromptContribution(event, ctx) {
    const stats = await this._aggregateStats();

    const context = `
【系统心跳】后台状态摘要

- 活跃任务：${stats.activeTasks} 个
- 待确认任务：${stats.pendingTasks} 个
- 草稿任务：${stats.draftTasks} 个
- 修订中任务：${stats.revisingTasks} 个
- 活跃会话：${stats.activeSessions} 个
- idle 会话：${stats.idleSessions} 个
- 今日事件：${stats.todayEvents} 条

【Agent 职责】如有后台维护任务或状态异常，请在此 Heartbeat 回合中处理。
`;

    this.logger.debug(`[Heartbeat] 状态摘要: active=${stats.activeTasks}, sessions=${stats.activeSessions}`);
    if (this.log) {
      await this.log.write({
        level: 'DEBUG',
        module: 'Heartbeat',
        message: 'Heartbeat prompt contribution',
        extra: stats
      });
    }

    return {
      prependContext: context
    };
  }

  /**
   * 聚合系统状态统计
   */
  async _aggregateStats() {
    let tasks = [];
    let sessions = [];
    let todayEvents = 0;

    try {
      tasks = await this.state.listTasks();
    } catch {
      // state adapter 可能不支持 listTasks
    }

    try {
      sessions = await this.state.listSessions();
    } catch {
      // state adapter 可能不支持 listSessions
    }

    try {
      const date = new Date().toISOString().slice(0, 10);
      const eventLog = await this.memory.getEventLog(date);
      todayEvents = Array.isArray(eventLog) ? eventLog.length : 0;
    } catch {
      // memory adapter 可能不支持 getEventLog
    }

    return {
      activeTasks: tasks.filter(t => t.status === 'active').length,
      pendingTasks: tasks.filter(t => t.status === 'pending_approval').length,
      draftTasks: tasks.filter(t => t.status === 'draft').length,
      revisingTasks: tasks.filter(t => t.status === 'revising').length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      idleSessions: sessions.filter(s => s.status === 'idle').length,
      todayEvents
    };
  }

  /**
   * v3.5.0: Gateway 停止时清理资源
   */
  stop() {
    this.logger.info('[Heartbeat] 心跳模块停止');
  }
}
