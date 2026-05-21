/**
 * Agent Self-Development — v4.4.0
 *
 * OpenClaw 插件入口。暴露 register(api) 同步接口。
 *
 * 钩子说明：
 * - session_start:        在会话启动时触发，注入任务管理/偏差追踪/归因分析/事件记录/自我发展提醒
 * - after_compaction:    在压缩合并后触发，注入相同的自我发展提醒
 */

import { registerTools } from './tools/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 日志工具：优先使用 api.logger，fallback 到 console.error（避免静默失败）
function logInfo(logger, ...args) {
  if (logger?.info) {
    logger.info(...args);
  } else {
    console.error('[agent-self-development]', ...args);
  }
}

// 需要注入到提示词的提醒文本
const INJECT_REMINDER = `【自我发展提醒】
当按照项目 TODO 执行任务时，你需要使用本插件（agent-self-development）完成以下工作：
1. 任务管理：使用 task.* 工具创建、更新、推进任务（task.create / task.update / task.advance / task.get / task.archive）
2. 偏差追踪：执行过程中如遇偏差，使用 task.update 记录偏差类型、描述和影响
3. 归因分析：每次记录偏差后分析原因、进行归因，并使用 task.update 记录原因
4. 事件记录：任务完成后使用 event.* 工具生成事件报告（event.report）
5. 自我调节：阅读事件报告，分析自我认知、风格、信念、身份、技能、程序性记忆是否与任务是平衡的，如果不平衡，请进行同化和顺应操作

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
  // 注意：session_start 事件的 event.reason 字段不存在（reason 仅在 session_end 事件中）
  // skipReasons 检查移至 session_end handler；此处无需跳过任何场景
  api.on('session_start', async (event) => {
    logInfo(logger, `[agent-self-development] session_start hook fired (sessionId=${event.sessionId}, resumedFrom=${event.resumedFrom}), enqueuing reminder injection`);

    try {
      await api.enqueueNextTurnInjection({
        idempotencyKey: 'agent-self-development:session-start-reminder',
        prependContext: INJECT_REMINDER,
      });
    } catch (err) {
      logInfo(logger, `[agent-self-development] session_start enqueueNextTurnInjection failed: ${err.message}`);
    }
  }, { priority: 50 });

  // after_compaction：在压缩合并后注入提醒
  api.on('after_compaction', async (event) => {
    logInfo(logger, `[agent-self-development] after_compaction hook fired (session=${event.context?.sessionKey}), enqueuing reminder injection`);

    try {
      await api.enqueueNextTurnInjection({
        idempotencyKey: 'agent-self-development:compaction-reminder',
        prependContext: INJECT_REMINDER,
      });
    } catch (err) {
      logInfo(logger, `[agent-self-development] after_compaction enqueueNextTurnInjection failed: ${err.message}`);
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

  logInfo(logger, '[agent-self-development] v4.4.0 初始化完成，8 个工具 + 2 个钩子已注册');
}

export default {
  id: 'agent-self-development',
  name: 'Agent Self-Development',
  version: '4.4.0',
  register,
};
