# 面向对象模型

框架由三个模块、一组适配器、一组管理器和一组对象构成。

## 1. 适配器层

隔离核心系统变化，提供统一接口。

| 适配器 | 核心方法 | 职责 | 底层存储 | 兼容性 |
|--------|---------|------|----------|--------|
| **State** | `saveTask()`, `getTask()`, `saveSession()`, `getSession()` | 统一 task JSON + Session 存储 | `state/agent-self-development/` (JSON文件) | 接口兼容核心 State API |
| **Task** | `createTask()`, `getTask()`, `updateTask()`, `deleteTask()` | 任务创建、查询、更新、删除 | `tasks/runs.sqlite` (SQLite) | 接口兼容核心 Task API |
| **Flow** | `createPlanFlow()`, `advancePhase()`, `waitForApproval()`, `getByRunId()` | 计划工作流、阶段推进、等待确认 | `flows/registry.sqlite` (SQLite) | 接口兼容核心 Flow API |
| **Memory** | `archiveSession()`, `logEvent()`, `queryHistory()` | 归档、事件记录、历史查询 | `memory/{agentId}.sqlite` (SQLite) | 接口兼容核心 Memory API |
| **Log** | `write()`, `read()`, `query()` | 日志写入、读取、查询 | `logs/{agentId}.log` (文本) | 接口兼容核心 Log API |
| **Hook** | `init()`, `updateEvents()`, `readMetadata()` | 生成标准 Hook 声明文件 | `hooks/agent-self-development/` (MD/TS) | 备案与 CLI 发现 |

## 2. 管理器层

实现业务逻辑，组合适配器。

| 管理器 | 核心方法 | 职责 |
|--------|---------|------|
| **Plan** | `createPlan()`, `approvePlan()`, `completePhase()` | 计划创建、用户确认、阶段推进 |
| **Session** | `createSession()`, `releaseSession()`, `destroySession()` | 会话创建/复用、释放、销毁 |
| **Deviation** | `createDeviation()`, `acknowledgeDeviation()`, `resolveDeviation()` | 偏差创建、确认、解决 |
| **Attribution** | `analyzeAttribution()`, `completeAttribution()`, `applyAdjustment()` | 归因分析、完成归因、应用调节 |

## 3. 元认知模块（Metacognition）

管理 **Plan / Deviation / Attribution** 的闭环。复杂任务时注入 planning skill，active 状态时注入 monitoring skill。

| 对象 | 职责 | 状态机 | 关联 |
|------|------|--------|------|
| **Plan** | 完整的任务上下文语境（目标/约束/工作空间/阶段化执行） | `draft → pending_approval → active → completed / revising` | 驱动 Session 创建，为 Deviation 提供参照 |
| **Deviation** | 记录代理对偏差的认知（预期 vs 实际 vs 差距） | `detected → acknowledged → resolved` | 引用 Plan.successCriteria，触发 Attribution |
| **Attribution** | 记录代理对偏差的归因（根因 + 调节方案） | `analyzing → completed → executed` | 引用 Deviation，修改 Plan 或 Session |

> **工作流详情**：见 `src/metacognition/planning/SKILL.md`（制定并汇报、处理确认、阶段化执行、任务空间管理）
> **工作流详情**：见 `src/metacognition/monitoring/SKILL.md`（偏差检测与认知）
> **工作流详情**：见 `src/metacognition/regulation/SKILL.md`（归因分析与调节）

## 4. 工作记忆模块（WorkingMemory）

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

> **工作流详情**：见 `src/working-memory/SKILL.md`（创建/监控/完成/终止）

## 5. 人格模块（Personality）

基于皮亚杰同化/顺应理论，每次任务完成时（agent_end）驱动 Agent 回顾本次事件、分析 6 维度影响、自行决定是否更新人格文件（SOUL.md / IDENTITY.md / skills/README.md / MEMORY.md）。

| 对象 | 职责 | 生命周期 | 持久化 |
|------|------|--------|--------|
| **Event** | agent_end 时打包 task JSON 生成的归档事件，供 development 任务级回顾 | 单次事件，agent_end 时生成并写入 EventLog | `memory/{agentId}.sqlite`（EventLog 表） |

| 子对象 | 职责 | 对应文件 |
|--------|------|----------|
| **自我** | 核心自我认知、能力边界、存在意义 | `SOUL.md` |
| **风格** | 交互/文档/代码/任务执行风格 | `SOUL.md` |
| **信念** | 工作信念、价值观优先级 | `SOUL.md` |
| **Identity** | 角色集与社会身份 | `IDENTITY.md` |
| **Skills** | 个人技能体系 | `skills/README.md` |

