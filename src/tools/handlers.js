/**
 * Tool Handlers — v4.3.0
 *
 * tools 层中间适配层。调用 objects 层裸函数，
 * 将 { error } 转换为 adaptError，正常结果转换为 adaptReturn。
 */

import * as task from '../objects/task.js';
import * as event from '../objects/event.js';
import { adaptReturn, adaptError } from './return-adapter.js';

function wrap(result) {
  return result && result.error ? adaptError(result.error) : adaptReturn(result);
}

// ── task handlers ──

export async function create(params, context) {
  const result = await task.create(params, context);
  return wrap(result);
}

export async function update(params, context) {
  const result = await task.update(params, context);
  return wrap(result);
}

export async function advance(params, context) {
  const result = await task.advance(params, context);
  return wrap(result);
}

export async function get(params, context) {
  const result = await task.get(params, context);
  return wrap(result);
}

export async function archive(params, context) {
  const result = await task.archive(params, context);
  return wrap(result);
}

// ── event handlers ──

export async function report(params, context) {
  const result = await event.report(params, context);
  if (result.error) {
    return adaptError(result.error);
  }

  // 关联 eventFilePath 到 task
  const updateResult = await task.update(
    { runId: params.runId, eventFilePath: result.eventFilePath },
    context
  );
  if (updateResult.error) {
    return adaptError(updateResult.error);
  }

  return adaptReturn({
    ...result,
    reflectionPrompt: '事件报告已生成。建议回顾本次任务的偏差与归因，查询 event.query({ runId }) 获取完整事件记录，并考虑是否需要更新人格文件（SOUL.md / IDENTITY.md / skills/README.md / MEMORY.md）。'
  });
}

export async function query(params, context) {
  const result = await event.query(params, context);
  return wrap(result);
}

export async function archiveEvent(params, context) {
  const result = await event.archive(params, context);
  return wrap(result);
}
