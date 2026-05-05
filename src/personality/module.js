/**
 * 人格 —— 面向对象封装
 *
 * v3.5.0 架构：
 * - agent_end：纯观察，只记录日志，禁止返回注入
 * - before_prompt_build：task=completed 时择机注入 development skill
 *
 * 插件职责：在合适的时机将 development skill 注入 Agent 的 system context
 * Agent 职责：自行阅读 skill、判断同化/顺应、决定是否更新人格文件
 *
 * 核心原则：Plugin asks, Agent decides, Plugin records
 */

export class Personality {
  constructor({ api, config, state, skills, logger, log }) {
    this.api = api;
    this.config = config || {};
    this.state = state;
    this.skills = skills;
    this.logger = logger;
    this.log = log;
    this.enabled = this.config.enabled !== false;
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
    this.api.on('before_prompt_build', this.onBeforePromptBuild.bind(this));
    this.api.on('agent_end', this.onAgentEnd.bind(this), { priority: 30 });
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

    const eventSummary = {
      deviations: task.deviations || [],
      attributions: task.attributions || [],
      outcome: task.outcome || {}
    };

    this.logger.debug(`[Personality] task=completed，注入 development skill: runId=${runId}`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'Personality',
        runId,
        message: 'Inject development skill for personality update',
        extra: {
          deviationCount: eventSummary.deviations.length,
          attributionCount: eventSummary.attributions.length
        }
      });
    }

    return {
      prependSystemContext: `${developmentSkill}\n\n【任务回顾】本次运行（${runId}）已完成。\n【Event 摘要】\n- 偏差记录：${eventSummary.deviations.length} 条\n- 归因记录：${eventSummary.attributions.length} 条\n【Agent 职责】请根据上方 development skill，分析本次任务经验对 6 个维度的影响（自我、风格、信念、身份、技能、程序性记忆），自行决定是否需要更新人格文件。\n`
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
