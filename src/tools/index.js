/**
 * Tool Registry — v4.3.0
 *
 * 注册 8 个命名空间工具：
 * api.registerTool({ name, description, parameters, execute })
 */

import { TOOL_SCHEMAS, ALL_TOOLS } from './schemas.js';
import * as handlers from './handlers.js';

const HANDLER_MAP = {
  'task.create': handlers.create,
  'task.update': handlers.update,
  'task.advance': handlers.advance,
  'task.get': handlers.get,
  'task.archive': handlers.archive,
  'event.report': handlers.report,
  'event.query': handlers.query,
  'event.archive': handlers.archiveEvent
};

export function registerTools(api, context) {
  for (const name of ALL_TOOLS) {
    const spec = TOOL_SCHEMAS[name];
    const handler = HANDLER_MAP[name];
    if (!handler) {
      throw new Error(`Handler 未实现: ${name}`);
    }

    api.registerTool({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      execute: async (_id, params) => handler(params, context)
    });
  }
}
