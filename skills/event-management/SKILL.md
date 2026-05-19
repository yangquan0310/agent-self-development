---
name: event-management
description: >
  指导 Agent 使用 event.* 命名空间工具管理事件文件生命周期。
  本技能是参考指南，Agent 根据当前情境自主决定何时调用哪个工具。
  触发情境：(1) 任务完成后生成事件总结，(2) 需要查询历史事件记录，
  (3) 事件文件需要归档。
---

# 事件管理技能（Event Management）

> 版本：v1.0.0（v4.3.0）
> 对应插件：agent-self-development v4.3.0+
> 架构：纯函数 Handler 直接读写 `.agent/events/` 和 `.agent/events/archive/`

---

## 3 个 Event 工具

| 工具 | 功能 | 触发情境 |
|------|------|----------|
| `event.report` | **生成事件文件** | 任务 completed，需要从 task.json 凝练生成 event.md |
| `event.query` | 查询事件 | 需要回顾历史偏差、归因或任务总结 |
| `event.archive` | 归档事件 | 事件文件已生成且不再需要频繁访问 |

---

## 工作流参考（Agent 自主决策）

### 生成事件文件（核心操作）

```
1. 任务全部完成（status === "completed"）
2. 调用 event.report({ runId })
   - 系统读取对应 task.json（活跃目录 → 归档目录回退）
   - 使用模板渲染 event.md
   - 写入 `.agent/events/{YYYY-MM-DD}/{runId}.md`
   - 自动回写 eventFilePath 到 task.json
3. 获取返回的 eventFilePath
```

**event.report 的业务规则**：
- task.status 必须是 `completed`，否则拒绝生成
- 日期由 `task.createdAt` 解析为 `YYYY-MM-DD`
- 一次性渲染，非增量追加
- 成功后自动关联：task.json 的 `eventFilePath` 字段被更新

### 事件文件内容（由模板渲染）

event.md 包含以下章节：
1. **Metadata** — runId, status, taskType, createdAt, completedAt
2. **Plan** — goal, constraints, successCriteria, phases
3. **Execution** — 各 phase 实际完成状态
4. **Deviation** — 偏差记录汇总
5. **Attribution** — 归因记录汇总
6. **Outcome** — 最终结果摘要

完整模板见 `references/event-template.md`

### 查询事件

```
1. 调用 event.query({ runId?, date?, type? })
   - runId: 精确匹配任务 ID
   - date: YYYY-MM-DD 格式
   - type: "deviation" | "attribution"（可选，按记录类型筛选）
2. 返回匹配的事件列表
```

### 归档事件

```
1. 事件文件已生成且不再需要频繁访问
2. 调用 event.archive({ runId })
3. 系统移动 event.md 到 `.agent/events/archive/{date}-{runId}.md`
```

---

## 事件与任务的协作关系

```
task.create({ prompt }) → 生成 task.json
   ↓
[task execution: task.advance / task.update(deviation) / task.update(attribution)]
   ↓
task.advance() 返回 isComplete=true → task.update({ status: "completed" })
   ↓
event.report({ runId }) → 从 task.json 生成 event.md
   ↓
[可选] event.archive({ runId }) → 归档 event.md
   ↓
task.archive({ runId }) → 归档 task.json
```

**关键时序**：
- `event.report` 应在 `task.archive` 之前调用（task.json 还在活跃目录，读取更方便）
- `event.report` 成功后 `eventFilePath` 自动回写到 task.json
- `task.get` 支持双路径回退：先查活跃目录，再查归档目录

---

## 文件路径规则

| 类型 | 活跃路径 | 归档路径 |
|------|---------|---------|
| 任务 | `.agent/tasks/{runId}.json` | `.agent/tasks/archive/{runId}.json` |
| 事件 | `.agent/events/{YYYY-MM-DD}/{runId}.md` | `.agent/events/archive/{date}-{runId}.md` |

---

## 注意事项

- **事件文件不增量追加**：v4.3.0 采用延迟一次性生成策略。执行期间的偏差/归因只写入 task.json，任务完成后由 `event.report` 统一凝练
- **无需手动创建 event.md**：event.report 负责从模板渲染，Agent 不应直接写 event.md
- **event.report 自动关联**：成功后自动更新 task.json 的 `eventFilePath`，无需额外调用 task.update
- **查询只读**：event.query 不修改任何文件

---

*技能版本：v1.0.0（v4.3.0）*
*维护者：Developer*
