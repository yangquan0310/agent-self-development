/**
 * Tool Registry — v4.3.1
 *
 * 注册 8 个命名空间工具：
 * api.registerTool({ name, description, parameters, execute })
 *
 * v4.3.1: execute 从 params.baseDir 动态构建 context，
 *        替代注册时传入的固定 context，实现项目级路径解析。
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

export function registerTools(api) {
  for (const name of ALL_TOOLS) {
    const spec = TOOL_SCHEMAS[name];
    const handler = HANDLER_MAP[name];
    if (!handler) {
      throw new Error(`Handler 未实现: ${name}`);
    }

    const factory = (_ctx) => ({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      execute: async (_id, params) => {
        // 从 params 提取 baseDir，构建动态 context
        const { baseDir, ...restParams } = params;
        if (!baseDir) {
          return { error: 'baseDir 参数缺失（必填）' };
        }
        const context = { baseDir };
        return handler(restParams, context);
      }
    });
    api.registerTool(factory, { name: spec.name });
  }
}
