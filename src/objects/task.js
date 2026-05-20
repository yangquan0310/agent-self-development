/**
 * Task Objects — v4.3.0
 *
 * 5 个扁平化 Task Handler，直接读写 .agentstasks/。
 * 函数签名: (params, context) => result | { error }
 * 不抛出异常，错误通过 { error } 返回。
 */

import { taskPath, archiveTaskPath } from '../utils/resolve.js';
import { readJson, writeJson, fileExists, moveFile } from '../utils/io.js';
import { validateRunId, validateStatus, isValidStatusTransition } from '../utils/validate.js';
import { getNow, generateRunId, generatePlan } from '../utils/helpers.js';

// ── create ──

export async function create(params, context) {
  if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
    return { error: 'prompt 不能为空' };
  }

  let runId;
  try {
    runId = params.runId || generateRunId();
    validateRunId(runId);
  } catch (e) {
    return { error: e.message };
  }

  const tp = taskPath(context.baseDir, runId);
  if (await fileExists(tp)) {
    return { error: `任务已存在: ${runId}` };
  }

  const now = getNow();
  const plan = generatePlan(params.prompt);

  if (params.planInput) {
    if (params.planInput.goal !== undefined) plan.context.goal = params.planInput.goal;
    if (params.planInput.constraints !== undefined) plan.context.constraints = params.planInput.constraints;
    if (params.planInput.successCriteria !== undefined) plan.context.successCriteria = params.planInput.successCriteria;
    if (params.planInput.phases !== undefined) {
      plan.execution.phases = params.planInput.phases.map((ph, i) => ({
        id: ph.id || `p${i + 1}`,
        name: ph.name || `阶段 ${i + 1}`,
        goal: ph.goal || '',
        outputs: ph.outputs || [],
        status: ph.status || 'pending',
        tools: [],
        skills: []
      }));
    }
  }

  const task = {
    runId,
    status: 'draft',
    taskType: params.taskType || 'task',
    createdAt: now,
    updatedAt: now,
    plan: {
      prompt: params.prompt,
      createdAt: now,
      context: plan.context,
      workspace: plan.workspace,
      execution: plan.execution
    },
    deviations: [],
    attributions: [],
    outcome: {},
    eventFilePath: ''
  };

  await writeJson(tp, task);
  return { runId, status: task.status, createdAt: now };
}

// ── update ──

export async function update(params, context) {
  let runId;
  try {
    runId = params.runId;
    validateRunId(runId);
  } catch (e) {
    return { error: e.message };
  }

  const tp = taskPath(context.baseDir, runId);
  if (!(await fileExists(tp))) {
    return { error: `任务不存在: ${runId}` };
  }

  const task = await readJson(tp);
  const now = getNow();
  let changed = false;

  if (params.status !== undefined) {
    try {
      validateStatus(params.status);
    } catch (e) {
      return { error: e.message };
    }
    if (!isValidStatusTransition(task.status, params.status)) {
      return { error: `无效状态转换: ${task.status} → ${params.status}` };
    }
    task.status = params.status;
    changed = true;
  }

  if (params.deviation) {
    task.deviations.push({
      type: params.deviation.type,
      description: params.deviation.description,
      impact: params.deviation.impact || '',
      timestamp: params.deviation.timestamp || now
    });
    changed = true;
  }

  if (params.attribution) {
    task.attributions.push({
      rootCause: params.attribution.rootCause,
      strategy: params.attribution.strategy,
      impact: params.attribution.impact || '',
      timestamp: params.attribution.timestamp || now
    });
    changed = true;
  }

  if (params.outcome) {
    task.outcome = { ...task.outcome, ...params.outcome };
    changed = true;
  }

  if (params.eventFilePath !== undefined) {
    task.eventFilePath = params.eventFilePath;
    changed = true;
  }

  if (changed) {
    task.updatedAt = now;
    await writeJson(tp, task);
  }

  return { runId, status: task.status, updatedAt: task.updatedAt, changed };
}

// ── advance ──

export async function advance(params, context) {
  let runId;
  try {
    runId = params.runId;
    validateRunId(runId);
  } catch (e) {
    return { error: e.message };
  }

  const tp = taskPath(context.baseDir, runId);
  if (!(await fileExists(tp))) {
    return { error: `任务不存在: ${runId}` };
  }

  const task = await readJson(tp);
  const phases = task.plan?.execution?.phases || [];
  const current = task.plan?.execution?.currentPhase ?? 0;

  let nextIndex;
  if (params.phaseId) {
    nextIndex = phases.findIndex(p => p.id === params.phaseId);
    if (nextIndex === -1) {
      return { error: `阶段不存在: ${params.phaseId}` };
    }
  } else {
    nextIndex = current + 1;
    if (nextIndex >= phases.length) {
      return { error: '已是最后一个阶段' };
    }
  }

  if (phases[current]) {
    phases[current].status = 'completed';
  }
  if (phases[nextIndex]) {
    phases[nextIndex].status = 'in_progress';
  }

  task.plan.execution.currentPhase = nextIndex;
  task.updatedAt = getNow();

  await writeJson(tp, task);
  return { runId, currentPhase: nextIndex, phaseId: phases[nextIndex]?.id };
}

// ── get ──

export async function get(params, context) {
  let runId;
  try {
    runId = params.runId;
    validateRunId(runId);
  } catch (e) {
    return { error: e.message };
  }

  const tp = taskPath(context.baseDir, runId);
  if (await fileExists(tp)) {
    return await readJson(tp);
  }

  const ap = archiveTaskPath(context.baseDir, runId);
  if (await fileExists(ap)) {
    return await readJson(ap);
  }

  return { error: `任务不存在: ${runId}` };
}

// ── archive ──

export async function archive(params, context) {
  let runId;
  try {
    runId = params.runId;
    validateRunId(runId);
  } catch (e) {
    return { error: e.message };
  }

  const tp = taskPath(context.baseDir, runId);
  if (!(await fileExists(tp))) {
    return { error: `任务不存在: ${runId}` };
  }

  const task = await readJson(tp);
  if (task.status !== 'completed') {
    return { error: `只能归档 completed 状态的任务，当前: ${task.status}` };
  }

  task.status = 'archived';
  task.updatedAt = getNow();
  task.archivedAt = getNow();

  const ap = archiveTaskPath(context.baseDir, runId);
  await writeJson(tp, task);
  await moveFile(tp, ap);
  return { runId, status: task.status, archivedAt: task.archivedAt, archivePath: ap };
}
