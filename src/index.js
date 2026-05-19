/**
 * Agent Self-Development — v4.3.0
 *
 * OpenClaw 插件入口。暴露 register(api) 同步接口。
 */

import { registerTools } from './tools/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

export function register(api) {
  const config = api.config || {};
  const baseDir = config.baseDir || process.cwd();
  const logger = api.logger;
  const templates = loadTemplates();

  const context = { baseDir, templates, logger };
  registerTools(api, context);

  logger?.info('[agent-self-development] 8 个工具已注册');
}

export default {
  id: 'agent-self-development',
  name: 'Agent Self-Development',
  version: '4.3.0',
  register
};
