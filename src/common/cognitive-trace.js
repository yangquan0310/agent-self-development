/**
 * Cognitive Trace — v4.2.0
 *
 * 记录 Agent 的每次 tool 调用到 `.agent/cognitive-traces/{runId}.jsonl`。
 * 不侵入业务逻辑，轨迹写入失败静默忽略，不影响主流程。
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { getBaseDir, getCognitiveTracesDir, getSystemStateDir } from './project-context.js';

const TRACE_DIR = getCognitiveTracesDir();

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function sanitizeForJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  try {
    JSON.stringify(obj);
    return obj;
  } catch {
    return '[Circular or non-serializable]';
  }
}

/**
 * 记录一次 tool 调用轨迹
 * @param {string} toolName - 工具名
 * @param {object} input - 输入参数
 * @param {object} output - 输出结果
 * @param {string} runId - 任务ID（默认 'default'）
 */
export function recordTrace(toolName, input, output, runId = 'default') {
  try {
    ensureDir(TRACE_DIR);
    const trace = {
      t: Date.now(),
      tool: toolName,
      input: sanitizeForJson(input),
      output: sanitizeForJson(output)
    };
    const line = JSON.stringify(trace) + '\n';
    const filePath = join(TRACE_DIR, `${runId}.jsonl`);
    appendFileSync(filePath, line);
  } catch {
    // 轨迹写入失败静默忽略，不影响主流程
  }
}

/**
 * 获取最近 N 条轨迹
 * @param {string} runId
 * @param {number} limit
 * @returns {Array}
 */
export function getRecentTraces(runId = 'default', limit = 5) {
  try {
    const filePath = join(TRACE_DIR, `${runId}.jsonl`);
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-limit).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * 获取轨迹统计信息
 * @param {string} runId
 * @returns {object} { count, lastToolCall, elapsedSinceLastCall }
 */
export function getTraceStats(runId = 'default') {
  try {
    const filePath = join(TRACE_DIR, `${runId}.jsonl`);
    if (!existsSync(filePath)) {
      return { count: 0, lastToolCall: null, elapsedSinceLastCall: null };
    }
    const content = readFileSync(filePath, 'utf8').trim();
    if (!content) {
      return { count: 0, lastToolCall: null, elapsedSinceLastCall: null };
    }
    const lines = content.split('\n').filter(Boolean);
    const count = lines.length;
    const lastTrace = JSON.parse(lines[lines.length - 1]);
    const elapsedSinceLastCall = Date.now() - lastTrace.t;
    return {
      count,
      lastToolCall: { tool: lastTrace.tool, t: lastTrace.t },
      elapsedSinceLastCall
    };
  } catch {
    return { count: 0, lastToolCall: null, elapsedSinceLastCall: null };
  }
}

/**
 * 归档指定 runId 的轨迹文件
 * @param {string} runId
 * @returns {boolean}
 */
export function archiveTraces(runId) {
  try {
    const src = join(TRACE_DIR, `${runId}.jsonl`);
    if (!existsSync(src)) return false;
    const archiveDir = join(getSystemStateDir(), 'archive', 'traces');
    ensureDir(archiveDir);
    const dst = join(archiveDir, `${runId}.jsonl`);
    renameSync(src, dst);
    return true;
  } catch {
    return false;
  }
}
