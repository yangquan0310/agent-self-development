---
name: planning
description: >
  元认知计划子模块。指导 Agent 评估任务复杂度、决定是否需要 Plan、
  制定 Plan、向用户汇报并等待确认。
  核心原则：Plugin asks, Agent decides, User confirms —— 插件不替 Agent 判断
version: 3.5.0
injected_at: before_prompt_build
module: metacognition
---

# Planning — 任务评估、计划制定与确认

> 元认知子模块 - 计划阶段
> Plan 不是步骤列表，而是一套完整的上下文语境
> **Plugin asks, Agent decides, User confirms**

---

## 注入上下文

本 skill 在 **`before_prompt_build`** 触发时注入。**根据当前 task 是否存在，你的职责不同**：

| 时机 | 当前状态 | 你的职责 |
|------|---------|---------|
| 无 task | 首次评估 | 评估任务复杂度，询问用户是否需要 Plan |
| task=draft | Plan 草稿已创建 | 制定完整 Plan 并汇报 |
| task=pending_approval | 等待用户确认 | 处理用户反馈（确认/修改/取消） |
| task=active | 执行中 | 接收执行上下文，按阶段推进 |

---

## 核心对象：Plan（统一 task JSON 中的 plan 字段）

**存储位置**：`task:{runId}.plan`（统一 task JSON 内）
**读取方式**：插件在注入时已通过 `state.getTask(runId)` 获取并附加在上下文里

```json
{
  "runId": "uuid",
  "status": "draft",
  "plan": {
    "prompt": "用户输入前500字",
    "createdAt": 1234567890000,
    "context": {
      "goal": "任务目标",
      "constraints": ["约束1", "约束2"],
      "successCriteria": ["标准1", "标准2"]
    },
    "workspace": {
      "sessions": [],
      "artifacts": [],
      "tools": ["editor", "git", "test_framework"],
      "skills": []
    },
    "execution": {
      "phases": [
        {
          "id": "p1",
          "name": "阶段名",
          "goal": "阶段目标（'达成XX'而非'做XX'）",
          "sessionId": "session:PROJECT:CODE",
          "taskFamily": "CODE",
          "outputs": ["预期产出"],
          "status": "pending"
        }
      ],
      "currentPhase": 0
    }
  },
  "deviations": [],
  "attributions": [],
  "planRevisions": [],
  "outcome": {},
  "sessionIds": [],
  "tools": []
}
```

| 属性 | 类型 | 说明 | 当前值来源 |
|------|------|------|-----------|
| `runId` | string | 本次运行唯一标识 | 插件注入 |
| `status` | string | `draft` / `pending_approval` / `active` / `completed` / `revising` | **由 Agent 决策后通知插件更新** |
| `plan.prompt` | string | 用户原始输入（截断500字） | 插件创建 task 时填充 |
| `plan.context.goal` | string | 任务目标：最终要达成什么 | Agent 制定 Plan 时填写 |
| `plan.context.constraints` | string[] | 约束条件 | Agent 制定 Plan 时填写 |
| `plan.context.successCriteria` | string[] | 验收标准 | Agent 制定 Plan 时填写 |
| `plan.workspace.tools` | string[] | 可用工具列表 | Agent 根据任务类型选择 |
| `plan.execution.phases` | object[] | 阶段列表 | Agent 制定 Plan 时设计 |
| `plan.execution.currentPhase` | number | 当前阶段索引 | 插件在阶段推进时维护 |

---

## Agent 职责

### 职责 A：任务评估（无 task 时）

**触发条件**：当前 runId **尚无 task JSON**

**⚠️ 违反以下步骤将导致 task 无法创建，执行上下文丢失。你必须严格执行。**

**你必须执行以下步骤**（决策层）：

1. **阅读用户当前 prompt**，理解用户意图

2. **评估任务复杂度**

   | 类型 | 判定标准 | 示例 | Agent 行动 |
   |------|---------|------|-----------|
   | **简单任务** | 单步骤、无需工具、即时可回答 | 查询、翻译、计算、总结、闲聊 | 直接回答用户，**不创建 Plan** |
   | **中等任务** | 2-3 个步骤、可能需工具、有明确产出 | 写一段代码、分析一个文件 | 向用户说明复杂度，**询问是否需要 Plan** |
   | **复杂任务** | 多步骤、需要多个工具、涉及子任务 | 开发功能、重构项目、写论文 | 向用户说明复杂度，**询问是否需要 Plan** |

3. **向用户汇报评估结果**

   - **简单任务**：直接回答，无需额外说明
   - **中等/复杂任务**：
     ```markdown
     📋 **任务评估**

     这个任务涉及 [N] 个步骤，预计需要 [工具/操作]。
     必须制定一个执行计划，明确各阶段目标和产出。

     是否需要我制定 Plan？（回复"是"或"否"）
     ```

4. **用户确认后输出标记**

   - 如果用户确认需要 Plan → **你必须**在你的回复末尾添加 **`[NEED_PLAN]`** 标记
   - 如果用户拒绝 → 直接按简单方式处理，**不要添加标记**
   - **严禁遗漏 [NEED_PLAN] 标记。遗漏标记 = 任务无法创建 = 执行上下文丢失。**

**插件行为**：检测到 `[NEED_PLAN]` 后，插件会创建 task JSON 并重新注入本 skill（此时 task 已存在，进入"职责 B"）。

---

### 职责 B：制定 Plan 并汇报（task=draft）

**触发条件**：当前 task.status === `draft`

**你必须执行以下步骤**（决策层）：

1. **理解用户意图**
   - 阅读用户当前 prompt 中的任务需求
   - 识别核心诉求和隐含需求

