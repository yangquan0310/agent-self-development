# 事件文件模板参考

`.agent/events/{YYYY-MM-DD}/{runId}.md` 的结构说明，由 `event.report` 生成。

## 数据来源

所有数据来自生成时的 `task.json`，一次性渲染，无增量更新。

## 章节结构

### 1. 元信息

```markdown
# 事件：{runId}

- **状态**：{status}
- **类型**：{taskType}
- **创建时间**：{createdAt}
- **完成时间**：{updatedAt（如 status === completed）}
```

### 2. 计划

```markdown
## 计划

**目标**：{plan.context.goal}

**约束条件**：
- {约束条件1}
- {约束条件2}

**验收标准**：
- {验收标准1}
- {验收标准2}

**阶段**：
| ID | 名称 | 目标 | 状态 |
|----|------|------|------|
| p1 | {名称} | {目标} | completed |
| p2 | {名称} | {目标} | pending |
```

### 3. 执行

```markdown
## 执行

**已完成阶段**：{完成数} / {总数}
**当前阶段**：{currentPhase + 1}

阶段完成状态取自 `plan.execution.phases[].status`。
```

### 4. 偏差

```markdown
## 偏差

### {deviation.type} — {deviation.timestamp}
{deviation.description}

**影响**：{deviation.impact}
```

每个 `task.deviations[]` 条目生成一节。

### 5. 归因

```markdown
## 归因

### 归因 — {attribution.timestamp}
**根本原因**：{attribution.rootCause}
**改进策略**：{attribution.strategy}

**影响**：{attribution.impact}
```

每个 `task.attributions[]` 条目生成一节。

### 6. 结果

```markdown
## 结果

**摘要**：{outcome.summary}

**产出**：
- {产出文件1}
- {产出文件2}

**指标**：
{outcome.metrics}
```

## 重要说明

- 模板源文件：`src/assets/event.md`
- 渲染为**一次性**操作，在任务完成时执行
- 生成后与 task.json 无实时关联
- 如需更新 event.md，修改 task.json 后重新执行 `event.report`
- event.report 会覆盖已存在的 event.md
