/**
 * Agent Self-Development — v4.3.1
 *
 * OpenClaw 插件入口。暴露 register(api) 同步接口。
 *
 * 钩子说明：
 * - session_start:        在会话启动时触发，注入任务管理/事件记录/自我调节提醒
 * - after_compaction:    在压缩合并后触发，注入相同的自我调节提醒
 */

import { registerTools } from './tools/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 需要注入到提示词的提醒文本
const INJECT_REMINDER = `【自我调节提醒】
当按照项目 TODO 执行任务时，你需要使用本插件（agent-self-development）完成以下工作：
1. 任务管理：使用 task.* 工具创建、更新、推进任务（task.create / task.update / task.advance / task.get / task.archive）
2. 事件记录：任务完成后使用 event.* 工具生成事件报告（event.report），并在六维度上做自我调节（event.reflection）
3. 偏差追踪：执行过程中如遇偏差，使用 task.update 记录偏差类型、描述和影响
4. 归因分析：每次任务完成后记录归因（能力/努力/策略/环境），用于持续自我优化

提示：本插件的 task.json 和 event.md 模板存储在项目的 .agent/ 目录下。`;

function loadTemplates() {
  const templates = {};
  try {
    templates.task = readFileSync(join(__dirname, 'assets', 'task.json'), 'utf-8');
  } catch {
    // 模板可选
  }
  try {
    templates.event = readFileSync(join(__dirname, 'assets', 'event.md'), 'utf-8');
  } catch {
    // 模板可选
  }
  return templates;
}

function registerSessionHooks(api, logger) {
  // session_start：在会话启动时注入提醒
  api.on('session_start', async (event) => {
    // reason: 'new' | 'reset' | 'idle' | 'daily' | 'compaction' | 'deleted' | 'shutdown' | 'restart' | 'unknown'
    const skipReasons = ['deleted', 'shutdown', 'restart', 'unknown'];
    if (skipReasons.includes(event.reason)) {
      return;
    }

    logger?.info(`[agent-self-development] session_start hook fired (reason=${event.reason}), enqueuing reminder injection`);

    try {
      await api.enqueueNextTurnInjection({
        idempotencyKey: 'agent-self-development:session-start-reminder',
        prependContext: INJECT_REMINDER,
      });
    } catch (err) {
      logger?.warn(`[agent-self-development] enqueueNextTurnInjection failed: ${err.message}`);
    }
  }, { priority: 50 });

  // after_compaction：在压缩合并后注入提醒
  api.on('after_compaction', async (event) => {
    logger?.info(`[agent-self-development] after_compaction hook fired (session=${event.context?.sessionKey}), enqueuing reminder injection`);

    try {
      await api.enqueueNextTurnInjection({
        idempotencyKey: 'agent-self-development:compaction-reminder',
        prependContext: INJECT_REMINDER,
      });
    } catch (err) {
      logger?.warn(`[agent-self-development] enqueueNextTurnInjection failed: ${err.message}`);
    }
  }, { priority: 50 });
}

export function register(api) {
  const config = api.config || {};
  const baseDir = config.baseDir || process.cwd();
  const logger = api.logger;
  const templates = loadTemplates();

  const context = { baseDir, templates, logger };

  // 注册 8 个工具
  registerTools(api, context);

  // 注册 session_start / after_compaction 钩子
  registerSessionHooks(api, logger);

  logger?.info('[agent-self-development] v4.3.1 初始化完成，8 个工具 + 2 个钩子已注册');
}

export default {
  id: 'agent-self-development',
  name: 'Agent Self-Development',
  version: '4.3.1',
  register,
};
