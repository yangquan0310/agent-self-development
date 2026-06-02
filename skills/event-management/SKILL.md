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
| `event_report` | 生成事件文件 | 任务已完成，需要从 task.json 凝练生成事件总结 |
| `event_query` | 查询事件 | 回顾历史偏差、归因或任务总结 |
| `event_archive` | 归档事件 | 事件文件不再需要频繁访问 |

## 核心工作流

### 事件生成后的人格调节（重要）

`event_report` 成功后会返回 `reflectionPrompt`，提示 Agent 执行六维度平衡性判断。

**调节闭环**：

```
event_report({ runId }) → 生成 event.md（含"回顾与调节"章节）
  → Agent 读取 event.md 中的计划/执行/偏差/归因/结果
  → 六维度平衡性判断（自我认知、风格、信念、身份、程序性记忆、技能）
  → 对比现有结构与本次经验 → 判断是否不平衡
  → 如不平衡：决定同化（修改细化）或顺应（增加创建）
  → Agent 直接更新对应人格文件
```

**同化**：新经验与现有结构兼容 → **修改/细化**原有内容
**顺应**：新经验与现有结构冲突 → **增加/创建**新内容

详见 [references/workflow.md](references/workflow.md) 六维度平衡性判断表。

### 生成事件报告

```
1. 确认任务状态为 "completed"
2. 调用 event_report({ runId })
   - 读取对应 task.json（活跃目录 → 归档目录回退）
   - 使用模板渲染 event.md
   - 写入 `.agentsevents/{YYYY-MM-DD}/{runId}.md`
   - 自动回写 eventFilePath 到 task.json
3. 返回 { eventFilePath }
```

要求：
- `task.status === "completed"`，否则拒绝生成
- 一次性生成，非增量追加

### 查询事件

```
event_query({ runId?, date?, type? })
```

- `runId`：精确匹配任务 ID
- `date`：YYYY-MM-DD 格式
- `type`：`"deviation"` | `"attribution"`（可选筛选）

### 归档事件

```
event_archive({ runId })
```

- 移动 event.md 到 `.agentsevents/archive/{日期}-{runId}.md`

## 任务与事件的协作关系

```
task_create → [执行：task_advance / task_update] → 任务完成
  → event_report({ runId }) → [可选] event_archive({ runId })
  → task_archive({ runId })
```

**时机建议**：在 `task_archive` 之前调用 `event_report`，此时 task.json 仍在活跃目录中便于读取。

## 参考资料

- **详细工作流**：[references/workflow.md](references/workflow.md) — 事件报告内部流程、查询模式、归档规则
- **事件模板**：[references/template.md](references/template.md) — event.md 结构说明和渲染规则

## 关键规则

- **一次性生成**：event_report 从当前 task.json 状态完整渲染 event.md
- **不增量追加**：执行期间所有数据写入 task.json，完成后一次性生成事件文件
- **自动关联**：event_report 自动将 eventFilePath 回写到 task.json
- **只读查询**：event_query 不修改任何文件
