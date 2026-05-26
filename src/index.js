/**
 * Agent Autobiography — v4.5.0
 *
 * OpenClaw 插件入口。暴露 register(api) 同步接口。
 *
 * Hook 注入时机（v4.5.0 条件触发）：
 * - after_tool_call:      监听 task.create / task.update / event.report，条件触发精准提醒
 * - before_prompt_build:  只在无 active task 时触发，提醒创建任务
 */

import { registerTools } from './tools/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { evaluateAfterToolCall, evaluateBeforePromptBuild } from './hooks/condition.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 日志工具：优先使用 api.logger，fallback 到 console.error
function logInfo(logger, ...args) {
  if (logger?.info) {
    logger.info(...args);
  } else {
    console.error('[agent-autobiography]', ...args);
  }
}

// 通用注入函数
async function enqueueInjection(api, logger, idempotencyKey, prependContext) {
  try {
    await api.enqueueNextTurnInjection({
      idempotencyKey,
      prependContext,
    });
    logInfo(logger, `[agent-autobiography] Injection queued: ${idempotencyKey}`);
  } catch (err) {
    logInfo(logger, `[agent-autobiography] Injection failed: ${err.message}`);
  }
}

function registerSessionHooks(api, logger, context) {
  // after_tool_call：条件触发精准提醒
  api.on('after_tool_call', async (event) => {
    const { toolName } = event;
    logInfo(logger, `[agent-autobiography] after_tool_call: ${toolName}`);

    // 只监听关键工具
    if (!['task.create', 'task.update', 'event.report'].includes(toolName)) {
      return;
    }

    const { shouldInject, idempotencyKey, prependContext } = evaluateAfterToolCall(event);
    if (shouldInject) {
      await enqueueInjection(api, logger, idempotencyKey, prependContext);
    }
  }, { priority: 50 });

  // before_prompt_build：只在无 active task 时触发
  api.on('before_prompt_build', async (event) => {
    logInfo(logger, `[agent-autobiography] before_prompt_build hook fired`);

    const { shouldInject, idempotencyKey, prependContext } = await evaluateBeforePromptBuild(context);
    if (shouldInject) {
      await enqueueInjection(api, logger, idempotencyKey, prependContext);
    }
  }, { priority: 50 });
}

function loadTemplates() {
  const templates = {};
  try {
    templates.task = readFileSync(join(__dirname, 'assets', 'templates', 'task.json'), 'utf-8');
  } catch {
    // 模板可选
  }
  try {
    templates.event = readFileSync(join(__dirname, 'assets', 'templates', 'event.md'), 'utf-8');
  } catch {
    // 模板可选
  }
  return templates;
}

export function register(api) {
  const config = api.config || {};
  const baseDir = config.baseDir || process.cwd();
  const logger = api.logger;
  const templates = loadTemplates();

  const context = { baseDir, templates, logger };

  // 注册 8 个工具
  registerTools(api, context);

  // 注册 Hooks（条件触发）
  registerSessionHooks(api, logger, context);

  logInfo(logger, '[agent-autobiography] v4.5.0 初始化完成，8 个工具 + 2 个 Hooks 已注册');
}

export default {
  id: 'agent-autobiography',
  name: 'Agent Autobiography',
  version: '4.5.0',
  register,
};
