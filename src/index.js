/**
 * Agent Self-Development — v4.3.0
 *
 * 插件入口。暴露 initialize(api, config) 接口。
 */

import { registerTools } from './tools/index.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadTemplates() {
  const templates = {};
  try {
    templates.task = await readFile(join(__dirname, 'assets', 'task.json'), 'utf-8');
  } catch {
    // 模板可选
  }
  try {
    templates.event = await readFile(join(__dirname, 'assets', 'event.md'), 'utf-8');
  } catch {
    // 模板可选
  }
  return templates;
}

export async function initialize(api, config = {}) {
  const baseDir = config.baseDir || process.cwd();
  const logger = api.logger;
  const templates = await loadTemplates();

  const context = { baseDir, templates, logger };
  registerTools(api, context);

  logger?.info(`[agent-self-development] 8 个工具已注册`);
}

export default {
  id: 'agent-self-development',
  name: 'Agent Self-Development',
  version: '4.3.0',
  initialize
};
