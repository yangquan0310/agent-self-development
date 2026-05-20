/**
 * Resolve — v4.3.0
 *
 * 项目级路径解析。所有路径基于 baseDir 生成绝对路径。
 */

import { join } from 'path';

export function taskPath(baseDir, runId) {
  return join(baseDir, ''.agents', 'tasks', `${runId}.json`);
}

export function archiveTaskPath(baseDir, runId) {
  return join(baseDir, ''.agents', 'tasks', 'archive', `${runId}.json`);
}

export function eventPath(baseDir, runId, date) {
  return join(baseDir, ''.agents', 'events', date, `${runId}.md`);
}

export function archiveEventPath(baseDir, date, runId) {
  return join(baseDir, ''.agents', 'events', 'archive', `${date}-${runId}.md`);
}

export function eventsDir(baseDir) {
  return join(baseDir, ''.agents', 'events');
}

export function tasksDir(baseDir) {
  return join(baseDir, ''.agents', 'tasks');
}
