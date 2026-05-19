---
name: event-management
description: >
  指导 Agent 使用 event.* 命名空间工具管理事件文件生命周期。
  当 Agent 需要执行以下操作时触发本技能：
  (1) 任务完成后生成事件总结报告，
  (2) 查询历史事件记录，
  (3) 归档不再需要频繁访问的事件文件。
  如果涉及任务的创建或更新，请使用 task-management 技能。
---

# 事件管理

通过 `event.*` 命名空间工具管理事件文件生命周期。

## 3 个工具

| 工具 | 用途 | 触发时机 |
|------|------|----------|
| `event.report` | 生成事件文件 | 任务已完成，需要从 task.json 凝练生成事件总结 |
| `event.query` | 查询事件 | 回顾历史偏差、归因或任务总结 |
| `event.archive` | 归档事件 | 事件文件不再需要频繁访问 |

## 核心工作流

### 生成事件报告

```
1. 确认任务状态为 "completed"
2. 调用 event.report({ runId })
   - 读取对应 task.json（活跃目录 → 归档目录回退）
   - 使用模板渲染 event.md
   - 写入 `.agent/events/{YYYY-MM-DD}/{runId}.md`
   - 自动回写 eventFilePath 到 task.json
3. 返回 { eventFilePath }
```

要求：
- `task.status === "completed"`，否则拒绝生成
- 一次性生成，非增量追加

### 查询事件

```
event.query({ runId?, date?, type? })
```

- `runId`：精确匹配任务 ID
- `date`：YYYY-MM-DD 格式
- `type`：`"deviation"` | `"attribution"`（可选筛选）

### 归档事件

```
event.archive({ runId })
```

- 移动 event.md 到 `.agent/events/archive/{日期}-{runId}.md`

## 任务与事件的协作关系

```
task.create → [执行：task.advance / task.update] → 任务完成
  → event.report({ runId }) → [可选] event.archive({ runId })
  → task.archive({ runId })
```

**时机建议**：在 `task.archive` 之前调用 `event.report`，此时 task.json 仍在活跃目录中便于读取。

## 参考资料

- **详细工作流**：[references/workflow.md](references/workflow.md) — 事件报告内部流程、查询模式、归档规则
- **事件模板**：[references/template.md](references/template.md) — event.md 结构说明和渲染规则

## 关键规则

- **一次性生成**：event.report 从当前 task.json 状态完整渲染 event.md
- **不增量追加**：执行期间所有数据写入 task.json，完成后一次性生成事件文件
- **自动关联**：event.report 自动将 eventFilePath 回写到 task.json
- **只读查询**：event.query 不修改任何文件
