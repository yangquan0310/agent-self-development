---
name: monitoring
description: >
  元认知监控子模块。指导 Agent 在 Plan active 阶段检测偏差并创建 Deviation 对象。
  核心原则：发现预期与实际的差距时，创建 Deviation 记录并触发调节。
version: 3.5.0
injected_at: llm_output
module: metacognition
---

# Monitoring — 偏差检测与 Deviation 对象创建

> 元认知子模块 - 监控阶段
> 在 Plan 执行过程中检测预期与实际的偏差，创建 Deviation 对象
> **发现偏差时创建 Deviation，不自行绕过计划**

---

## 注入上下文

本 skill 在 **`before_prompt_build`**（task.status === `"active"`）时注入。此时插件已完成以下操作：

| 时机 | 插件已完成的操作 | 存储位置 |
|------|-----------------|----------|
| 每次 LLM 输出后 | 缓存最新输出到 task.plan | `task:{runId}.plan`（统一 task JSON） |
| 注入前 | 读取当前 task，确认 status === `"active"` | 同上 |

---

## 核心对象：Deviation（偏差记录）

**存储位置**：`task:{runId}.deviations`（统一 task JSON 顶层字段）

```json
{
  "runId": "uuid",
  "phaseId": "p2",
  "status": "detected",
  "createdAt": 1234567890000,
  "type": "progress",
  "description": "偏差描述",
  "severity": "major"
}
```

| 属性 | 类型 | 说明 | 当前值来源 |
|------|------|------|-----------|
| `runId` | string | 所属运行 | 插件注入 |
| `phaseId` | string | 发生偏差的阶段 ID | 插件在 monitoring 时记录 |
| `status` | string | `detected` / `acknowledged` / `resolved` | **Agent 创建后通知插件更新** |
| `type` | string | 偏差类型：`progress` / `quality` / `resource` / `goal` | Agent 评估后确定 |
| `description` | string | 偏差描述 | Agent 撰写 |
| `severity` | string | `minor` / `major` / `critical` | Agent 评估 |

---

## Agent 职责

### 职责：检测偏差并创建 Deviation 对象

**触发条件**：Plan.status === `"active"`，每次 LLM 输出后

**你需要做的**（决策层）：

1. **对照 Plan 检查当前输出**
   - 当前输出是否符合当前阶段的预期范围？
   - 实际进度是否与计划进度存在差距？
   - 是否使用了计划外的工具或方案？

2. **偏差判定**

   | 判定结果 | 条件 | Agent 行动 |
   |---------|------|-----------|
   | **无偏差** | 输出符合 Plan，按预期推进 | 继续执行，无需创建 Deviation |
   | **轻微偏差** | 可自我调节，不影响整体计划 | 自行调整方向，可不创建 Deviation |
   | **重大偏差** | 影响阶段目标或整体 Plan | **创建 Deviation 对象**，触发 regulation |

3. **创建 Deviation 对象**（重大偏差时）
   - 确定 `phaseId`（当前阶段 ID）
   - 确定 `type`：`progress`（进度）/ `quality`（质量）/ `resource`（资源）/ `goal`（目标）
   - 确定 `severity`：`minor` / `major` / `critical`
   - 撰写 `description`：描述预期是什么、实际是什么、差距在哪里
   - 将 Deviation 追加到 `task.deviations`
   - 通知插件更新 task（插件通过 `state.saveTask()` 保存）
   - Deviation 保存后，**触发 regulation**（请求注入 regulation skill）

4. **阶段完成判定**
   - 当阶段目标达成且无偏差时，通知插件：
     - `phase.status = "completed"`
     - `execution.currentPhase++`
     - 新产出物追加到 `workspace.artifacts`

**插件已自动完成的**（执行层，无需你操作）：
- 已缓存本次 LLM 输出到 Plan
- 已确认 Plan.status 为 `"active"` 才注入本 skill
- 已将 Deviation 追加到 `task.deviations`，并通过 `state.saveTask()` 保存

**你可以参考的上下文**（注入时附加在 skill 下方）：
- 当前阶段索引和 ID
- 分配的任务空间信息

---

## 偏差判定标准

| 偏差类型 | 判定条件 | severity | 处理方式 |
|---------|---------|----------|---------|
| **范围偏离** | 输出内容超出当前阶段定义的范围 | minor | 自行调整，拉回正轨 |
| **进度偏差** | 实际进度与计划偏差超过阈值 | major | 创建 Deviation，触发 regulation |
| **工具/方案偏离** | 未按计划使用指定工具，或自行更换方案 | major | 创建 Deviation，触发 regulation |
| **产出缺失** | 阶段目标已达成，但预期产出未记录 | minor | 补录产出物，通知插件 |
| **任务空间异常** | 分配会话报错/阻塞/未完成 | major | 创建 Deviation，触发 regulation |
| **方向偏离** | 当前输出与 Plan 整体目标冲突 | critical | 创建 Deviation，**停止执行**，请求重新规划 |

