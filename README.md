# agent-self-development

OpenClaw 插件 — Agent 自我发展框架

> **插件定位**：Hook 驱动的认知发展框架。在 Agent 执行任务的特定时机，通过 `skills/` 目录下的 skill 文档注入 Agent 的 system context，作为脚手架指导 Agent 行为。
>
> **核心原则**：插件只负责"提醒"（注入 skill），Agent 负责"执行"（自行决策、读写文件、管理任务空间）。
>
> **v3.4.0 重大变更**：延迟创建 task JSON —— Agent 自主评估任务复杂度，用户确认后才创建 task；简单任务零开销；新增 assessment skill；移除插件端 `_shouldUseMetacognition` 判断。

---

## 理论基础：从人类认知到 Agent 架构

本框架的设计根植于认知科学理论，将人类认知机制映射为 Agent 的软件架构。核心洞见：**Agent 的认知不是孤立的内部过程，而是嵌入在任务语境中的生态性认知活动**。

### 1. 工作记忆：Session 作为情景缓冲器

Baddeley 的工作记忆模型包含四个核心组件：语音环路、视觉空间画板、中央执行系统和**情景缓冲器（Episodic Buffer）**。其中，**情景缓冲器**负责将来自不同子系统的信息以及长期记忆中的信息整合为一个连贯的"情景"或"片段"。

在本框架中，**Session 对应于情景缓冲器**：

- **历史上下文**：来自长期记忆的相关经验、以往同类任务的处理方式、已建立的工作习惯
- **当前任务**：目标、约束、验收标准（Plan.context），可用技能与工具（Plan.workspace），执行轨迹（Plan.execution.phases）
- **整合机制**：Session 将这些信息整合为一个连贯的"任务情景"，使 Agent 能够在特定语境中有意义地行动

**关键设计**：Session 不是被动的"存储器"，而是**主动整合的工作空间**。同一任务族的 Session 可以复用（idle → active），不同任务族的 Session 可以并行，这对应于人类认知中**多任务切换与语境保持**的能力。

### 2. 为什么需要元认知：从班杜拉到 Agent 自组织

Bandura (2001) 的代理理论指出，真正的代理不是简单的刺激-反应系统，而是能够**主动建构行动、监控执行、反思调节**的自组织系统。这一洞察揭示了元认知的本质：**Agent 不仅需要"做"，还需要"知道自己正在做什么"以及"做得怎么样"**。

元认知（metacognition）的核心是**对自身认知过程的认知和调控**。本框架将其工程化为三个阶段：

- **计划（Plan）**：在执行前形成结构化方案，明确目标、阶段和约束
- **监控（Deviation）**：在执行中检测预期与实际的偏差
- **调节（Attribution）**：在偏差发生后分析原因并更新策略

班杜拉的理论为这种元认知架构提供了认知科学基础，但本框架的核心不是还原班杜拉的四维模型，而是实现**Agent 的自组织认知循环**：计划 → 执行 → 监控 → 调节 → 再计划。

### 3. 皮亚杰的认知发展：Agent 如何成长

皮亚杰的同化/顺应机制解释了 Agent 的**长期发展**。

**Agent 的人格成分**（区别于其他 Agent 的核心标识）：

| 人格成分 | 内容 | 同化示例 | 顺应示例 |
|---------|------|---------|---------|
| **自我** | 核心自我认知、能力边界、存在意义 | 成功经验丰富自我效能感 | 遭遇能力盲区，重新定义"我能做什么" |
| **风格 (Style)** | 响应风格、表达习惯、交互/文档/代码/任务执行风格 | 同类任务强化既有风格 | 新渠道/新用户群体要求调整风格 |
| **信念** | 工作信念、价值观优先级 | 日常经验强化核心信念 | 重大失败/价值观冲突导致信念更新 |
| **身份 (Identity)** | 角色集、社会定位、责任范围 | 同类角色强化身份认同 | 新角色/新职责要求身份重构 |
| **技能 (Skills)** | 技能体系、工具熟练度、领域知识 | 同类任务提升技能熟练度 | 全新领域要求创建新技能文档 |

**关键理解**：
- **同化**：新经验与现有人格成分兼容 → 强化/细化现有成分
- **顺应**：新经验与现有人格成分冲突 → 修改/重构该成分
- **发展**：人格成分的持续同化与顺应，构成 Agent 的**独特发展轨迹**

**PersonalityModule** 的实现：每次任务完成时（agent_end），Agent 回顾本次任务的偏差、归因和结果 → 判断对 6 个维度（自我/风格/信念/身份/技能/程序性记忆）的影响类型（同化/顺应/无影响）→ 自行决定是否更新人格文件

