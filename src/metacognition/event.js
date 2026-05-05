/**
 * Event — 事件业务逻辑
 * v3.5.0: agent_end 时打包 task（含 deviations/attributions）→ Memory EventLog
 *
 * 核心原则：Plugin asks, Agent decides, Plugin records
 */

export class Event {
  constructor(state, memory) {
    this.state = state;
    this.memory = memory;
  }

  /**
   * v3.5.0: 归档 task 到 Memory EventLog
   * 打包 deviations/attributions/outcome → 持久化
   */
  async archiveTask(task) {
    if (!task) {
      return { archived: false, reason: 'no task' };
    }

    const date = new Date().toISOString().slice(0, 10);
    const eventLog = {
      runId: task.runId,
      status: task.status,
      deviations: task.deviations || [],
      attributions: task.attributions || [],
      outcome: task.outcome || {},
      plan: {
        prompt: task.plan?.prompt,
        phaseCount: task.plan?.execution?.phases?.length || 0
      },
      archivedAt: Date.now()
    };

    await this.memory.appendEventLog(date, eventLog);

    return { archived: true, date, runId: task.runId };
  }

  /**
   * 查询某日的 EventLog
   */
  async queryEventLog(date) {
    return this.memory.getEventLog(date);
  }
}