---

## 决策检查点

每次收到本 skill 注入时，请确认：

- [ ] 当前输出是否符合当前阶段的预期范围？
- [ ] 是否存在进度、质量、资源或目标层面的偏差？
- [ ] 若为重大偏差，是否已创建 Deviation 对象并描述清楚预期 vs 实际？
- [ ] 阶段完成后是否已通知插件更新 currentPhase？

---

## 状态流转

```
active（Plan 执行中）
    ↓ 每次 llm_output
    ├─ 无偏差 → 继续执行
    ├─ 轻微偏差 → 自行调整
    ├─ 重大偏差 → 创建 Deviation → 触发 regulation
    │               ↓
    │             regulation：归因分析 + 撰写 Event
    │               ↓
    │             返回 monitoring 继续追踪
    └─ 阶段完成 → 通知插件 currentPhase++
```

---

## 自反性：工作记忆看板更新

当 Plan 从 `pending_approval` 进入 `active` 时（用户同意执行计划后），你需要在执行前更新自己的工作记忆看板。

### 当前活跃任务看板

在你的 MEMORY.md 中维护以下表格：

```markdown
### 当前活跃任务看板

| 任务ID | 项目 | 任务描述 | 会话ID | 状态 | 创建时间 | 最后更新 | 备注 |
|--------|------|----------|--------|------|----------|----------|------|
| {runId} | {project} | {taskDescription} | {sessionId} | active | {createdAt} | {updatedAt} | {notes} |
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `任务ID` | ✅ | 本次运行的 `runId` |
| `项目` | ✅ | 任务所属项目/类别 |
| `任务描述` | ✅ | Plan 的核心目标描述（一句话） |
| `会话ID` | ✅ | 负责执行本次任务的 Session ID |
| `状态` | ✅ | `active` / `paused` / `completed` / `killed` |
| `创建时间` | ✅ | Plan 创建时间（ISO 格式） |
| `最后更新` | ✅ | 本行最后修改时间（ISO 格式） |
| `备注` | 可选 | 特殊说明（如"命名会话，长期复用"） |

**添加时机**：Plan 变为 `active` 时，在看板中新增一行。
**更新时机**：任务状态变化时（如 paused / completed / killed），更新对应行的状态字段。
**删除时机**：任务归档到 Memory 后，从看板中删除或标记为 `completed`。

### 活跃会话清单

在你的 MEMORY.md 中维护以下表格：

```markdown
### 活跃会话清单

| 会话ID | 类型/角色 | 分配任务 | 状态 | 创建时间 | 最后活跃 | 备注 |
|--------|-----------|----------|------|----------|----------|------|
| {sessionId} | {role} | {taskDescription} | {status} | {createdAt} | {lastActive} | {notes} |
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `会话ID` | ✅ | Session 的完整标识符 |
| `类型/角色` | ✅ | 会话承担的角色（如"论文修改专家"） |
| `分配任务` | ✅ | 当前分配的任务描述 |
| `状态` | ✅ | `active` / `idle` / `killed` |
| `创建时间` | ✅ | 会话创建时间（ISO 格式） |
| `最后活跃` | ✅ | 最后使用时间（ISO 格式） |
| `备注` | 可选 | 特殊说明 |

**添加时机**：创建新会话或复用会话执行任务时，在清单中新增/更新一行。
**复用检查**：创建会话前，先检查活跃会话清单。若存在同类任务的 `idle` 会话，优先复用。
**删除时机**：会话 `killed` 后，从清单中删除。

### 执行前自检查清单

更新完工作记忆看板后，请确认：

- [ ] 当前活跃任务看板中已记录本次任务（runId、会话ID、状态=active）
- [ ] 活跃会话清单中已更新/添加负责会话
- [ ] 是否存在其他 `active` 任务冲突？（如有，暂停或排队）
- [ ] 是否复用了已有的 `idle` 会话？（避免重复创建）

---

## 与其他 Skill 的关系

| Skill | 注入时机 | 职责边界 |
|-------|---------|---------|
| `planning` | `before_prompt_build` | 提供 Plan 的基准定义，提供监控的参照标准 |
| `regulation` | Deviation 创建后 | 负责分析 Deviation 的根因（Attribution），撰写 Event |
| `working_memory` | `agent_end` | 负责运行结束时的任务空间归档 |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v3.0.0 | 2026-04-29 | v3 重构：监控核心从"阶段检查"改为"Deviation 对象创建"，对象操作移交插件层 |