### 4. 理论整合：三层认知架构

```
┌─────────────────────────────────────────┐
│           元认知层 (Metacognition)         │
│  计划 → 监控 → 调节                      │
│  (Metacognition: 认知的自我调控)          │
├─────────────────────────────────────────┤
│           工作记忆层 (Working Memory)      │
│  Session = 情景缓冲器                    │
│  (整合历史上下文与当前任务)               │
├─────────────────────────────────────────┤
│           人格发展层 (Personality)       │
│  同化/顺应 → 人格文件更新（自我/风格/信念/identity/skills）│
│  (Piaget: 认知发展的动力机制)             │
└─────────────────────────────────────────┘
```

**关键洞见**：Agent 的自我发展不是单一维度的"能力提升"，而是**三层系统的协同演化**——元认知能力监控和调节工作记忆，工作记忆承载的任务经验通过同化/顺应更新人格结构，人格结构的更新又反过来影响元认知策略（例如，更成熟的 Agent 会制定更精细的 Plan）。

---

## 四层架构与权力边界

```
┌─────────────────────────────────────────────┐
│             用户层（User）                   │
│  · 下达任务需求（自然语言）                   │
│  · 审核代理制定的 Plan                        │
│  · 确认/修改/取消 Plan                        │
│  · 判断任务是否完成                           │
└─────────────────────────────────────────────┘
  ↓ 自然语言指令        ↑ 自然语言汇报
  ↓ 任务需求/确认反馈   ↑ Plan 状态/执行结果
  ↓ 审核意见            ↑ 任务完成报告
┌─────────────────────────────────────────────┐
│            代理层（Agent）                   │
│  · 接收用户任务，制定 Plan                    │
│  · 向用户汇报 Plan，等待审核                  │
│  · 审核通过后，在 Session（任务族）中推进执行 │
│  · 管理多个 Session，复用上下文               │
│  · 向插件层上报：Plan 状态、Session 状态      │
└─────────────────────────────────────────────┘
  ↓ 状态上报              ↑ skill 注入
  ↓ Plan 状态             ↑ planning skill
  ↓ Session 状态          ↑ monitoring skill
  ↓ 执行结果              ↑ 执行上下文提示
┌─────────────────────────────────────────┐
│              插件层（Plugin）            │
│  · 注册 Hook 事件处理器                   │
│  · 在事件触发时调用系统底层 API           │
│  · 接收代理层状态，写入系统底层            │
│  · 注入无可争议的流程/参数 skill           │
│                                          │
│  before_prompt_build → 注入 planning（评估 / 制定 / 确认）│
│  llm_output          → 检测 [NEED_PLAN] / 注入 monitoring │
│  before_tool_call    → 记录 Session 创建 │
│  after_tool_call     → 记录事件/更新状态  │
│  agent_end           → 注入 working_memory│
└─────────────────────────────────────────┘
  ↓ API 调用              ↑ Hook 事件触发
  ↓ State.saveTask        ↑ before_prompt_build
  ↓ State.saveSession     ↑ before_tool_call / after_tool_call
  ↓ Memory.archiveSession ↑ agent_end
  ↓ Memory.appendEventLog ↑ agent_end
┌─────────────────────────────────────────┐
│           系统底层（文件系统）              │
│  · 提供 Hook 事件总线（Plugin api.on）    │
│  · 插件专属持久化（JSON 文件 + SQLite 数据库） │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Hook   │ │  Flow   │ │  State  │   │
│  │ (hooks/)│ │(flows/) │ │(state/) │   │
│  │ ├─────────┤ ├─────────┤ ├─────────┤ │
│  │ │before_  │ │ SQLite │ │ JSON   │ │
│  │ │prompt_  │ │        │ │ files  │ │
│  │ │build    │ │        │ │        │ │
│  │ │llm_     │ │        │ │        │ │
│  │ │output   │ │        │ │        │ │
│  │ │agent_   │ │        │ │        │ │
│  │ │end      │ │        │ │        │ │
│  │ └─────────┘ └─────────┘ └─────────┘ │
│  │ ┌─────────┐ ┌─────────┐            │
│  │ │ Memory  │ │  Log    │            │
│  │ │(memory/)│ │(logs/)  │            │
│  │ │ SQLite  │ │ 文本/   │            │
│  │ │         │ │ JSONL   │            │
│  │ └─────────┘ └─────────┘            │
│  └───────────────────────────────────────┘
```

