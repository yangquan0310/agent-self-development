/**
 * EventObject — v4.3.0
 *
 * 项目级 event.md 的唯一写入者。
 * 负责事件 Markdown 文件的创建、章节追加、查询和归档。
 *
 * 职责边界：
 * - EventObject = 项目级事件文件生命周期
 * - MemoryArchive（Event 类）= 系统级归档（~/.agent/memory/*.sqlite）
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { resolveEventFilePath } from '../common/project-context.js';

export class EventObject {
  constructor(deps) {
    this.logger = deps.logger;
    this.eventTemplate = deps.eventTemplate || '';
    this.projectRoot = deps.projectRoot || process.cwd();
  }

  // ── 创建事件文件 ──

  async createEvent(params) {
    const { runId, task, agentId = 'main' } = params || {};

    if (!runId) {
      return { error: 'runId 不能为空' };
    }
    if (!task || typeof task !== 'object') {
      return { error: 'task 必须是有效对象' };
    }

    const eventFilePath = resolveEventFilePath(task);
    if (!eventFilePath) {
      return { error: '无法解析事件文件路径（task.createdAt 缺失）' };
    }

    const absPath = join(this.projectRoot, eventFilePath);

    // 确保目录存在
    try {
      await fs.mkdir(dirname(absPath), { recursive: true });
    } catch (err) {
      return { error: `创建目录失败: ${err.message}` };
    }

    // 渲染模板
    const template = this.eventTemplate || this._defaultTemplate();
    const rendered = this._renderTemplate(template, {
      runId,
      agentId,
      createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
      taskType: task.taskType || '',
      planSummary: this._buildPlanSummary(task),
      executionSummary: this._buildExecutionSummary(task),
      changeLog: '',
      outcome: ''
    });

    try {
      await fs.writeFile(absPath, rendered, 'utf-8');
    } catch (err) {
      return { error: `写入事件文件失败: ${err.message}` };
    }

    this.logger?.info?.(`[EventObject] createEvent: ${eventFilePath}`);
    return { eventFilePath };
  }

  // ── 记录偏差或归因 ──

  async record(params) {
    const { runId, recordType, data, task } = params || {};

    if (!runId) {
      return { error: 'runId 不能为空' };
    }
    if (!recordType || !['deviation', 'attribution'].includes(recordType)) {
      return { error: 'recordType 必须是 deviation 或 attribution' };
    }
    if (!data || typeof data !== 'object') {
      return { error: 'data 不能为空' };
    }

    // 解析事件文件路径
    let eventFilePath;
    if (task) {
      eventFilePath = resolveEventFilePath(task);
    }
    if (!eventFilePath) {
      // 尝试从文件系统推断：扫描 .agent/events/ 下包含该 runId 的文件
      eventFilePath = await this._findEventFileByRunId(runId);
    }

    if (!eventFilePath) {
      return { error: `找不到事件文件: runId=${runId}` };
    }

    const absPath = join(this.projectRoot, eventFilePath);

    // 若文件不存在，且提供了 task，先创建
    let content;
    try {
      content = await fs.readFile(absPath, 'utf-8');
    } catch {
      if (task) {
        const createResult = await this.createEvent({ runId, task });
        if (createResult.error) {
          return { error: createResult.error };
        }
        content = await fs.readFile(absPath, 'utf-8');
      } else {
        return { error: `事件文件不存在: ${eventFilePath}` };
      }
    }

    const timestamp = Date.now();
    let entry;
    let sectionTitle;

    if (recordType === 'deviation') {
      sectionTitle = '5. 偏差';
      entry = `\n- **${data.type}** (${timestamp}): ${data.description}${data.impact ? ` — 影响: ${data.impact}` : ''}`;
    } else {
      sectionTitle = '6. 归因';
      const id = data.id || `attr-${timestamp}`;
      entry = `\n- **${id}** (${timestamp}): 根因: ${data.rootCause} — 策略: ${data.strategy}${data.impact ? ` — 影响: ${data.impact}` : ''}`;
    }

    const newContent = this._appendToSection(content, sectionTitle, entry);
    if (newContent === null) {
      return { error: `找不到「${sectionTitle}」章节` };
    }

    try {
      await fs.writeFile(absPath, newContent, 'utf-8');
    } catch (err) {
      return { error: `追加写入失败: ${err.message}` };
    }

    this.logger?.info?.(`[EventObject] record: ${recordType} -> ${eventFilePath}`);
    return { recorded: true, eventFilePath };
  }

  // ── 查询事件 ──

  async query(filters = {}) {
    const { runId, date, type } = filters;
    const eventsDir = join(this.projectRoot, '.agent', 'events');

    let dateDirs = [];
    try {
      const entries = await fs.readdir(eventsDir, { withFileTypes: true });
      dateDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return { events: [], count: 0 };
    }

    if (date) {
      dateDirs = dateDirs.filter(d => d === date);
    }

    const results = [];

    for (const dir of dateDirs) {
      const dirPath = join(eventsDir, dir);
      let files = [];
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        files = entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name);
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = join(dirPath, file);
        let content;
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          continue;
        }

        const parsed = this._parseEventFile(content, filePath);

        if (runId && parsed.runId !== runId) {
          continue;
        }

        // 提取偏差/归因记录
        if (!type || type === 'deviation') {
          for (const dev of parsed.deviations) {
            results.push({
              runId: parsed.runId,
              date: dir,
              time: file.replace('.md', ''),
              type: 'deviation',
              data: dev,
              sourceFile: `.agent/events/${dir}/${file}`
            });
          }
        }

        if (!type || type === 'attribution') {
          for (const attr of parsed.attributions) {
            results.push({
              runId: parsed.runId,
              date: dir,
              time: file.replace('.md', ''),
              type: 'attribution',
              data: attr,
              sourceFile: `.agent/events/${dir}/${file}`
            });
          }
        }
      }
    }

    return { events: results, count: results.length };
  }

  // ── 归档事件 ──

  async archive(runId) {
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const eventsDir = join(this.projectRoot, '.agent', 'events');
    const archiveDir = join(eventsDir, 'archive');

    let archivedCount = 0;
    let archivedPaths = [];

    try {
      await fs.mkdir(archiveDir, { recursive: true });

      const dateDirs = await fs.readdir(eventsDir, { withFileTypes: true });
      for (const entry of dateDirs.filter(e => e.isDirectory() && e.name !== 'archive')) {
        const dirPath = join(eventsDir, entry.name);
        const files = await fs.readdir(dirPath);
        for (const file of files.filter(f => f.endsWith('.md'))) {
          const filePath = join(dirPath, file);
          let content;
          try {
            content = await fs.readFile(filePath, 'utf-8');
          } catch {
            continue;
          }

          const parsed = this._parseEventFile(content, filePath);
          if (parsed.runId === runId) {
            const dst = join(archiveDir, `${entry.name}-${file}`);
            await fs.rename(filePath, dst);
            archivedCount++;
            archivedPaths.push(`.agent/events/archive/${entry.name}-${file}`);
          }
        }
      }
    } catch (err) {
      return { error: `归档失败: ${err.message}` };
    }

    this.logger?.info?.(`[EventObject] archive: runId=${runId}, archived=${archivedCount}`);
    return { archived: archivedCount > 0, archivedCount, archivedPaths };
  }

  // ── 内部辅助 ──

  _defaultTemplate() {
    return `# Event: {{runId}}

## 1. 元信息

- **runId**: {{runId}}
- **agentId**: {{agentId}}
- **createdAt**: {{createdAt}}
- **taskType**: {{taskType}}

## 2. 计划

{{planSummary}}

## 3. 执行

{{executionSummary}}

## 4. 变更记录

{{changeLog}}

## 5. 偏差

<!-- EventObject 在此追加偏差记录。请勿删除本注释。 -->

## 6. 归因

<!-- EventObject 在此追加归因记录。请勿删除本注释。 -->

## 7. 结果

{{outcome}}

---
*本文件由 Agent Self-Development 插件自动生成*
`;
  }

  _renderTemplate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return vars[key] !== undefined ? vars[key] : '';
    });
  }

  _buildPlanSummary(task) {
    const prompt = task.plan?.prompt || '';
    const phases = task.plan?.execution?.phases || [];
    let summary = `- 目标: ${task.plan?.context?.goal || prompt.slice(0, 100)}\n`;
    summary += `- 阶段数: ${phases.length}\n`;
    for (const ph of phases) {
      summary += `  - ${ph.id}: ${ph.name} (${ph.status})\n`;
    }
    return summary.trim();
  }

  _buildExecutionSummary(task) {
    const currentPhase = task.plan?.execution?.currentPhase ?? 0;
    const phases = task.plan?.execution?.phases || [];
    const completed = phases.filter(p => p.status === 'completed').length;
    return `- 当前阶段: ${currentPhase + 1}/${phases.length}\n- 已完成: ${completed}/${phases.length}`;
  }

  _appendToSection(content, sectionTitle, entry) {
    // 匹配 "## {sectionTitle}" 到下一个 "## " 或文件末尾
    const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(##\\s*${escaped}[\\s\\S]*?)(?=##\\s|$)`);
    const match = content.match(regex);
    if (!match) return null;

    const insertPos = match.index + match[0].length;
    return content.slice(0, insertPos) + entry + content.slice(insertPos);
  }

  async _findEventFileByRunId(runId) {
    const eventsDir = join(this.projectRoot, '.agent', 'events');
    try {
      const dateDirs = await fs.readdir(eventsDir, { withFileTypes: true });
      for (const entry of dateDirs.filter(e => e.isDirectory())) {
        const dirPath = join(eventsDir, entry.name);
        const files = await fs.readdir(dirPath);
        for (const file of files.filter(f => f.endsWith('.md'))) {
          const filePath = join(dirPath, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const match = content.match(/# Event:\s*(.+)/);
            if (match && match[1].trim() === runId) {
              return `.agent/events/${entry.name}/${file}`;
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      // 目录不存在
    }
    return null;
  }

  _parseEventFile(content, filePath) {
    const result = {
      runId: '',
      deviations: [],
      attributions: []
    };

    // 提取 runId
    const titleMatch = content.match(/# Event:\s*(.+)/);
    if (titleMatch) {
      result.runId = titleMatch[1].trim();
    }

    // 提取偏差
    const devSection = content.match(/##\s*5\.\s*偏差([\s\S]*?)(?=##\s*6\.|$)/);
    if (devSection) {
      const devLines = devSection[1].split('\n').filter(l => l.trim().startsWith('- **'));
      for (const line of devLines) {
        const m = line.match(/- \*\*(.+?)\*\*\s*\((\d+)\):\s*(.+)/);
        if (m) {
          result.deviations.push({
            type: m[1],
            timestamp: parseInt(m[2], 10),
            description: m[3].split(' — 影响:')[0].trim(),
            impact: m[3].includes(' — 影响:') ? m[3].split(' — 影响:')[1].trim() : ''
          });
        }
      }
    }

    // 提取归因
    const attrSection = content.match(/##\s*6\.\s*归因([\s\S]*?)(?=##\s*7\.|$)/);
    if (attrSection) {
      const attrLines = attrSection[1].split('\n').filter(l => l.trim().startsWith('- **'));
      for (const line of attrLines) {
        const m = line.match(/- \*\*(.+?)\*\*\s*\((\d+)\):\s*根因:\s*(.+?)\s*—\s*策略:\s*(.+)/);
        if (m) {
          result.attributions.push({
            id: m[1],
            timestamp: parseInt(m[2], 10),
            rootCause: m[3].split(' — 影响:')[0].trim(),
            strategy: m[4].split(' — 影响:')[0].trim(),
            impact: (m[3] + m[4]).includes(' — 影响:') ?
              ((m[3].includes(' — 影响:') ? m[3].split(' — 影响:')[1] : '') +
               (m[4].includes(' — 影响:') ? m[4].split(' — 影响:')[1] : '')).trim() : ''
          });
        }
      }
    }

    return result;
  }
}
