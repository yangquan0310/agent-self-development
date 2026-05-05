---
name: regulation
description: >
  元认知调节子模块。指导 Agent 在 Deviation 创建后分析根因（Attribution）、
  制定调节方案，并将偏差和归因记录到 task 顶层字段。
version: 3.5.0
injected_at: Deviation 创建后触发
module: metacognition
---

# Regulation — 归因分析与 Event 记录

> 元认知子模块 - 调节阶段
> 在 Monitoring 创建 Deviation 后，分析根因、制定调节方案、记录到 task 顶层字段
> **先归因分析，再记录到 task 顶层字段；重大偏差需请示用户**

---

## 注入上下文

本 skill 在 **Monitoring 创建 Deviation 后** 触发。此时插件已完成以下操作：

| 时机 | 插件已完成的操作 | 存储位置 |
|------|-----------------|----------|
| Deviation 创建后 | 将 Deviation 追加到 `task.deviations` | `task:{runId}.deviations` |
| 注入前 | 将 Attribution 骨架追加到 `task.attributions` | `task:{runId}.attributions` |

当前 Deviation 和 Attribution 对象已由插件创建并保存在统一 task JSON 中，Agent 负责分析内容并做出决策。

---

## 核心对象（统一 task JSON 顶层字段）

### Deviation（偏差记录，由 Monitoring 阶段创建）

**存储位置**：`task:{runId}.deviations`（统一 task JSON 顶层字段）

```json
{
  "deviationId": "dev-xxx",
  "runId": "uuid",
  "phaseId": "p2",
  "status": "detected",
  "type": "progress",
  "description": "实际进度落后于计划 30%",
  "severity": "major"
}
```

### Attribution（归因分析）

**存储位置**：`task:{runId}.attributions`（统一 task JSON 顶层字段）

```json
{
  "attributionId": "attr-xxx",
  "runId": "uuid",
  "deviationId": "dev-xxx",
  "status": "analyzing",
  "rootCause": "根因分析",
  "adjustmentPlan": {
    "strategy": "调节策略",
    "actions": ["行动1", "行动2"]
  }
}
```

### Event 记录方式

v3.5.0 中不再使用 `task.event` 嵌套结构。偏差和归因直接保存在 task 顶层字段中，任务结束时由插件自动归档到 Memory。

**Agent 只需**：
1. 更新 `task.deviations[i].status`
2. 更新 `task.attributions[i].rootCause` / `adjustmentPlan` / `status`
3. 如有计划修订，追加到 `task.planRevisions`（如存在该字段）

---

## Agent 职责

### 职责 A：归因分析（detected → acknowledged）

**触发条件**：Deviation.status === `"detected"`

**你需要做的**（决策层）：

1. **阅读 Deviation 记录**
   - 从 `task.deviations` 中找到最新创建的偏差
   - 了解偏差发生的阶段（`phaseId`）、类型（`type`）、严重度（`severity`）

2. **根因分析**
   - **计划问题**：Plan 制定不合理？阶段划分有误？任务空间分配不当？
   - **执行问题**：Agent 偏离了 Plan？工具使用错误？会话执行异常？
   - **外部因素**：用户需求变化？资源不足？环境异常？

3. **制定调节方案**

   | 方案 | 适用场景 | 操作 |
   |------|---------|------|
   | **A. 调整 Plan** | 计划本身不合理 | 增删改 phases、重新分配任务空间、回到 pending_approval 重新汇报 |
   | **B. 调整执行** | 执行偏离但计划合理 | 修正当前输出方向、重新执行当前阶段 |
   | **C. 请求用户介入** | critical 级别或需求变更 | 向用户汇报偏差和根因，提供选项，等待决策 |

4. **记录归因分析到 task 顶层字段**
   - 更新对应 Attribution 的 `rootCause`（根因分析）
   - 更新对应 Attribution 的 `adjustmentPlan`（调节策略 + 具体行动）
   - 将 Attribution.status 更新为 `"completed"`
   - 将 Deviation.status 更新为 `"acknowledged"`

**插件已自动完成的**（执行层，无需你操作）：
- 已将 Deviation 追加到 `task.deviations`
- 已将 Attribution 骨架追加到 `task.attributions`

---

### 职责 B：执行调节并更新 Event（acknowledged → resolved）

**触发条件**：归因分析已完成，调节方案已制定

**你需要做的**（决策层）：

1. **执行调节方案**
   - 若方案 A（调整 Plan）：修改 Plan 后向用户汇报（如为 major/critical），获得确认后通知插件更新
   - 若方案 B（调整执行）：修正当前输出，重新推进当前阶段
   - 若方案 C（用户介入）：向用户清晰呈现偏差、根因、选项，等待决策

2. **记录计划修订到 task 顶层字段**（如需调整 Plan）

   如有 Plan 调整，追加到 `task.planRevisions`（如存在该字段）：

   ```json
   {
     "phaseId": "p2",
     "reason": "阶段目标过于宽泛，需拆分为两个子阶段",
     "changes": ["新增 p2a: 细化接口设计", "修改 p2: 收窄目标范围"],
     "timestamp": "2026-04-29T10:00:00Z"
   }
   ```

3. **完成偏差处理**
   - 将 Deviation.status 更新为 `"resolved"`
   - 将 Attribution.status 更新为 `"executed"`
   - 无需调用 `events.record()`，所有记录已在 task 顶层字段中

**插件已自动完成的**（执行层，无需你操作）：
- 统一 task JSON 的保存由插件在 agent_end 时自动完成

---

## 决策检查点

在 regulation 阶段结束时，请确认：

- [ ] Deviation 的根因是否已明确区分"计划问题"和"执行问题"？
- [ ] 调节方案是否已权衡成本、风险和收益？
- [ ] 若为 major/critical 级别，是否已向用户汇报并获得确认？
- [ ] Attribution 是否已填写 rootCause 和 adjustmentPlan？
- [ ] Deviation 和 Attribution 的 status 是否已正确更新？
- [ ] 如有 Plan 调整，是否已追加到 `task.planRevisions`？

---

## 状态流转

```
Monitoring 检测到重大偏差
    ↓ 插件自动追加 Deviation + Attribution 到 task 顶层字段
detected
    ↓ Agent 完成根因分析 + 制定调节方案
acknowledged
    ├─ 执行调节方案（调整 Plan / 调整执行 / 用户介入）
    ↓ Agent 更新 task 顶层字段中的 status 和 planRevisions
resolved（Deviation）/ executed（Attribution）
    ↓ 插件在 agent_end 时自动归档 task → Memory
    ↓ 返回 Monitoring 继续追踪 / 或返回 Planning 重新汇报
```

---

## 与其他 Skill 的关系

| Skill | 注入时机 | 职责边界 |
|-------|---------|---------|
| `planning` | `before_prompt_build` | 提供 Plan 基准，调节后可能需要回到 planning 重新汇报 |
| `monitoring` | `llm_output` | 负责检测偏差并创建 Deviation，触发本 skill 的介入 |
| `development` | `before_prompt_build`（completed）| 任务完成后基于 task 分析同化/顺应 |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v3.5.0 | 2026-05-04 | 移除 task.event 嵌套结构；偏差/归因改为 task 顶层字段；planRevisions 直接追加到 task 顶层 |
| v3.0.0 | 2026-04-29 | v3 重构：调节核心从"方案制定"扩展为"Attribution + Event 撰写" |
