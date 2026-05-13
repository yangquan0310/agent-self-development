/**
 * Project Context — v4.2.0
 *
 * 集中管理项目级和系统级路径解析与常量。
 * 解决 RISK-2（路径解析代码重复）和 RISK-8（项目级文件路径未集中抽象）。
 *
 * 设计原则：
 * - 系统级路径（~/.agent/*）与项目级路径（{projectRoot}/.agent/*）分开管理
 * - 所有路径模板变更只需修改此文件
 * - 环境变量 OPENCLAW_AGENT_DIR 唯一覆盖入口
 */

import { join } from 'path';
import { homedir } from 'os';

// ── 系统级路径 ──

/**
 * 解析系统级基础目录
 * @returns {string} 基础目录绝对路径
 */
export function getBaseDir() {
  return process.env.OPENCLAW_AGENT_DIR || join(homedir(), '.agent');
}

/**
 * 解析系统级 state 目录
 * @returns {string}
 */
export function getSystemStateDir() {
  return join(getBaseDir(), 'state', 'agent-self-development');
}

/**
 * 解析系统级日志目录
 * @returns {string}
 */
export function getSystemLogsDir() {
  return join(getBaseDir(), 'logs');
}

/**
 * 解析系统级 memory 目录
 * @returns {string}
 */
export function getSystemMemoryDir() {
  return join(getBaseDir(), 'memory');
}

/**
 * 解析系统级 flows 目录
 * @returns {string}
 */
export function getSystemFlowsDir() {
  return join(getBaseDir(), 'flows');
}

/**
 * 解析认知轨迹存储目录
 * @returns {string}
 */
export function getCognitiveTracesDir() {
  return join(getBaseDir(), 'cognitive-traces');
}

// ── 项目级路径 ──

/**
 * 解析项目级 task 文件路径（相对于 projectRoot）
 * @param {string} runId
 * @returns {string}
 */
export function resolveTaskFilePath(runId) {
  return `.agent/tasks/${runId}.json`;
}

/**
 * 根据 task.createdAt 解析事件文件路径（相对于 projectRoot）
 * @param {object} task
 * @returns {string|null}
 */
export function resolveEventFilePath(task) {
  const createdAt = task?.createdAt;
  if (!createdAt) return null;
  if (task.eventFilePath) {
    return task.eventFilePath;
  }
  const date = new Date(createdAt);
  const dateStr = date.toISOString().slice(0, 10);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return resolveEventFilePathFromComponents(dateStr, hh, mm, ss);
}

/**
 * 根据日期组件解析事件文件路径（相对于 projectRoot）
 * @param {string} dateStr — YYYY-MM-DD
 * @param {string} hh
 * @param {string} mm
 * @param {string} ss
 * @returns {string}
 */
export function resolveEventFilePathFromComponents(dateStr, hh, mm, ss) {
  return `.agent/events/${dateStr}/${hh}-${mm}-${ss}.md`;
}

/**
 * 解析项目级 agent 目录下的任意子路径
 * @param {string} projectRoot
 * @param {string} subPath
 * @returns {string}
 */
export function resolveProjectAgentPath(projectRoot, subPath) {
  return join(projectRoot, '.agent', subPath);
}
