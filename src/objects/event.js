/**
 * Event Objects — v4.3.0
 *
 * 3 个扁平化 Event Handler，直接读写 .agents/events/。
 * 函数签名: (params, context) => result | { error }
 * 不抛出异常，错误通过 { error } 返回。
 */

import { taskPath, eventPath, archiveEventPath, eventsDir } from '../utils/resolve.js';
import { readJson, writeMarkdown, fileExists, readText, moveFile } from '../utils/io.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { validateRunId } from '../utils/validate.js';
import { getNow } from '../utils/helpers.js';

// ── report ──

export async function report(params, context) {
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
  const eventFilePath = task.eventFilePath || eventPath(context.baseDir, runId, task.createdAt.slice(0, 10));

  const lines = [
    `# Event: ${runId}`,
    '',
    `> 本文件由 task.reportEvent 在任务完成后从 task.json 生成`,
    '',
    '---',
    '',
    '## 1. 元信息',
    '',
    `- **runId**: ${runId}`,
    `- **createdAt**: ${task.createdAt}`,
    `- **updatedAt**: ${task.updatedAt}`,
    `- **taskType**: ${task.taskType}`,
    `- **status**: ${task.status}`,
    '',
    '---',
    '',
    '## 2. 计划',
    '',
    '### Prompt',
    '',
    `${task.plan?.prompt || ''}`,
    '',
    '### Context',
    '',
    `- Goal: ${task.plan?.context?.goal || ''}`,
    `- Constraints: ${(task.plan?.context?.constraints || []).join(', ')}`,
    `- Success Criteria: ${(task.plan?.context?.successCriteria || []).join(', ')}`,
    '',
    '### Execution',
    '',
    ...(task.plan?.execution?.phases || []).map(p =>
      `- **${p.id}** ${p.name} (${p.status}): ${p.goal}`
    ),
    '',
    '---',
    '',
    '## 3. 变更记录',
    '',
    ...(task.deviations.length === 0 && task.attributions.length === 0
      ? ['无变更记录']
      : []),
    ...(task.deviations.map((d, i) =>
      `### 偏差 ${i + 1} — ${d.type} (${d.timestamp})\n\n${d.description}${d.impact ? `\n\n影响: ${d.impact}` : ''}`
    )),
    ...(task.attributions.map((a, i) =>
      `### 归因 ${i + 1} — (${a.timestamp})\n\n根本原因: ${a.rootCause}\n\n改进策略: ${a.strategy}${a.impact ? `\n\n影响范围: ${a.impact}` : ''}`
    )),
    '',
    '---',
    '',
    '## 4. 结果',
    '',
    task.outcome?.summary ? task.outcome.summary : '无结果记录',
    '',
    ...(task.outcome?.artifacts?.length ? ['### 产出物', '', ...(task.outcome.artifacts.map(a => `- ${a}`))] : []),
    '',
    '---',
    '',
    '*本文件由 Agent Self-Development 插件自动生成*'
  ];

  const content = lines.join('\n');
  await writeMarkdown(eventFilePath, content);

  // NOTE: eventFilePath 的 task 关联更新由 tools/handlers.js 负责调用 task.update
  return { runId, eventFilePath };
}

// ── query ──

export async function query(params = {}, context) {
  const { runId, date, type } = params;
  const results = [];

  const baseDir = eventsDir(context.baseDir);
  if (!(await fileExists(baseDir))) {
    return { count: 0, events: [] };
  }

  let dateDirs;
  if (date) {
    dateDirs = [date];
  } else {
    const entries = await readdir(baseDir, { withFileTypes: true });
    dateDirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  }

  for (const dateDir of dateDirs) {
    const dirPath = join(baseDir, dateDir);
    if (!(await fileExists(dirPath))) continue;

    const entries = await readdir(dirPath, { withFileTypes: true });
    const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'));

    for (const file of mdFiles) {
      const fileRunId = file.name.slice(0, -3);

      if (runId && fileRunId !== runId) continue;

      const filePath = join(dirPath, file.name);
      const content = await readText(filePath);

      if (type) {
        const hasType = type === 'deviation'
          ? content.includes('### 偏差')
          : content.includes('### 归因');
        if (!hasType) continue;
      }

      results.push({
        runId: fileRunId,
        date: dateDir,
        path: filePath,
        summary: content.split('\n').slice(0, 5).join('\n')
      });
    }
  }

  return { count: results.length, events: results };
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

  const baseDir = eventsDir(context.baseDir);
  if (!(await fileExists(baseDir))) {
    return { error: `事件不存在: ${runId}` };
  }

  let dateDirs;
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    dateDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return { error: `事件不存在: ${runId}` };
  }

  for (const dateDir of dateDirs) {
    const mdPath = join(baseDir, dateDir, `${runId}.md`);
    if (await fileExists(mdPath)) {
      const ap = archiveEventPath(context.baseDir, dateDir, runId);
      await moveFile(mdPath, ap);
      return { runId, archivedAt: getNow(), archivePath: ap };
    }
  }

  return { error: `事件不存在: ${runId}` };
}
