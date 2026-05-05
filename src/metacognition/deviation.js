/**
 * Deviation — 偏差认知业务
 * 在 monitoring 阶段管理 Deviation 对象的生命周期
 *
 * v3.5.0: 偏差存储在 task:{runId}.deviations（顶层字段，移除了 event 嵌套）
 */

export class Deviation {
  constructor(state) {
    this.state = state;
  }

  async _getTask(runId) {
    return this.state.getTask(runId);
  }

  async _saveTask(task) {
    return this.state.saveTask(task.runId, task);
  }

  /**
   * 创建新的偏差记录
   */
  async createDeviation(runId, phaseId, deviationData) {
    const task = await this._getTask(runId);
    if (!task) throw new Error('Task not found');

    const deviation = {
      deviationId: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      phaseId,
      status: 'detected',
      createdAt: Date.now(),
      ...deviationData
    };

    task.deviations = task.deviations || [];
    task.deviations.push(deviation);
    task.updatedAt = Date.now();

    await this._saveTask(task);
    return deviation;
  }

  /**
   * 代理确认偏差后更新状态
   */
  async acknowledgeDeviation(runId, deviationId, agentAcknowledgment) {
    const task = await this._getTask(runId);
    if (!task || !task.deviations) return null;

    const deviation = task.deviations.find(d => d.deviationId === deviationId);
    if (!deviation) return null;

    deviation.status = 'acknowledged';
    deviation.acknowledgedAt = Date.now();
    deviation.agentAcknowledgment = agentAcknowledgment;
    task.updatedAt = Date.now();

    await this._saveTask(task);
    return deviation;
  }

  /**
   * 偏差已解决
   */
  async resolveDeviation(runId, deviationId, resolution) {
    const task = await this._getTask(runId);
    if (!task || !task.deviations) return null;

    const deviation = task.deviations.find(d => d.deviationId === deviationId);
    if (!deviation) return null;

    deviation.status = 'resolved';
    deviation.resolvedAt = Date.now();
    deviation.resolution = resolution;
    task.updatedAt = Date.now();

    await this._saveTask(task);
    return deviation;
  }

  /**
   * 获取当前 run 的所有偏差
   */
  async listDeviations(runId) {
    const task = await this._getTask(runId);
    return task?.deviations || [];
  }
}