2. **加载个人记忆配置**
   - 读取 `memory.md` 中的条件-行动规则
   - 若用户任务满足某条规则的条件，在 Plan 中执行对应的行动（添加约束、阶段、验收标准等）

3. **完善 task.plan.context**
   - `goal`：用一句话明确最终交付物
   - `constraints`：列出所有已知约束
   - `successCriteria`：定义可验证的验收标准

4. **审视并调整 task.plan.execution.phases**
   - 每个阶段必须有明确的 `goal`（"达成XX"而非"做XX"）
   - 定义每阶段的预期 `outputs`
   - 如需增删改阶段，说明理由

5. **分配任务空间（Session）并执行复用策略**

   Session 标识格式：`session:{TYPE}:{任务族}`（如 `session:PROJECT:CODE`）

   **复用规则**（插件自动执行，但 Agent 需在 Plan 中正确指定）：
   - 同一 `taskFamily` 优先复用状态为 `idle` 的现有 Session
   - 不同 `taskFamily` 必须创建独立 Session
   - 需要任务空间的阶段必须在 `phase.sessionId` 中指定

   **任务族（taskFamily）分类**：`CODE` / `RESEARCH` / `ANALYSIS` / `WRITING` / `TEST` / `DESIGN` / `TASK`

6. **向用户汇报**
   ```markdown
   📋 **计划汇报**

   ▸ 任务目标：[goal]
   ▸ 约束条件：[constraints]
   ▸ 验收标准：[successCriteria]

   ▸ 执行阶段：
     1. [阶段名] — [目标] [任务空间]
     2. [阶段名] — [目标] [任务空间]
     ...

   ▸ 预期产出：[artifacts]

   **计划已制定完毕，请确认或提出修改意见。**
   ```

6. **通知插件状态变更**
   - 汇报完成后，告知插件将 task.status 更新为 `"pending_approval"`

**插件已自动完成的**（执行层，无需你操作）：
- 已根据用户 prompt 生成 Plan 模板（含 context、workspace、execution）
- 已保存到 `state/tasks/{runId}.json`

---

### 职责 C：处理用户确认/修改/取消（task=pending_approval / revising）

**触发条件**：当前 task.status === `pending_approval` 或 `revising`

**你必须执行以下步骤**（决策层）：

1. **读取用户反馈内容**

2. **如果用户确认**（"确认"、"可以"、"开始执行"等）：
   - 告知插件将 task.status 更新为 `"active"`
   - 开始按 phases 执行

3. **如果用户要求修改**：
   - 修改 task.plan.context / task.plan.execution.phases
   - 重新向用户汇报修改后的 Plan
   - 保持 task.status 为 `"pending_approval"`（或 `"revising"`）

4. **如果用户取消任务**：
   - 告知插件将 task.status 更新为 `"completed"`
   - 说明取消原因

---

## 强制检查清单（每次回复前必须自检，严禁跳过）

### 任务评估阶段（无 task）
- [ ] 用户任务是否可以在 1-2 轮对话内完成？（是 → 简单任务，直接回答）
- [ ] 任务是否需要调用外部工具或读写文件？（是 → 必须询问是否需要 Plan）
- [ ] **是否已向用户说明复杂度并询问是否需要 Plan？（中等/复杂任务必做，禁止跳过）**
- [ ] **用户确认后是否已添加 `[NEED_PLAN]` 标记？（严禁遗漏）**

**违规后果**：若跳过评估步骤或遗漏 `[NEED_PLAN]` 标记，task 将无法创建，导致执行上下文丢失、计划无法跟踪、产出物无法归档。

### Plan 制定阶段（task=draft）
- [ ] `plan.context.goal` 是否用一句话明确了最终交付物？
- [ ] `plan.context.constraints` 是否列出了所有已知限制？
- [ ] `plan.context.successCriteria` 是否可验证？
- [ ] 每个阶段的 `goal` 是否以"达成"开头？
- [ ] 需要任务空间的阶段是否已分配 `sessionId`？
- [ ] 同任务族的阶段是否复用了同一 session？
- [ ] 是否已加载 `memory.md` 条件-行动规则并应用？
- [ ] 是否已向用户汇报并请求确认？

---

## 状态流转（由插件维护，Agent 负责触发状态变更）

```
用户提问
    │
    ▼
无 task → 注入 planning skill（评估阶段）
    │
    ├─ 简单任务 → 直接回答（结束）
    │
    └─ 中等/复杂 → 询问用户 → 用户确认 → [NEED_PLAN]
              │
              ▼
        插件创建 task → 重新注入 planning skill（制定阶段）
              │
              ▼
        draft（Agent 制定 Plan）
              │
              ▼
        pending_approval（等待用户确认）
              ├─ 用户确认 → active
              ├─ 用户修改 → revising → 回到 pending_approval
              └─ 用户取消 → completed
        active（执行中）
              │
              ├─ 正常完成 → completed
              └─ 重大偏差 → revising → 回到 pending_approval
```

---

## 与其他 Skill 的关系

| Skill | 注入时机 | 职责边界 |
|-------|---------|---------|
| `planning` | `before_prompt_build` | 评估任务 → 制定 Plan → 处理确认（本 skill） |
| `monitoring` | `before_prompt_build`（task=active）| 检查执行偏差 |
| `regulation` | Deviation 创建后 | 归因分析 |
| `working_memory` | `agent_end`（纯观察，不再注入 skill）| 归档 session |
| `development` | `before_prompt_build`（task=completed）| 人格更新 |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v3.4.0 | 2026-04-29 | 合并 assessment + planning；延迟创建 task；Agent 评估 + 用户确认后才创建 task |
| v3.3.0 | 2026-04-29 | 适配统一 task JSON；状态流转增加 revising |
| v3.0.0 | 2026-04-29 | v3 重构 |
