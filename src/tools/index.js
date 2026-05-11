/**
 * Tool Registry — v4.1.0
 *
 * 整合所有 tools，提供统一的 registerTools(api) 入口。
 * 在 src/index.js 中调用：registerTools(api, deps)
 */

import { TOOL_SCHEMAS, ALL_TOOLS } from './schemas.js';
import { createMetacognitionTools } from './metacognition-tools.js';
import { createWorkingMemoryTools } from './working-memory-tools.js';

/**
 * 注册所有 tools 到 api
 * @param {Object} api - OpenClaw api 对象
 * @param {Object} deps - 依赖注入 { state, skills, logger, log, events }
 */
export function registerTools(api, deps) {
  if (!api || typeof api.registerTool !== 'function') {
    deps.logger?.warn?.('[Tools] api.registerTool 不可用，无法注册 tools');
    return;
  }

  const metaTools = createMetacognitionTools(deps);
  const wmTools = createWorkingMemoryTools(deps);

  const allToolHandlers = { ...metaTools, ...wmTools };

  for (const toolName of ALL_TOOLS) {
    const schema = TOOL_SCHEMAS[toolName];
    const handler = allToolHandlers[toolName];

    if (!schema || !handler) {
      deps.logger?.warn?.(`[Tools] 跳过未实现的 tool: ${toolName}`);
      continue;
    }

    api.registerTool(toolName, {
      name: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema,
      handler: async (params) => {
        try {
          const result = await handler(params);
          deps.logger?.debug?.(`[Tools] ${toolName} 调用成功`);
          return result;
        } catch (err) {
          const errorMsg = err.message || String(err);
          deps.logger?.error?.(`[Tools] ${toolName} 调用失败: ${errorMsg}`);
          return { error: errorMsg };
        }
      }
    });

    deps.logger?.debug?.(`[Tools] 注册 tool: ${toolName}`);
  }

  deps.logger?.info?.(`[Tools] 已注册 ${ALL_TOOLS.length} 个 tools`);
}

export { TOOL_SCHEMAS, ALL_TOOLS };
export { createMetacognitionTools } from './metacognition-tools.js';
export { createWorkingMemoryTools } from './working-memory-tools.js';