> **工作流详情**：见 `src/personality/SKILL.md`（任务级同化与顺应分析）

## 6. 模块协作关系

```
Metacognition.Plan ──→ WorkingMemory.Session 创建/复用
Metacognition.Deviation ──→ WorkingMemory.Session 状态同步
Metacognition.Attribution ──→ WorkingMemory.Session 暂停/恢复

WorkingMemory.Session.completed ──→ 归档到 Memory SQLite（`asd_archives` 表）
Event（agent_end 打包 task）──→ EventLog（按日聚合）
核心 `memory:eventlog:{date}`（regulation 阶段记录的事件）──→ development（任务级回顾）
```

## 7. 源码结构

```
agent-self-development/
├── openclaw.plugin.json          # 插件 manifest
├── package.json                  # npm 包配置（ESM）
├── README.md                     # 项目总览
├── src/
│   ├── index.js                  # 插件入口：依赖注入
│   ├── metacognition/            # 元认知模块
│   │   ├── module.js             # Hook 注册与调度
│   │   ├── plan.js               # Plan 业务逻辑
│   │   ├── deviation.js          # Deviation 业务逻辑
│   │   ├── attribution.js        # Attribution 业务逻辑
│   │   ├── event.js              # Event 归档逻辑
│   │   ├── planning/SKILL.md     # Plan 对象操作指南
│   │   ├── monitoring/SKILL.md   # Deviation 操作指南
│   │   └── regulation/SKILL.md   # Attribution 操作指南
│   ├── working-memory/           # 工作记忆模块
│   │   ├── module.js             # Session 生命周期 hooks
│   │   ├── session.js            # Session 业务逻辑
│   │   └── SKILL.md              # Session 管理指南
│   ├── personality/              # 人格模块
│   │   ├── module.js             # development skill 注入
│   │   └── SKILL.md              # 同化/顺应指导
│   ├── common/                   # 公共组件
│   │   ├── heartbeat.js          # 后台监控
│   │   ├── skills.js             # skill 加载
│   │   ├── stream.js             # 流式输出处理
│   │   ├── utils.js              # 工具函数
│   │   └── adapters/             # 适配器层
│   ├── SKILL_TEMPLATE.md         # Skill 文档模板
│   └── _meta.json                # Skill 元数据索引
├── test/                         # 测试套件
├── skills/                       # 项目技能
├── agents/                       # 角色定义
└── docs/                         # 项目文档
```

## 8. 类设计表

| 类 | 职责 | 方法 |
|---|------|------|
| `Skills` | Skill 文件加载与缓存 | `load()`, `forget()`, `list()` |
| `Stream` | 流式输出检测与缓冲 | `classify()`, `extract()`, `accumulate()`, `drain()`, `purge()` |
| `State` | 状态存储适配器 | `saveTask()`, `getTask()`, `saveSession()`, `getSession()` |
| `Task` | 任务适配器 | `createTask()`, `getTask()`, `updateTask()`, `deleteTask()` |
| `Flow` | 应用 Flow 适配器 | `createPlanFlow()`, `advancePhase()`, `waitForApproval()`, `getByRunId()` |
| `Memory` | 记忆存储适配器 | `archiveSession()`, `logEvent()`, `queryHistory()` |
| `Log` | 日志适配器 | `write()`, `read()`, `query()` |
| `Hook` | Hook 文件生成器 | `init()`, `updateEvents()`, `readMetadata()` |
| `Plan` | 计划业务逻辑 | `createPlan()`, `approvePlan()`, `completePhase()` |
| `Deviation` | 偏差认知业务逻辑 | `createDeviation()`, `acknowledgeDeviation()`, `resolveDeviation()` |
| `Attribution` | 归因调节业务逻辑 | `analyzeAttribution()`, `completeAttribution()`, `applyAdjustment()` |
| `Session` | 会话业务逻辑 | `createSession()`, `releaseSession()`, `destroySession()` |
| `Event` | 任务归档逻辑 | `archiveTask()`, `queryEventLog()` |
| `Heartbeat` | 后台状态监控 | `onHeartbeatPromptContribution()` |
| `Metacognition` | 元认知闭环调度 | `onBeforePromptBuild()`, `onLlmOutput()`, `onBeforeAgentFinalize()`, `onAgentEnd()` |
| `WorkingMemory` | 任务空间生命周期管理 | `onBeforeToolCall()`, `onAfterToolCall()`, `onSubagentSpawning()`, `onSubagentSpawned()`, `onSubagentEnded()`, `onAgentEnd()` |
| `Personality` | 任务级人格更新 | `onBeforePromptBuild()`, `onAgentEnd()` |
