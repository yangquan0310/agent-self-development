/**
 * Plan — 计划业务
 * 组合 State + Flow，管理 Plan 全生命周期
 *
 * v3.3.0: 适配统一 task JSON，所有 Plan 数据通过 task:{runId}.plan 存取
 */

import { randomUUID } from 'crypto';

export class Plan {
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

  async createPlan(prompt) {
    const runId = randomUUID();
    const task = {
      runId,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plan: {
        prompt,
        status: 'draft',
        context: { goal: '', constraints: [], successCriteria: [] },
        workspace: { sessions: [], artifacts: [], tools: [], skills: [] },
        execution: { phases: [], currentPhase: 0 }
      },
      deviations: [],
      attributions: [],
      sessionIds: [],
      tools: []
    };

    await this._saveTask(task);
    await this.flow.createPlanFlow(task.plan);

    return task;
  }

  async approvePlan(runId) {
    const task = await this._getTask(runId);
    if (!task) throw new Error('Task not found');

    task.status = 'active';
    task.plan.status = 'active';
    task.updatedAt = Date.now();
    await this._saveTask(task);

    const flow = await this.flow.getByRunId(runId);
    if (flow && task.plan.execution.phases[0]) {
      await this.flow.advancePhase(flow.flowId, task.plan.execution.phases[0]);
    }
  }

  async completePhase(runId, phaseIndex) {
    const task = await this._getTask(runId);
    if (!task) throw new Error('Task not found');

    const plan = task.plan;
    plan.execution.phases[phaseIndex].status = 'completed';
    plan.execution.currentPhase = phaseIndex + 1;
    task.updatedAt = Date.now();

    await this._saveTask(task);

    if (plan.execution.currentPhase >= plan.execution.phases.length) {
      task.status = 'completed';
      plan.status = 'completed';
      await this._saveTask(task);
    } else {
      const nextPhase = plan.execution.phases[plan.execution.currentPhase];
      const flow = await this.flow.getByRunId(runId);
      if (flow) {
        await this.flow.advancePhase(flow.flowId, nextPhase);
      }
    }
  }
}