| 层级 | 权力边界 | 左侧输入 | 右侧输出 |
|------|---------|---------|---------|
| **用户层** | 任务所有者，拥有最终审核权和完成判定权 | 代理层的自然语言汇报、Plan 状态、执行结果 | 自然语言指令、确认反馈、审核意见 |
| **代理层** | 任务执行者，自行决策、制定 Plan、管理 Session | 插件层的 skill 注入、执行上下文 | Plan 状态、Session 状态、执行结果 |
| **插件层** | 工具层，只负责记录和注入无可争议的流程/参数 | 系统底层的 Hook 事件 | skill 文档、状态记录、API 调用 |
| **系统底层** | 基础设施，提供持久化、任务流、状态、记忆、日志 | 插件层的 API 调用 | Hook 事件、数据持久化 |

### 权力边界详解

**用户层（User）**
- ✅ 下达任务需求
- ✅ 审核代理制定的 Plan
- ✅ 确认/修改/取消 Plan
- ✅ 判断任务是否完成
- ❌ 不直接操作系统底层
- ❌ 不直接管理 Session

**代理层（Agent）**
- ✅ 接收用户任务，制定 Plan（含子任务分解、工具/技能、成功标准）
- ✅ 向用户汇报 Plan，等待审核
- ✅ 审核通过后，在 Session（任务族）中推进执行
- ✅ 管理多个 Session，复用上下文
- ✅ 向插件层上报状态
- ❌ 不直接读写系统底层（通过插件层）
- ❌ 不替用户做最终决策

**插件层（Plugin）**
- ✅ 注册 Plugin 生命周期事件处理器（api.on）
- ✅ 在事件触发时读写插件专属状态（JSON 文件）与记忆（SQLite）
- ✅ 接收代理层状态，持久化到文件系统
- ✅ 注入无可争议的流程/参数 skill
- ❌ 不做业务决策
- ❌ 不替代理制定 Plan
- ❌ 只记录和传递，不判断

**系统底层（文件系统）**
- ✅ 提供 Plugin 事件总线（api.on）
- ✅ 插件专属目录结构（state/ flows/ memory/ logs/ hooks/）
- ✅ JSON 文件（State）+ SQLite 数据库（Task/Flow/Memory）+ 文本（Log）持久化
- ❌ 不做业务逻辑
- ❌ 不替代理或插件决策

### 数据流向

**双向流向（各层之间）**

| 方向 | 左侧输入（下层→上层） | 右侧输出（上层→下层） |
|------|----------------------|----------------------|
| 用户层 ↔ 代理层 | ↑ 自然语言汇报（Plan状态/执行结果） | ↓ 自然语言指令（任务需求/确认反馈） |
| 代理层 ↔ 插件层 | ↑ 状态上报（Deviation/Attribution/Event） | ↓ Skill注入（planning/monitoring/regulation/development） |
| 插件层 ↔ 系统层 | ↑ 文件读写（State.save/Memory.query） | ↓ Plugin 事件触发（before_prompt_build/llm_output/agent_end） |

### 文件系统映射

| 存储类型 | 数据库路径 | 格式 | 插件层调用 | 用途 |
|----------|-----------|------|-----------|------|
| **Task** | `.openclaw/tasks/runs.sqlite` | SQLite | TaskAdapter | 使用已有系统数据库 |
| **Flow** | `.openclaw/flows/registry.sqlite` | SQLite | FlowAdapter | 使用已有系统数据库 |
| **State** | `.openclaw/state/agent-self-development/` | JSON | StateAdapter | Plan/Session/Deviation/Attribution 状态 |
| **Memory** | `.openclaw/memory/{agentId}.sqlite` | SQLite | MemoryAdapter | 归档、事件记录、历史查询 |
| **Log** | `.openclaw/logs/{agentId}.log` | 文本 | LogAdapter | 每个代理独立日志文件 |
| **Hook** | `.openclaw/hooks/agent-self-development/` | MD/TS | HookAdapter | Hook 声明文件（备案与 CLI 发现） |


> **兼容性设计**：适配器构造函数接收 `(api, options)`，当 `api` 为 null 时回退到 JSON 文件。若未来 OpenClaw 暴露对应核心 API，传入真实 API 对象即可无缝切换，无需修改业务代码。

---

## v3.0.0 系统层重大变更

### 新增组件

