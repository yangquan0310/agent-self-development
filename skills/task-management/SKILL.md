---
name: task-management
description: >
  指导 Agent 使用 task.* 命名空间工具管理任务（Task）全生命周期。
  当 Agent 需要创建任务、更新任务状态、推进阶段、查询任务信息、
  记录偏差/归因、归档任务时，使用此技能。
  触发条件：(1) 用户要求完成项目TODO中的任务，(2) Agent 需要记录任务状态变更，
  (3) 需要查询 task.json 状态，(4) 需要记录偏差(deviate)或归因(attribute)。
---

# 任务管理技能（Task Management）

> 版本：v1.0.0
> 对应插件：agent-self-development v4.3.0+

## 核心对象：TaskObject

TaskObject 是 `task.json` 的唯一写入者。所有任务状态变更必须通过 task.* 工具调用，Agent 不得直接读写 task.json 文件。

## 工具清单（9 个）

| 工具 | 用途 | 触发场景 |
|------|------|----------|
| `task.create` | 创建 draft 任务 | 收到新需求，需要制定计划时 |
| `task.update` | 更新任务状态 | 任务状态变更（draft→active→completed） |
| `task.advance` | 推进阶段 | 完成当前阶段，进入下一阶段 |
| `task.query` | 查询任务状态 | 需要了解任务当前进度 |
| `task.files` | 获取关联文件 | 需要查看任务涉及的所有文件 |
| `task.diagnose` | 诊断任务 | 检查任务健康度、风险预警 |
| `task.archive` | 归档任务 | 任务完成，需要归档到 archive/ |
| `task.deviate` | 记录偏差 | 发现范围蔓延、技术债务等偏差 |
| `task.attribute` | 记录归因 | 分析偏差根因，制定改进策略 |

## 标准工作流

### 创建任务
```
1. 评估任务复杂度 → 决定是否需要制定 Plan
2. 调用 task.create({
     runId: "uuid",
     prompt: "用户原始输入",
     taskType: "coding | research | documentation",
     planInput: { goal, constraints, successCriteria, phases }
   })
3. 获取返回的 task JSON，展示给用户确认
```

### 推进任务
```
1. 完成当前阶段工作
2. 调用 task.advance({ runId, phaseId? })
3. 检查 isComplete，若 true 则进入归档流程
```

### 记录偏差
```
1. 发现偏差（范围蔓延、技术债务等）
2. 调用 task.deviate({
     runId,
     type: "scope_creep | technical_debt | ...",
     description: "偏差描述",
     impact: "影响评估（可选）"
   })
3. 偏差自动存入 task.json 的 deviations 数组
```

### 记录归因
```
1. 分析偏差根因
2. 调用 task.attribute({
     runId,
     rootCause: "根本原因",
     strategy: "改进策略",
     impact: "影响范围（可选）"
   })
3. 归因自动存入 task.json 的 attributions 数组
4. 系统自动标记相关偏差为已归因（attributed: true）
```

## 数据结构参考

Task JSON 完整结构见 `references/task-schema.json`

核心字段：
- `runId` — 任务唯一标识
- `status` — draft | pending_approval | active | revising | completed
- `plan` — 包含 prompt, context, workspace, execution(phases)
- `deviations` — 偏差记录数组
- `attributions` — 归因记录数组
- `outcome` — 结果摘要

## 注意事项

- 每个阶段推进后，currentPhase 自动递增
- 归档前必须先 completed，否则报错
- 偏差和归因必须通过工具调用记录，不得直接修改 task.json
- diagnose 返回 cognitiveTraceSummary 和 trendAnalysis，用于风险预警
