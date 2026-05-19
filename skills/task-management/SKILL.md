---
name: task-management
description: >
  指导 Agent 使用 task.* 命名空间工具管理任务全生命周期。
  当 Agent 需要执行以下操作时触发本技能：
  (1) 根据用户需求在项目中执行任务，
  (2) 更新任务状态或记录偏差/归因/结果，
  (3) 推进多阶段任务的下一阶段，
  (4) 查询任务进度或历史状态，
  (5) 归档已完成的任务。
  如果仅涉及事件报告（生成 event.md），请使用 event-management 技能。
---

# 任务管理

通过 `task.*` 命名空间工具管理任务全生命周期。

## 5 个工具

| 工具 | 用途 | 触发时机 |
|------|------|----------|
| `task.create` | 创建 draft 任务 | 收到新需求，需要制定计划 |
| `task.update` | 通用更新入口 | 状态变更、记录偏差、记录归因、记录结果、关联事件文件 |
| `task.advance` | 推进阶段 | 当前阶段已完成 |
| `task.get` | 查询任务 | 需要查看进度或历史状态 |
| `task.archive` | 归档任务 | 任务已完成，清理活跃目录 |

## 核心工作流

### 创建任务

```
task.create({
  prompt: "用户需求",
  taskType?: "task | coding | research | documentation",
  planInput?: { goal, constraints, successCriteria, phases }
})
```

- `runId` 可省略，系统自动生成
- 返回 task JSON，向用户展示计划等待确认

### 推进阶段

```
task.advance({ runId, phaseId? })
```

- 检查返回的 `isComplete`：
  - `true` → 全部完成，进入结果记录 + 事件生成 + 归档
  - `false` → 继续下一阶段

### 记录偏差（通过 task.update）

```
task.update({
  runId,
  deviation: { type, description, impact? }
})
```

偏差类型：`scope_creep`（范围蔓延）、`technical_debt`（技术债务）、`output_mismatch`（输出不符）、`doc_lag`（文档滞后）、`context_loss`（上下文丢失）、`file_mismatch`（文件不匹配）、`other`

### 记录归因（通过 task.update）

```
task.update({
  runId,
  attribution: { rootCause, strategy, impact? }
})
```

### 记录结果（通过 task.update）

```
task.update({
  runId,
  outcome: { summary, artifacts?, metrics? }
})
```

### 状态转换

```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

所有状态变更通过 `task.update({ status })` 完成。

## 参考资料

- **详细工作流**：[references/workflow.md](references/workflow.md) — 包含完整参数示例的分步指南
- **数据结构**：[references/schema.md](references/schema.md) — 完整的 Task JSON 字段参考

## 关键规则

- **task.update 是唯一更新入口** — 所有变更（状态/偏差/归因/结果/事件路径）都通过它完成
- **不要直接读写 task.json** — 所有操作通过工具调用
- **归档不可逆** — task.json 移动到 `.agent/tasks/archive/`
- **task.get 支持双路径回退** — 先查活跃目录，再查归档目录