| 组件 | 职责 | 底层存储 | 兼容性 |
|------|------|---------|--------|
| `StateAdapter` | 状态存储适配器 | `state/agent-self-development/` (JSON文件) | 接口兼容核心 State API |
| `TaskAdapter` | 任务适配器 | `tasks/runs.sqlite` (SQLite) | 接口兼容核心 Task API |
| `FlowAdapter` | 应用Flow适配器 | `flows/registry.sqlite` (SQLite) | 接口兼容核心 Flow API |
| `MemoryAdapter` | 记忆存储适配器 | `memory/{agentId}.sqlite` (SQLite) | 接口兼容核心 Memory API |
| `LogAdapter` | 日志适配器 | `logs/{agentId}.log` (文本) | 接口兼容核心 Log API |
| `HookAdapter` | Hook 文件生成器 | `hooks/agent-self-development/` (MD/TS) | 生成标准 Hook 声明文件 |
| `PlanManager` | Plan 业务逻辑 | State + Flow | `state/agent-self-development/` + `flows/registry.sqlite` |
| `SessionManager` | Session 业务逻辑 | State + Flow | `state/agent-self-development/` + `flows/registry.sqlite` |


---

## 面向对象模型

框架由三个模块（Module）、一组适配器（Adapter）、一组管理器（Manager）和一组对象（Object）构成。

### 1. 适配器层（Adapter Layer）

隔离核心系统变化，提供统一接口。

| 适配器 | 核心方法 | 职责 | 底层存储 | 兼容性 |
|--------|---------|------|----------|--------|
| **StateAdapter** | `saveTask()`, `getTask()`, `saveSession()`, `getSession()` | 统一 task JSON + Session 存储 | `state/agent-self-development/` (JSON文件) | 接口兼容核心 State API |
| **TaskAdapter** | `createTask()`, `getTask()`, `updateTask()`, `deleteTask()` | 任务创建、查询、更新、删除 | `tasks/runs.sqlite` (SQLite) | 接口兼容核心 Task API |
| **FlowAdapter** | `createPlanFlow()`, `advancePhase()`, `waitForApproval()`, `getByRunId()` | 计划工作流、阶段推进、等待确认 | `flows/registry.sqlite` (SQLite) | 接口兼容核心 Flow API |
| **MemoryAdapter** | `archiveSession()`, `logEvent()`, `queryHistory()` | 归档、事件记录、历史查询 | `memory/{agentId}.sqlite` (SQLite) | 接口兼容核心 Memory API |
| **LogAdapter** | `write()`, `read()`, `query()` | 日志写入、读取、查询 | `logs/{agentId}.log` (文本) | 接口兼容核心 Log API |
| **HookAdapter** | `init()`, `updateEvents()`, `readMetadata()` | 生成标准 Hook 声明文件 | `hooks/agent-self-development/` (MD/TS) | 备案与 CLI 发现 |

### 2. 管理器层（Manager Layer）

实现业务逻辑，组合适配器。

| 管理器 | 核心方法 | 职责 |
|--------|---------|------|
| **PlanManager** | `createPlan()`, `approvePlan()`, `completePhase()` | 计划创建、用户确认、阶段推进 |
| **SessionManager** | `createSession()`, `releaseSession()`, `destroySession()` | 会话创建/复用、释放、销毁 |
| **DeviationManager** | `createDeviation()`, `acknowledgeDeviation()`, `resolveDeviation()` | 偏差创建、确认、解决 |
| **AttributionManager** | `analyzeAttribution()`, `completeAttribution()`, `applyAdjustment()` | 归因分析、完成归因、应用调节 |

### 3. 元认知模块（MetacognitionModule）

管理 **Plan / Deviation / Attribution** 的闭环。复杂任务时注入 planning skill，active 状态时注入 monitoring skill。

| 对象 | 职责 | 状态机 | 关联 |
|------|------|--------|------|
| **Plan** | 完整的任务上下文语境（目标/约束/工作空间/阶段化执行） | `draft → pending_approval → active → completed / revising` | 驱动 Session 创建，为 Deviation 提供参照 |
| **Deviation** | 记录代理对偏差的认知（预期 vs 实际 vs 差距） | `detected → acknowledged → resolved` | 引用 Plan.successCriteria，触发 Attribution |
| **Attribution** | 记录代理对偏差的归因（根因 + 调节方案） | `analyzing → completed → executed` | 引用 Deviation，修改 Plan 或 Session |

> **工作流详情**：见 `metacognition/planning/SKILL.md`（制定并汇报、处理确认、阶段化执行、任务空间管理）
> **工作流详情**：见 `metacognition/monitoring/SKILL.md`（偏差检测与认知）
> **工作流详情**：见 `metacognition/regulation/SKILL.md`（归因分析与调节）

