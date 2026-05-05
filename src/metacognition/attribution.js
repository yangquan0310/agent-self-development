/**
 * Attribution — 归因调节业务
 * 在 regulation 阶段管理 Attribution 对象的生命周期
 *
 * v3.3.0: 适配统一 task JSON，归因存储在 task:{runId}.event.attributions
 */

export class Attribution {
  constructor(state, flow) {
    this.state = state;
    this.flow = flow;
  }

  async _getTask(runId) {
    return this.state.getTask(runId);
  }

  async _saveTask(task) {
    return this.state.saveTask(task.runId, task);
  }

  /**
   * 创建归因分析
   */
  async analyzeAttribution(runId, deviationId, attributionData) {
    const task = await this._getTask(runId);
    if (!task) throw new Error('Task not found');

    const attribution = {
      attributionId: `attr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      deviationId,
      status: 'analyzing',
      createdAt: Date.now(),
      ...attributionData
    };

    task.event = task.event || { deviations: [], attributions: [], planRevisions: [], outcome: {} };
    task.event.attributions = task.event.attributions || [];
    task.event.attributions.push(attribution);
    task.updatedAt = Date.now();

    await this._saveTask(task);
    return attribution;
  }

  /**
   * 完成归因分析
   */
  async completeAttribution(runId, attributionId, rootCause, adjustmentPlan) {
    const task = await this._getTask(runId);
    if (!task || !task.event || !task.event.attributions) return null;

    const attribution = task.event.attributions.find(a => a.attributionId === attributionId);
    if (!attribution) return null;

    attribution.status = 'completed';
    attribution.completedAt = Date.now();
    attribution.rootCause = rootCause;
    attribution.adjustmentPlan = adjustmentPlan;
    task.updatedAt = Date.now();

    await this._saveTask(task);
    return attribution;
  }

  /**
   * 执行调节方案
   */
  async applyAdjustment(runId, attributionId, executionResult) {
    const task = await this._getTask(runId);
    if (!task || !task.event || !task.event.attributions) return null;

    const attribution = task.event.attributions.find(a => a.attributionId === attributionId);
    if (!attribution) return null;

    attribution.status = 'executed';
    attribution.executedAt = Date.now();
    attribution.executionResult = executionResult;
    task.updatedAt = Date.now();

    await this._saveTask(task);
    return attribution;
  }
}
