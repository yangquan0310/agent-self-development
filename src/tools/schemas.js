/**
 * Tool Schemas — v4.3.0 Object-Driven Layer
 *
 * 命名空间工具的 JSON Schema 定义（parameters 格式）。
 * 废弃 inputSchema，全面使用 parameters。
 */

// ── task.* 命名空间 ──

export const TOOL_SCHEMAS = {
  'task.create': {
    name: 'task.create',
    description: '创建 draft task',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        prompt: { type: 'string', description: '用户原始输入（前500字）' },
        taskType: {
          type: 'string',
          enum: ['coding', 'research', 'documentation'],
          description: '任务类型（可选）'
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
      required: ['runId', 'prompt']
    }
  },

  'task.update': {
    name: 'task.update',
    description: '更新 task 状态',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        status: {
          type: 'string',
          enum: ['draft', 'pending_approval', 'active', 'revising', 'completed'],
          description: '新状态'
        },
        reason: { type: 'string', description: '状态变更原因（可选）' }
      },
      required: ['runId', 'status']
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

  'task.query': {
    name: 'task.query',
    description: '查询指定 runId 的完整 Task JSON 状态',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'task.files': {
    name: 'task.files',
    description: '获取任务关联的文件列表',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'task.diagnose': {
    name: 'task.diagnose',
    description: '返回当前插件和任务的诊断信息',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '可选，任务运行 ID' }
      }
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

  'task.deviate': {
    name: 'task.deviate',
    description: '记录偏差到 task.json',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        type: { type: 'string', description: '偏差类型（如 scope_creep, technical_debt）' },
        description: { type: 'string', description: '偏差描述' },
        impact: { type: 'string', description: '影响评估（可选）' }
      },
      required: ['runId', 'type', 'description']
    }
  },

  'task.attribute': {
    name: 'task.attribute',
    description: '记录归因到 task.json',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        rootCause: { type: 'string', description: '根本原因' },
        strategy: { type: 'string', description: '改进策略' },
        impact: { type: 'string', description: '影响范围（可选）' }
      },
      required: ['runId', 'rootCause', 'strategy']
    }
  },

  // ── event.* 命名空间 ──

  'event.record': {
    name: 'event.record',
    description: '记录偏差或归因到事件文件',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        recordType: {
          type: 'string',
          enum: ['deviation', 'attribution'],
          description: '记录类型'
        },
        data: {
          type: 'object',
          description: '记录内容',
          properties: {
            type: { type: 'string', description: '偏差类型（recordType=deviation 时）' },
            description: { type: 'string', description: '偏差描述（recordType=deviation 时）' },
            impact: { type: 'string', description: '影响评估（可选）' },
            rootCause: { type: 'string', description: '根本原因（recordType=attribution 时）' },
            strategy: { type: 'string', description: '改进策略（recordType=attribution 时）' }
          }
        },
        task: {
          type: 'object',
          description: '可选，完整的 task 对象（用于定位事件文件）'
        }
      },
      required: ['runId', 'recordType', 'data']
    }
  },

  'event.query': {
    name: 'event.query',
    description: '查询事件记录',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '可选，精确匹配任务 ID' },
        date: { type: 'string', description: '可选，YYYY-MM-DD' },
        type: {
          type: 'string',
          enum: ['deviation', 'attribution'],
          description: '可选，记录类型'
        }
      }
    }
  },

  // ── guide.* 命名空间 ──

  'guide.planning': {
    name: 'guide.planning',
    description: '获取 planning 阶段指导文本',
    parameters: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['assessment', 'draft', 'pending_approval', 'active', 'revising'],
          description: 'planning 阶段名称'
        },
        taskType: {
          type: 'string',
          enum: ['coding', 'research', 'documentation'],
          description: '任务类型（可选）'
        }
      },
      required: ['phase']
    }
  },

  'guide.monitoring': {
    name: 'guide.monitoring',
    description: '获取 monitoring 指导文本',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'guide.regulation': {
    name: 'guide.regulation',
    description: '获取 regulation 指导文本',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  'guide.development': {
    name: 'guide.development',
    description: '获取 development 指导文本',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  }
};

/**
 * 命名空间工具分组
 */
export const TASK_TOOLS = [
  'task.create',
  'task.update',
  'task.advance',
  'task.query',
  'task.files',
  'task.diagnose',
  'task.archive',
  'task.deviate',
  'task.attribute'
];

export const EVENT_TOOLS = [
  'event.record',
  'event.query'
];

export const GUIDE_TOOLS = [
  'guide.planning',
  'guide.monitoring',
  'guide.regulation',
  'guide.development'
];

export const ALL_TOOLS = [...TASK_TOOLS, ...EVENT_TOOLS, ...GUIDE_TOOLS];