#### **Plan 对象**

```json
{
  "runId": "uuid",
  "prompt": "用户原始输入",
  "status": "draft",
  "context": {
    "goal": "任务目标",
    "constraints": ["约束条件"],
    "successCriteria": ["成功标准：创建/修改哪些文档"]
  },
  "workspace": {
    "sessions": [],
    "artifacts": ["预期产出文档"],
    "tools": ["所用工具"],
    "skills": ["所用技能"]
  },
  "execution": {
    "phases": [
      {
        "id": "phase1",
        "name": "子任务名称",
        "goal": "子任务目标",
        "sessionId": "session:CODE:task-family",
        "taskFamily": "CODE",
        "tools": ["所需工具"],
        "skills": ["所需技能"],
        "outputs": ["产出文档"],
        "status": "pending"
      }
    ],
    "currentPhase": 0
  }
}
```

**Plan 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | 收到复杂任务 | `draft` |
| `draft` | Agent 制定完成并汇报 | `pending_approval` |
| `pending_approval` | 用户确认 | `active` |
| `pending_approval` | 用户要求修改 | `pending_approval`（重新汇报） |
| `pending_approval` | 用户取消 | `completed` |
| `active` | 阶段正常推进 | `active`（currentPhase++） |
| `active` | 所有 phases 完成 | `completed` |
| `active` | 重大偏差需重规划 | `draft`（重新汇报） |
| `completed` | `agent_end` | 归档到 Memory |

#### **Deviation 对象**

```json
{
  "deviationId": "uuid",
  "runId": "uuid",
  "phaseId": "phase1",
  "status": "detected",
  "detectedAt": "ISO-8601 timestamp",
  "type": "scope_creep|tool_failure|logic_error|user_intervention|other",
  "expected": {
    "description": "预期行为/输出",
    "criteria": "引用的 Plan.successCriteria"
  },
  "actual": {
    "description": "实际行为/输出",
    "evidence": "截图/日志/输出片段"
  },
  "gap": {
    "description": "差距描述",
    "severity": "low|medium|high|critical"
  },
  "acknowledgedAt": "ISO-8601 timestamp|null",
  "resolvedAt": "ISO-8601 timestamp|null",
  "resolution": "解决方式描述|null"
}
```

**Deviation 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | LLM 输出与 Plan 偏离 | `detected` |
| `detected` | Agent 确认偏差 | `acknowledged` |
| `acknowledged` | 执行 Attribution 调节方案 | `resolved` |

#### **Attribution 对象**

```json
{
  "attributionId": "uuid",
  "runId": "uuid",
  "deviationId": "uuid",
  "status": "analyzing",
  "createdAt": "ISO-8601 timestamp",
  "rootCause": {
    "category": "planning|execution|tool|skill|knowledge|other",
    "description": "根因分析",
    "evidence": "支持证据"
  },
  "adjustment": {
    "type": "modify_plan|skip_phase|create_session|update_criteria|other",
    "description": "调节方案描述",
    "targetId": "Plan.runId 或 Session.sessionId",
    "changes": {
      "phases": [],
      "artifacts": [],
      "tools": [],
      "skills": []
    }
  },
  "executedAt": "ISO-8601 timestamp|null",
  "result": "执行结果描述|null"
}
```

**Attribution 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | Deviation 已确认 | `analyzing` |
| `analyzing` | 根因分析和调节方案完成 | `completed` |
| `completed` | 调节方案已执行 | `executed` |

### 4. 工作记忆模块（WorkingMemoryModule）

管理 **Session** 的全生命周期。任务空间跨 runId 复用，completed 归档，killed 销毁。

**Session 状态转换**：
```
不存在 → before_tool_call → pending → 开始执行 → active
  ├─ 正常完成 → completed → agent_end → 归档
  ├─ 工具报错 → killed → agent_end → 销毁
  └─ 主动暂停 → paused → 恢复 → active
```

**任务空间复用规则**：同一 `taskFamily`（CODE/RESEARCH/ANALYSIS/WRITING/TEST/DESIGN/TASK）的后续任务复用 idle 空间，标识格式 `session:{TYPE}:{任务族}`。

| 对象 | 职责 | 生命周期 | 持久化 |
|------|------|----------|--------|
| **Session** | 执行特定任务的内存空间 | `pending → active → completed/killed/paused`；completed 后 `idle`（可复用）；killed 后销毁 | `state:session:{sessionId}` |

