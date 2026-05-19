---
name: task-management
description: >
  指导 Agent 使用 task.* 命名空间工具管理任务全生命周期。
  本技能是参考指南，Agent 根据当前情境自主决定何时调用哪个工具。
  触发情境：(1) 收到新任务需求，(2) 任务状态需要变更，(3) 需要查询任务进度，
  (4) 发现偏差或完成归因，(5) 任务完成需要归档。
---

# 任务管理技能（Task Management）

> 版本：v1.0.0（v4.3.0）
> 对应插件：agent-self-development v4.3.0+
> 架构：纯函数 Handler 直接读写 `.agent/tasks/{runId}.json`，无对象中间层

---

## 5 个 Task 工具

| 工具 | 功能 | 触发情境 |
|------|------|----------|
| `task.create` | 创建 draft task | 收到新需求，需要制定计划时 |
| `task.update` | **通用更新入口** | 状态变更 / 记录偏差 / 记录归因 / 记录结果 / 关联事件文件 |
| `task.advance` | 推进阶段 | 当前阶段完成，进入下一阶段 |
| `task.get` | 查询任务 | 需要了解任务当前进度或历史状态 |
| `task.archive` | 归档任务 | 任务 completed，清理活跃目录 |

---

## 工作流参考（Agent 自主决策）

### 创建任务

```
1. 评估任务复杂度 → 决定是否需要制定 Plan
2. 调用 task.create({
     prompt: "用户原始输入",
     taskType?: "task | coding | research | documentation",
     planInput?: { goal, constraints, successCriteria, phases }
   })
3. 获取返回的 task JSON，展示 plan 给用户确认
```

> `runId` 可省略，系统自动生成（格式：`{YYYYMMDD}-{后缀}`）

### 推进任务

```
1. 完成当前阶段工作
2. 调用 task.advance({ runId, phaseId? })
3. 检查返回的 isComplete：
   - true → 任务全部完成，进入结果记录 + 事件生成 + 归档流程
   - false → 继续下一阶段
```

### 记录偏差（通过 task.update）

```
1. 发现偏差（范围蔓延、技术债务、输出不符等）
2. 调用 task.update({
     runId,
     deviation: {
       type: "scope_creep | technical_debt | output_mismatch | doc_lag | context_loss | file_mismatch | other",
       description: "偏差描述",
       impact?: "影响评估"
     }
   })
3. 偏差追加到 task.json 的 deviations 数组
```

### 记录归因（通过 task.update）

```
1. 分析偏差根因
2. 调用 task.update({
     runId,
     attribution: {
       rootCause: "根本原因",
       strategy: "改进策略",
       impact?: "影响范围"
     }
   })
3. 归因追加到 task.json 的 attributions 数组
```

### 记录结果（通过 task.update）

```
1. 任务全部完成
2. 调用 task.update({
     runId,
     outcome: {
       summary: "完成摘要",
       artifacts?: ["产出文件路径"],
       metrics?: { 任意指标 }
     }
   })
```

### 状态转换

```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

| 转换 | 操作 |
|------|------|
| draft → pending_approval | `task.update({ status: "pending_approval" })` |
| pending_approval → active | `task.update({ status: "active" })` |
| pending_approval → revising | `task.update({ status: "revising" })` → 修改 plan → `task.update({ status: "draft" })` |
| active → completed | `task.advance()` 返回 isComplete=true，或 `task.update({ status: "completed" })` |
| completed → archived | `task.archive({ runId })` |

### 查询任务

```
1. 调用 task.get({ runId })
2. 系统先查 `.agent/tasks/{runId}.json`，找不到则回退到 `.agent/tasks/archive/{runId}.json`
3. 返回完整 task.json
```

---

## Task JSON 核心字段

```json
{
  "runId": "20260519-abc123",
  "status": "draft | pending_approval | active | revising | completed",
  "taskType": "task | coding | research | documentation",
  "createdAt": "2026-05-19T10:00:00.000Z",
  "updatedAt": "2026-05-19T10:00:00.000Z",
  "plan": {
    "prompt": "用户输入",
    "context": { "goal": "", "constraints": [], "successCriteria": [] },
    "execution": { "phases": [...], "currentPhase": 0 }
  },
  "deviations": [],
  "attributions": [],
  "outcome": {},
  "eventFilePath": ""
}
```

完整结构见 `references/task-schema.json`

---

## 注意事项

- **task.update 是唯一更新入口**：所有变更（status / deviation / attribution / outcome / eventFilePath）都通过它完成
- **无需直接读写 task.json**：所有操作通过工具调用，插件保证原子写入
- **归档不可逆**：`task.archive()` 将 task.json 移动到 `.agent/tasks/archive/`，活跃目录中不再可见
- **偏差与归因不强制关联**：v4.3.0 简化后不再维护 `attributed` / `attributionId` 关联字段

---

*技能版本：v1.0.0（v4.3.0）*
*维护者：Developer*
