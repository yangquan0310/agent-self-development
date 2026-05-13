/**
 * Tool Schemas — v4.1.0 Tool-Driven Agent Autonomy
 *
 * 13 个 tools 的 JSON Schema 定义。
 * 设计原则：
 * - 查询型 Tool 只读，不修改项目文件
 * - 操作型 Tool 被动响应，只在 Agent 调用时执行文件写入
 * - 所有输入/输出/错误处理明确可见
 */

export const TOOL_SCHEMAS = {
  // ── 第一层：查询型 Tool（只读）──

  get_task_status: {
    name: 'get_task_status',
    description: '查询指定 runId 的完整 Task JSON 状态',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  get_task_files: {
    name: 'get_task_files',
    description: '获取任务关联的文件列表（从 .agent/tasks/{runId}.json 读取）',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  get_planning_guide: {
    name: 'get_planning_guide',
    description: '获取 planning 阶段指导文本，根据 phase 和可选 taskType 返回对应的 skill 内容',
    inputSchema: {
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
          description: '任务类型（可选），指定后加载对应专用模板'
        }
      },
      required: ['phase']
    }
  },

  get_monitoring_guide: {
    name: 'get_monitoring_guide',
    description: '获取 monitoring 指导文本，包含当前阶段和历史偏差',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  get_regulation_guide: {
    name: 'get_regulation_guide',
    description: '获取 regulation 指导文本，包含偏差摘要（仅在存在未处理偏差时可用）',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  get_development_guide: {
    name: 'get_development_guide',
    description: '获取 development 指导文本，包含 Event 摘要（task=completed 时可用）',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  },

  self_diagnose: {
    name: 'self_diagnose',
    description: '返回当前插件和任务的诊断信息',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '可选，任务运行 ID' }
      }
    }
  },

  // ── 第二层：操作型 Tool（读写，被动响应）──

  create_plan: {
    name: 'create_plan',
    description: '创建 draft task，替代 [NEED_PLAN] 标记',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        prompt: { type: 'string', description: '用户原始输入（前500字）' },
        taskType: {
          type: 'string',
          enum: ['coding', 'research', 'documentation'],
          description: '任务类型（可选），影响默认阶段和 planning 模板选择'
        },
        planInput: {
          type: 'object',
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

  update_task_status: {
    name: 'update_task_status',
    description: '显式更新 task 状态，替代 [STATUS: xxx] 标记',
    inputSchema: {
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

  advance_phase: {
    name: 'advance_phase',
    description: '推进 task 到下一阶段',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        phaseId: { type: 'string', description: '可选，指定阶段 ID' }
      },
      required: ['runId']
    }
  },

  record_deviation: {
    name: 'record_deviation',
    description: '记录偏差到事件文件',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        type: { type: 'string', description: '偏差类型（如 scope_creep, technical_debt）' },
        description: { type: 'string', description: '偏差描述' },
        impact: { type: 'string', description: '影响评估' }
      },
      required: ['runId', 'type', 'description']
    }
  },

  record_attribution: {
    name: 'record_attribution',
    description: '记录归因到事件文件',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        rootCause: { type: 'string', description: '根本原因' },
        impact: { type: 'string', description: '影响范围' },
        strategy: { type: 'string', description: '改进策略' }
      },
      required: ['runId', 'rootCause', 'strategy']
    }
  },

  archive_task: {
    name: 'archive_task',
    description: '归档已完成的任务',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' }
      },
      required: ['runId']
    }
  }
};

/**
 * 工具分类
 */
export const QUERY_TOOLS = [
  'get_task_status',
  'get_task_files',
  'get_planning_guide',
  'get_monitoring_guide',
  'get_regulation_guide',
  'get_development_guide',
  'self_diagnose'
];

export const ACTION_TOOLS = [
  'create_plan',
  'update_task_status',
  'advance_phase',
  'record_deviation',
  'record_attribution',
  'archive_task'
];

export const ALL_TOOLS = [...QUERY_TOOLS, ...ACTION_TOOLS];