> **工作流详情**：见 `working-memory/SKILL.md`（创建/监控/完成/终止）

#### **Session 对象**

```json
{
  "sessionId": "session:CODE:task-family",
  "taskFamily": "CODE",
  "status": "pending",
  "createdAt": "ISO-8601 timestamp",
  "activatedAt": "ISO-8601 timestamp|null",
  "completedAt": "ISO-8601 timestamp|null",
  "runIds": ["uuid"],
  "artifacts": ["产出文档路径"],
  "tools": ["使用过的工具"],
  "context": {
    "lastGoal": "最后执行的目标",
    "lastOutputs": ["最后产出"]
  }
}
```

**Session 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | 需要新任务空间 | `pending` |
| `pending` | 开始执行 | `active` |
| `active` | 阶段完成 | `completed` |
| `completed` | agent_end | `idle`（可复用） |
| `active` | 工具报错 | `killed`（销毁） |
| `active` | 主动暂停 | `paused` |
| `paused` | 恢复执行 | `active` |

### 5. 人格模块（PersonalityModule）

基于皮亚杰同化/顺应理论，每次任务完成时（agent_end）驱动 Agent 回顾本次事件、分析 6 维度影响、自行决定是否更新人格文件（SOUL.md / IDENTITY.md / skills/README.md / MEMORY.md）。

| 对象 | 职责 | 生命周期 | 持久化 |
|------|------|--------|--------|
| **Event** | regulation 阶段记录的事件（偏差/归因/计划修订/结果），供 development 任务级回顾 | 单次事件，agent_end 时聚合到 EventLog | `task:{runId}.event`（统一 task JSON）→ Memory.eventlog |


| 子对象 | 职责 | 对应文件 |
|--------|------|----------|
| **自我** | 核心自我认知、能力边界、存在意义 | `SOUL.md` |
| **风格** | 交互/文档/代码/任务执行风格 | `SOUL.md` |
| **信念** | 工作信念、价值观优先级 | `SOUL.md` |
| **Identity** | 角色集与社会身份 | `IDENTITY.md` |
| **Skills** | 个人技能体系 | `skills/README.md` |

#### **Event 对象**

```json
{
  "eventId": "uuid",
  "runId": "uuid",
  "type": "plan_created|phase_completed|deviation_detected|attribution_completed|tool_called|session_created|session_completed|other",
  "timestamp": "ISO-8601 timestamp",
  "actor": "Plan|Deviation|Attribution|Session|Tool",
  "action": "create|advance|detect|acknowledge|resolve|analyze|execute|complete|fail",
  "targetId": "受影响的对象ID",
  "details": {
    "description": "事件描述",
    "metadata": {}
  }
}
```

**Event 生命周期**：单次事件，agent_end 时聚合到 EventLog。

**同化 vs 顺应判定**：
- **同化**：原有内容的细化 → 调用子对象的 update 方法
- **顺应**：新结构的出现 → 调用子对象的 create 方法

> **工作流详情**：见 `personality/SKILL.md`（任务级同化与顺应分析）

### 6. 模块协作关系

```
Metacognition.Plan ──→ WorkingMemory.Session 创建/复用
Metacognition.Deviation ──→ WorkingMemory.Session 状态同步
Metacognition.Attribution ──→ WorkingMemory.Session 暂停/恢复

WorkingMemory.Session.completed ──→ 归档到 Memory SQLite（`asd_archives` 表）
Event（regulation 阶段撰写）──→ EventLog（按日聚合）──→ Diary（每日回顾原料）
核心 `memory:eventlog:{date}`（regulation 阶段记录的事件）──→ development（任务级回顾）
```

---

## 系统层：Hook 注入映射

| Hook | 条件 | 注入 skill | 操作对象 | 文件系统交互 |
|------|------|------------|----------|-------------|
| `before_prompt_build` | 无 task | `planning`（评估阶段）| — | 不创建 task |
| `before_prompt_build` | task=draft | `planning`（制定阶段）| Plan | State.saveTask() |
| `before_prompt_build` | task=pending_approval / revising | `planning` | Plan | State.saveTask() |
| `before_prompt_build` | task=active | 执行上下文 + `monitoring` | Plan | State.getTask() |
| `llm_output` | 检测到 `[NEED_PLAN]` | `planning` | Plan | State.saveTask()（创建 task） |
| `llm_output` | task=active | `monitoring` | Deviation | task.event.deviations.push() |
| `before_tool_call` | 会话工具调用 | —（仅记录） | Session | State.saveSession() |
| `after_tool_call` | 任意（task 存在时） | —（仅记录工具结果） | Tool | task.tools.push() |
| `agent_end` | 任意（task 存在时） | `working_memory` + `development` | Task | task.event → Memory.eventlog |

