/**
 * 人格 —— 面向对象封装
 *
 * v4.0.0 架构：
 * - agent_end：纯观察，只记录日志，禁止返回注入
 * - before_prompt_build：task=completed 时择机注入 development skill
 * - 数据供给从 task.deviations/task.attributions 改为事件文件读取（向后兼容回退）
 *
 * 插件职责：在合适的时机将 development skill 注入 Agent 的 system context
 * Agent 职责：自行阅读 skill、判断同化/顺应、决定是否更新人格文件
 *
 * 核心原则：Plugin asks, Agent decides, Plugin records
 */

import { promises as fs } from 'fs';
import { HookRegistry } from '../common/hook.js';

export class Personality {
  constructor({ api, config, state, skills, logger, log }) {
    this.api = api;
    this.config = config || {};
    this.state = state;
    this.skills = skills;
    this.logger = logger;
    this.log = log;
    this.enabled = this.config.enabled !== false;

    // v4.1.0: Hook 抽象层基类
    this.hookRegistry = new HookRegistry({
      api: this.api,
      logger: this.logger,
      pluginId: 'agent-self-development'
    });
  }

  /**
   * 注册人格模块相关的 hooks
   */
  register() {
    if (!this.enabled) {
      this.logger.info('[Personality] 人格模块已禁用');
      return;
    }

    this.logger.info('[Personality] 注册人格模块 Hooks');
    this.hookRegistry.register('before_prompt_build', this.onBeforePromptBuild, this);
    this.hookRegistry.register('agent_end', this.onAgentEnd, this, { priority: 30 });
  }

  // v4.0.0: 根据 task 推断事件文件路径
  _resolveEventFilePath(task) {
    const createdAt = task.createdAt;
    if (!createdAt) return null;
    const date = new Date(createdAt);
    const dateStr = date.toISOString().slice(0, 10);
    if (task.eventFilePath) {
      return task.eventFilePath;
    }
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `.agent/events/${dateStr}/${hh}-${mm}-${ss}.md`;
  }

  // v4.0.0: 读取事件文件，提取偏差、归因、结果
  async _readEventSummary(task) {
    const eventFilePath = this._resolveEventFilePath(task);
    if (!eventFilePath) {
      return null;
    }

    try {
      const content = await fs.readFile(eventFilePath, 'utf-8');

      let deviationSection = '';
      const deviationMatch = content.match(/## 5\. 偏差[\s\S]*?(?=## 6\. |## 7\. |$)/);
      if (deviationMatch) deviationSection = deviationMatch[0];

      let attributionSection = '';
      const attributionMatch = content.match(/## 6\. 归因[\s\S]*?(?=## 7\. |$)/);
      if (attributionMatch) attributionSection = attributionMatch[0];

      let outcomeSection = '';
      const outcomeMatch = content.match(/## 7\. 结果[\s\S]*?$/);
      if (outcomeMatch) outcomeSection = outcomeMatch[0];

      return {
        source: 'event_file',
        deviationSection,
        attributionSection,
        outcomeSection,
        deviationCount: deviationSection ? (deviationSection.match(/^- /gm) || []).length : 0,
        attributionCount: attributionSection ? (attributionSection.match(/^- /gm) || []).length : 0
      };
    } catch {
      return null;
    }
  }

  /**
   * before_prompt_build：task=completed 时注入 development skill
   */
  async onBeforePromptBuild(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const task = await this.state.getTask(runId);
    if (!task || task.status !== 'completed') return;

    const developmentSkill = await this.skills.load('development');
    if (!developmentSkill) {
      this.logger.warn('[Personality] development skill 未找到');
      return;
    }

    // v4.0.0: 优先从事件文件读取偏差/归因/结果，回退到 task 顶层字段
    const eventSummary = await this._readEventSummary(task);

    let eventData;
    if (eventSummary) {
      eventData = {
        deviations: eventSummary.deviationSection ? [{ summary: eventSummary.deviationSection.slice(0, 500) }] : [],
        attributions: eventSummary.attributionSection ? [{ summary: eventSummary.attributionSection.slice(0, 500) }] : [],
        outcome: eventSummary.outcomeSection ? { summary: eventSummary.outcomeSection.slice(0, 500) } : {},
        source: 'event_file'
      };
    } else {
      // 向后兼容：回退到 task 顶层字段
      eventData = {
        deviations: task.deviations || [],
        attributions: task.attributions || [],
        outcome: task.outcome || {},
        source: 'task_fields'
      };
    }

    this.logger.debug(`[Personality] task=completed，注入 development skill: runId=${runId}, source=${eventData.source}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'Personality',
        runId,
        message: 'Inject development skill for personality update',
        extra: {
          deviationCount: eventData.deviations.length,
          attributionCount: eventData.attributions.length,
          source: eventData.source
        }
      });
    }

    return {
      prependSystemContext: `${developmentSkill}\n\n【任务回顾】本次运行（${runId}）已完成。\n【Event 摘要】\n- 偏差记录：${eventData.deviations.length} 条\n- 归因记录：${eventData.attributions.length} 条\n- 数据来源：${eventData.source === 'event_file' ? '事件文件' : 'task 顶层字段（向后兼容）'}\n【Agent 职责】请根据上方 development skill，分析本次任务经验对 6 个维度的影响（自我、风格、信念、身份、技能、程序性记忆），自行决定是否需要更新人格文件。\n`
    };
  }

  /**
   * agent_end —— v3.5.0：纯观察，只记录日志，禁止返回注入
   */
  async onAgentEnd(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const task = await this.state.getTask(runId);
    if (!task) {
      this.logger.debug(`[Personality] runId=${runId} 无 task，跳过`);
      return;
    }

    const eventSummary = {
      deviations: task.deviations || [],
      attributions: task.attributions || []
    };

    this.logger.debug(`[Personality] runId=${runId}, status=${task.status}, deviations=${eventSummary.deviations.length}, attributions=${eventSummary.attributions.length}`);

    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'Personality',
        runId,
        message: 'Agent ended, personality log recorded',
        extra: {
          taskStatus: task.status,
          deviationCount: eventSummary.deviations.length,
          attributionCount: eventSummary.attributions.length
        }
      });
    }
  }

  /**
   * v3.5.0: Gateway 停止时清理资源
   */
  stop() {
    this.logger.info('[Personality] 人格模块停止');
  }
}
