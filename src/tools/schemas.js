/**
 * Tool Schemas — v4.3.0
 *
 * 8 个命名空间工具的 TypeBox Schema 定义。
 */

import { Type } from '@sinclair/typebox';

export const TOOL_SCHEMAS = {
  'task.create': {
    name: 'task.create',
    description: '创建 draft task',
    parameters: Type.Object({
      runId: Type.Optional(Type.String({ description: '任务运行 ID（可选，默认自动生成）' })),
      prompt: Type.String({ description: '用户原始输入（前 500 字）' }),
      taskType: Type.Optional(Type.Union([
        Type.Literal('task'),
        Type.Literal('coding'),
        Type.Literal('research'),
        Type.Literal('documentation')
      ], { description: '任务类型（可选，默认 task）' })),
      planInput: Type.Optional(Type.Object({
        goal: Type.Optional(Type.String()),
        constraints: Type.Optional(Type.Array(Type.String())),
        successCriteria: Type.Optional(Type.Array(Type.String())),
        phases: Type.Optional(Type.Array(Type.Object({
          id: Type.Optional(Type.String()),
          name: Type.String(),
          goal: Type.Optional(Type.String()),
          outputs: Type.Optional(Type.Array(Type.String())),
          status: Type.Optional(Type.Union([
            Type.Literal('pending'),
            Type.Literal('in_progress'),
            Type.Literal('completed')
          ]))
        })))
      }, { description: '可选，Agent 提供的完整计划输入' }))
    })
  },

  'task.update': {
    name: 'task.update',
    description: '更新 task 状态、偏差、归因、结果或事件路径',
    parameters: Type.Object({
      runId: Type.String({ description: '任务运行 ID' }),
      status: Type.Optional(Type.Union([
        Type.Literal('draft'),
        Type.Literal('pending_approval'),
        Type.Literal('active'),
        Type.Literal('revising'),
        Type.Literal('completed')
      ], { description: '新状态（可选）' })),
      deviation: Type.Optional(Type.Object({
        type: Type.String({ description: '偏差类型（如 scope_creep, technical_debt）' }),
        description: Type.String({ description: '偏差描述' }),
        impact: Type.Optional(Type.String({ description: '影响评估（可选）' })),
        timestamp: Type.Optional(Type.String({ description: 'ISO 时间戳（可选，默认当前时间）' }))
      }, { description: '可选，偏差记录' })),
      attribution: Type.Optional(Type.Object({
        rootCause: Type.String({ description: '根本原因' }),
        strategy: Type.String({ description: '改进策略' }),
        impact: Type.Optional(Type.String({ description: '影响范围（可选）' })),
        timestamp: Type.Optional(Type.String({ description: 'ISO 时间戳（可选，默认当前时间）' }))
      }, { description: '可选，归因记录' })),
      outcome: Type.Optional(Type.Object({
        summary: Type.Optional(Type.String()),
        artifacts: Type.Optional(Type.Array(Type.String())),
        metrics: Type.Optional(Type.Record(Type.String(), Type.Any()))
      }, { description: '可选，任务结果' })),
      eventFilePath: Type.Optional(Type.String({ description: '可选，关联事件文件路径' })),
      reason: Type.Optional(Type.String({ description: '变更原因（可选）' }))
    })
  },

  'task.advance': {
    name: 'task.advance',
    description: '推进 task 到下一阶段',
    parameters: Type.Object({
      runId: Type.String({ description: '任务运行 ID' }),
      phaseId: Type.Optional(Type.String({ description: '可选，指定阶段 ID' }))
    })
  },

  'task.get': {
    name: 'task.get',
    description: '查询指定 runId 的完整 Task JSON 状态',
    parameters: Type.Object({
      runId: Type.String({ description: '任务运行 ID' })
    })
  },

  'task.archive': {
    name: 'task.archive',
    description: '归档已完成的任务',
    parameters: Type.Object({
      runId: Type.String({ description: '任务运行 ID' })
    })
  },

  'event.report': {
    name: 'event.report',
    description: '任务完成后一次性从 task.json 生成 event.md',
    parameters: Type.Object({
      runId: Type.String({ description: '任务运行 ID' })
    })
  },

  'event.query': {
    name: 'event.query',
    description: '查询事件记录，支持按 runId、日期、类型筛选',
    parameters: Type.Object({
      runId: Type.Optional(Type.String({ description: '可选，精确匹配任务 ID' })),
      date: Type.Optional(Type.String({ description: '可选，YYYY-MM-DD' })),
      type: Type.Optional(Type.Union([
        Type.Literal('deviation'),
        Type.Literal('attribution')
      ], { description: '可选，记录类型' }))
    })
  },

  'event.archive': {
    name: 'event.archive',
    description: '归档事件文件（移动 event.md 到 archive 目录）',
    parameters: Type.Object({
      runId: Type.String({ description: '任务运行 ID' })
    })
  }
};

export const ALL_TOOLS = Object.keys(TOOL_SCHEMAS);
