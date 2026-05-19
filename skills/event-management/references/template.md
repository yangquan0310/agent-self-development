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

## 5. 回顾与调节（触发章节）

这是 event.md 的**关键触发章节**，专为事件生成后的人格调节设计。

### 内容来源

| 子章节 | 数据来源 |
|--------|---------|
| 5.1 偏差回顾 | `task.deviations[]` |
| 5.2 归因回顾 | `task.attributions[]` |
| 5.3 调节建议 | 模板固定文本（认知科学理论指引） |

### 触发机制

1. **工具层触发**：`event.report` 返回的 `reflectionPrompt` 明确提示 Agent 进行回顾
2. **文件层触发**：event.md 第 5 章为 Agent 提供结构化的回顾框架
3. **Agent 自主执行**：Agent 读取 event.md 后，自行决定是否及如何更新人格文件

### 人格更新目标文件

| 文件 | 更新内容 | 调节类型 |
|------|---------|---------|
| `SOUL.md` | 核心自我认知、能力边界、存在意义 | 顺应 |
| `IDENTITY.md` | 角色集、社会定位、责任范围 | 顺应 |
| `skills/README.md` | 技能体系、工具熟练度 | 同化/顺应 |
| `MEMORY.md` | If-Then 规则、操作习惯 | 同化 |

## 重要说明

- 模板源文件：`src/assets/event.md`
- 渲染为**一次性**操作，在任务完成时执行
- 生成后与 task.json 无实时关联
- 如需更新 event.md，修改 task.json 后重新执行 `event.report`
- event.report 会覆盖已存在的 event.md
- **"回顾与调节"章节是 v4.3.0 新增**，用于替代已移除的自动 personality 模块，改为 Agent 自主调节
