/**
 * Tool Schemas — v4.3.0
 *
 * 6 个命名空间工具的 JSON Schema 定义（parameters 格式）。
 */

export const TOOL_SCHEMAS = {
  'task.create': {
    name: 'task.create',
    description: '创建 draft task',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID（可选，默认自动生成）' },
        prompt: { type: 'string', description: '用户原始输入（前 500 字）' },
        taskType: {
          type: 'string',
          enum: ['task', 'coding', 'research', 'documentation'],
          description: '任务类型（可选，默认 task）'
        },
        planInput: {
          type: 'object',
          description: '可选，Agent 提供的完整计划输入',
          properties: {
            goal: { type: 'string' },
            constraints: { type: 'array', items: { type: 'string' } },
            successCriteria: { type: 'array', items: { type: 'string' } },
            phases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  goal: { type: 'string' },
                  outputs: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }
                }
              }
            }
          }
        }
      },
      required: ['prompt']
    }
  },

  'task.update': {
    name: 'task.update',
    description: '更新 task 状态、偏差、归因、结果或事件路径',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        status: {
          type: 'string',
          enum: ['draft', 'pending_approval', 'active', 'revising', 'completed'],
          description: '新状态（可选）'
        },
        deviation: {
          type: 'object',
          description: '可选，偏差记录',
          properties: {
            type: { type: 'string', description: '偏差类型（如 scope_creep, technical_debt）' },
            description: { type: 'string', description: '偏差描述' },
            impact: { type: 'string', description: '影响评估（可选）' },
            timestamp: { type: 'string', description: 'ISO 时间戳（可选，默认当前时间）' }
          },
          required: ['type', 'description']
        },
        attribution: {
          type: 'object',
          description: '可选，归因记录',
          properties: {
            rootCause: { type: 'string', description: '根本原因' },
            strategy: { type: 'string', description: '改进策略' },
            impact: { type: 'string', description: '影响范围（可选）' },
            timestamp: { type: 'string', description: 'ISO 时间戳（可选，默认当前时间）' }
          },
          required: ['rootCause', 'strategy']
        },
        outcome: {
          type: 'object',
          description: '可选，任务结果',
          properties: {
            summary: { type: 'string' },
            artifacts: { type: 'array', items: { type: 'string' } },
            metrics: { type: 'object' }
          }
        },
        eventFilePath: { type: 'string', description: '可选，关联事件文件路径' },
        reason: { type: 'string', description: '变更原因（可选）' }
      },
      required: ['runId']
    }
  },

  'task.advance': {
    name: 'task.advance',
    description: '推进 task 到下一阶段',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        phaseId: { type: 'string', description: '可选，指定阶段 ID' }
      },
      required: ['runId']
    }
  },

  'task.get': {
    name: 'task.get',
    description: '查询指定 runId 的完整 Task JSON 状态',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'task.archive': {
    name: 'task.archive',
    description: '归档已完成的任务',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'event.report': {
    name: 'event.report',
    description: '任务完成后一次性从 task.json 生成 event.md',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'event.query': {
    name: 'event.query',
    description: '查询事件记录，支持按 runId、日期、类型筛选',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '可选，精确匹配任务 ID' },
        date: { type: 'string', description: '可选，YYYY-MM-DD' },
        type: { type: 'string', enum: ['deviation', 'attribution'], description: '可选，记录类型' }
      }
    }
  },

  'event.archive': {
    name: 'event.archive',
    description: '归档事件文件（移动 event.md 到 archive 目录）',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  }
};

export const ALL_TOOLS = Object.keys(TOOL_SCHEMAS);