---

## 技术实现

### 源码结构（按模块组织）

```
agent-self-development/
├── openclaw.plugin.json          # 插件 manifest
├── package.json                  # npm 包配置（ESM）
├── README.md                     # 本文档
├── src/
│   ├── index.js                  # 插件入口：依赖注入，创建并注册三大模块 + 适配器 + 管理器
│   ├── metacognition/            # 元认知模块
│   │   ├── module.js             # MetacognitionModule（Plan/Deviation/Attribution 调度）
│   │   ├── plan-manager.js       # PlanManager（计划业务逻辑）
│   │   ├── deviation-manager.js  # DeviationManager（偏差认知业务逻辑）
│   │   ├── attribution-manager.js # AttributionManager（归因调节业务逻辑）
│   │   ├── planning/             # 计划 skill（Agent 指导文档）
│   │   │   └── SKILL.md          # Plan 对象操作指南
│   │   ├── monitoring/           # 偏差认知 skill
│   │   │   └── SKILL.md          # Deviation 对象操作指南
│   │   └── regulation/           # 归因调节 skill
│   │       └── SKILL.md          # Attribution + Event 撰写指南
│   ├── working-memory/           # 工作记忆模块
│   │   ├── module.js             # WorkingMemoryModule（Session 生命周期）
│   │   ├── session-manager.js    # SessionManager（会话业务逻辑）
│   │   └── SKILL.md              # Session 管理指南
│   ├── personality/              # 人格模块
│   │   ├── module.js             # PersonalityModule（development skill 注入）
│   │   └── SKILL.md              # Development skill（同化/顺应指导）
│   ├── common/                   # 公共组件
│   │   ├── event-manager.js      # EventManager（事件业务逻辑，跨模块共享）
│   │   ├── event-template.js     # Event 对象模板
│   │   ├── skills-loader.js      # SkillLoader（带缓存）
│   │   ├── utils.js              # 工具函数（日期、任务族推断）
│   │   └── adapters/             # 适配器层（兼容核心 API 接口）
│   │       ├── state-adapter.js  # StateAdapter
│   │       ├── task-adapter.js   # TaskAdapter
│   │       ├── flow-adapter.js   # FlowAdapter
│   │       ├── memory-adapter.js # MemoryAdapter
│   │       ├── log-adapter.js    # LogAdapter
│   │       ├── hook-adapter.js   # HookAdapter（生成标准 Hook 声明文件）

│   ├── SKILL_TEMPLATE.md         # Skill 文档模板（本地生成用，不提交 Git）
│   └── _meta.json                # Skill 元数据索引
```

### 面向对象类设计

| 类 | 职责 | 方法 |
|---|------|------|
| `SkillLoader` | Skill 文件加载与缓存 | `load()`, `clearCache()`, `getAvailableSkills()` |
| `StateAdapter` | 状态存储适配器（文件系统 + 兼容接口） | `saveTask()`, `getTask()`, `saveSession()`, `getSession()` |
| `TaskAdapter` | 任务适配器（文件系统 + 兼容接口） | `createTask()`, `getTask()`, `updateTask()`, `deleteTask()` |
| `FlowAdapter` | 应用Flow适配器（文件系统 + 兼容接口） | `createPlanFlow()`, `advancePhase()`, `waitForApproval()`, `getByRunId()` |
| `MemoryAdapter` | 记忆存储适配器（文件系统 + 兼容接口） | `archiveSession()`, `logEvent()`, `queryHistory()` |
| `LogAdapter` | 日志适配器（文件系统 + 兼容接口） | `write()`, `read()`, `query()` |
| `HookAdapter` | Hook 文件生成器 | `init()`, `updateEvents()`, `readMetadata()` |

| `PlanManager` | 计划业务逻辑 | `createPlan()`, `approvePlan()`, `completePhase()` |
| `DeviationManager` | 偏差认知业务逻辑 | `createDeviation()`, `acknowledgeDeviation()`, `resolveDeviation()` |
| `AttributionManager` | 归因调节业务逻辑 | `analyzeAttribution()`, `completeAttribution()`, `applyAdjustment()` |
| `SessionManager` | 会话业务逻辑 | `createSession()`, `releaseSession()`, `destroySession()` |
| `EventManager` | 事件聚合 | `aggregateEvents()`, `queryEventLog()` |
| `MetacognitionModule` | 元认知闭环调度 | `onBeforePromptBuild()`, `onLlmOutput()`, `onAgentEnd()` |
| `WorkingMemoryModule` | 任务空间生命周期管理 | `onBeforeToolCall()`, `onAfterToolCall()`, `onAgentEnd()` |
| `PersonalityModule` | 任务级人格更新 | `onAgentEnd()` |

### 状态存储键空间

| 键 | 存储域 | 类型 | 生命周期 | 说明 |
|----|--------|------|----------|------|
| `task:{runId}` | State (插件) | Task | runId | 统一任务 JSON：plan + event + sessions + tools（`state/tasks/{runId}.json`） |
| `session:{sessionId}` | State (插件) | Session | 长期 | 任务空间（`state/sessions.json`） |
| `working_memory:active_sessions` | State (插件) | Session[] | 全局 | 全局活跃任务空间索引（`state/sessions.json`） |
| `flow:{flowId}` | Flow | Flow | 长期 | Flow 工作流实例（`flows/registry.sqlite`） |
| `task:{runId}` | Task (核心) | TaskRecord | runId | 任务元数据（`tasks/runs.sqlite`） |
| `eventlog:{YYYY-MM-DD}` | Memory | EventLog | 日期 | 按日聚合的事件（`memory/{agentId}.sqlite`） |
| `logs:{YYYY-MM-DD}` | Log | LogEntry[] | 日期 | 按日累积的日志（`logs/{agentId}.log`） |

---

## 安装

### 前置条件

- OpenClaw >= 2026.4.0
- Node.js >= 18
- `plugins.entries.agent-self-development.hooks.allowConversationAccess = true`

### 步骤

```bash
# 1. 安装插件
## 生产环境：从 Git 仓库直装
openclaw plugins install git:github.com/yangquan0310/openclaw_muti_agent_lab
## 安装指定版本
openclaw plugins install git:github.com/yangquan0310/openclaw_muti_agent_lab@v3.4.0
## 本地开发：从本地目录安装（热更新方便）
openclaw plugins install /root/openclaw-integration-design/
## 或使用 --link 符号链接模式（修改源码即时生效）
openclaw plugins install --link /root/openclaw-integration-design/

# 2. 启用
openclaw plugins enable agent-self-development

# 3. 编辑 ~/.openclaw/openclaw.json 配置 Agent 白名单与 hooks 权限

# 4. 重启 Gateway
openclaw gateway restart
```

### 配置示例

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "alsoAllow": ["agent-self-development"] }
      }
    ]
  },
  "plugins": {
    "entries": {
      "agent-self-development": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "metacognition": { "enabled": true, "planning": true, "monitoring": true },
          "workingMemory": { "enabled": true, "trackSubagents": true, "autoArchive": true },
          "personality": { "enabled": true }
        }
      }
    }
  }
}
```

### 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `metacognition.enabled` | boolean | `true` | 元认知模块总开关 |
| `metacognition.planning` | boolean | `true` | 计划阶段（draft → pending_approval → active） |
| `metacognition.monitoring` | boolean | `true` | 偏差认知阶段（仅 active 状态注入 monitoring） |
| `workingMemory.enabled` | boolean | `true` | 工作记忆模块总开关 |
| `workingMemory.trackSubagents` | boolean | `true` | 追踪任务空间创建/完成 |
| `workingMemory.autoArchive` | boolean | `true` | 任务结束后 Archive → Memory 归档 |
| `personality.enabled` | boolean | `true` | 人格模块总开关（agent_end 触发） |

> **向后兼容**：`config.development` 仍可工作，内部映射到 `personality`

---

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| **v3.4.0** | 2026-04-29 | 延迟创建 task JSON：Agent 评估 + 用户确认后才创建 task；新增 assessment skill；简单任务不创建 task；移除 `_shouldUseMetacognition` 插件端判断 |
| v3.3.0 | 2026-04-29 | 统一 task JSON（`task:{runId}`）取代分散状态键；移除 Cron/Diary 系统；人格更新改为 agent_end 单次任务分析；6 维度扩展（新增程序性记忆）；revising 状态支持 Plan 修改后重新汇报 |
| v3.2.1 | 2026-05-01 | 修复 `baseDir` 路径解析 bug：固定使用 `/root/.openclaw` 作为基础目录 |
| v3.2.1 | 2026-04-29 | 插件版本号同步更新 |
| v3.1.3 | 2026-04-?? | 重构底层存储架构，Task/Flow/Memory 改为 SQLite，Log 改为按代理分文件 |