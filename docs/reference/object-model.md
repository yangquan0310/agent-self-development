# 面向对象模型（v4.1.0）

框架由四个层次构成：适配器层、Tool 层、管理器层、模块层。

---

## 1. 适配器层（Adapters）

隔离核心系统变化，提供统一接口。

| 适配器 | 核心方法 | 职责 | 底层存储 | 兼容性 |
|--------|---------|------|----------|--------|
| **State** | `saveTask()`, `getTask()`, `saveSession()`, `getSession()`, `archiveTask()`, `listTasks()` | 统一 task JSON + Session 存储 | `~/.agent/state/agent-self-development/` (JSON文件) | 接口兼容核心 State API |
| **Task** | `createTask()`, `getTask()`, `updateTask()`, `deleteTask()` | 任务创建、查询、更新、删除 | `tasks/runs.sqlite` (SQLite) | 接口兼容核心 Task API |
| **Flow** | `createPlanFlow()`, `advancePhase()`, `waitForApproval()`, `getByRunId()` | 计划工作流、阶段推进、等待确认 | `flows/registry.sqlite` (SQLite) | 接口兼容核心 Flow API |
| **Memory** | `archiveSession()`, `logEvent()`, `queryHistory()` | 归档、事件记录、历史查询 | `~/.agent/memory/{agentId}.sqlite` (SQLite) | 接口兼容核心 Memory API |
| **Log** | `write()`, `read()`, `query()` | 日志写入、读取、查询 | `~/.agent/logs/{agentId}.log` (文本) | 接口兼容核心 Log API |
| **Hook** | `init()`, `updateEvents()`, `readMetadata()` | 生成标准 Hook 声明文件 | `hooks/agent-self-development/` (MD/TS) | 备案与 CLI 发现 |

---

## 2. Tool 层（v4.1.0 新增）

**设计目标**：将插件能力从「Hook 注入」迁移到「Tool 暴露」，Agent 主动调用。

### 2.1 核心组件

| 组件 | 职责 | 源文件 |
|------|------|--------|
| **ToolRegistry** | 统一管理 13 个 tools 的注册、handler 分发 | `src/tools/index.js` |
| **ToolSchema** | 定义每个 tool 的 JSON Schema（输入/输出/错误） | `src/tools/schemas.js` |
| **ToolHandler** | 实现 tool 业务逻辑（查询型只读，操作型读写） | `src/tools/metacognition-tools.js`, `src/tools/working-memory-tools.js` |
| **HookRegistry** | 抽象 Hook 注册、错误捕获、超时、日志、调用链累积 | `src/common/hook.js` |

### 2.2 ToolRegistry 类设计

```javascript
// src/tools/index.js
export function registerTools(api, deps) {
  // 遍历 ALL_TOOLS（13 个）
  // 每个 tool 注册到 api.registerTool(name, { name, description, inputSchema, handler })
  // handler 包裹 try-catch，错误返回 { error: string }
}
```

### 2.3 ToolSchema 定义示例

```javascript
// src/tools/schemas.js
export const TOOL_SCHEMAS = {
  create_plan: {
    name: 'create_plan',
    description: '创建 draft task，替代 [NEED_PLAN] 标记',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        prompt: { type: 'string' },
        planInput: {
          type: 'object',
          properties: {
            goal: { type: 'string' },
            constraints: { type: 'array', items: { type: 'string' } },
            successCriteria: { type: 'array', items: { type: 'string' } },
            phases: { /* ... */ }
          }
        }
      },
      required: ['runId', 'prompt']
    }
  }
  // ... 共 13 个
};
```

### 2.4 查询型 vs 操作型 Tool 的区别

| 特性 | 查询型 Tool | 操作型 Tool |
|------|-------------|-------------|
| 数量 | 7 个 | 6 个 |
| 文件系统影响 | 只读（读取 `.agent/`、`SKILL.md`） | 读写（写入 `.agent/tasks/`、`.agent/events/`） |
| 触发方式 | Agent 调用 | Agent 调用 |
| 状态变更 | 无 | 修改 `task.status`、`task.plan.execution.currentPhase`、`task.deviations` |
| 错误处理 | 返回 `{ error: string }` | 返回 `{ error: string }`，不执行副作用 |

---

## 3. 管理器层（Managers）

实现业务逻辑，组合适配器。

| 管理器 | 核心方法 | 职责 |
|--------|---------|------|
| **Plan** | `createPlan()`, `approvePlan()`, `completePhase()` | 计划创建、用户确认、阶段推进 |
| **Session** | `createSession()`, `releaseSession()`, `destroySession()` | 会话创建/复用、释放、销毁 |
| **Deviation** | `createDeviation()`, `acknowledgeDeviation()`, `resolveDeviation()` | 偏差创建、确认、解决 |
| **Attribution** | `analyzeAttribution()`, `completeAttribution()`, `applyAdjustment()` | 归因分析、完成归因、应用调节 |

---

## 4. 模块层（Modules）

### 4.1 元认知模块（Metacognition）

管理 **Plan / Deviation / Attribution** 的闭环。复杂任务时注入 planning skill，active 状态时注入 monitoring skill。

| 对象 | 职责 | 状态机 | 关联 |
|------|------|--------|------|
| **Plan** | 完整的任务上下文语境（目标/约束/工作空间/阶段化执行） | `draft → pending_approval → active → completed / revising` | 驱动 Session 创建，为 Deviation 提供参照 |
| **Deviation** | 记录代理对偏差的认知（预期 vs 实际 vs 差距） | `detected → acknowledged → resolved` | 引用 Plan.successCriteria，触发 Attribution |
| **Attribution** | 记录代理对偏差的归因（根因 + 调节方案） | `analyzing → completed → executed` | 引用 Deviation，修改 Plan 或 Session |

**v4.1.0 变更**：
- `before_prompt_build` 不再注入完整 skill 文本（tool-driven 模式）
- `before_agent_finalize` 新增 `ctx.toolCalls` 解析
- `[STATUS]`/`[NEED_PLAN]` 标记 deprecated

### 4.2 工作记忆模块（WorkingMemory）

管理 **Session** 的全生命周期。任务空间跨 runId 复用，completed 归档，killed 销毁。

**Session 状态转换**：
```
不存在 → before_tool_call → pending → 开始执行 → active
  ├─ 正常完成 → completed → agent_end → 归档
  ├─ 工具报错 → killed → agent_end → 销毁
  └─ 主动暂停 → paused → 恢复 → active
```

| 对象 | 职责 | 生命周期 | 持久化 |
|------|------|----------|--------|
| **Session** | 执行特定任务的内存空间 | `pending → active → completed/killed/paused`；completed 后 `idle`（可复用）；killed 后销毁 | `state:session:{sessionId}` |

### 4.3 人格模块（Personality）

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

---

## 5. 模块协作关系

```
Metacognition.Plan ──→ WorkingMemory.Session 创建/复用
Metacognition.Deviation ──→ WorkingMemory.Session 状态同步
Metacognition.Attribution ──→ WorkingMemory.Session 暂停/恢复

WorkingMemory.Session.completed ──→ 归档到 Memory SQLite（`asd_archives` 表）
Event（agent_end 打包 task）──→ EventLog（按日聚合）
核心 `memory:eventlog:{date}`（regulation 阶段记录的事件）──→ development（任务级回顾）

Tool 调用（Agent 层）──→ ToolHandler 执行 ──→ 修改 State（task JSON）
Hook 触发（系统层）──→ Module handler ──→ 读取 State（验证同步）
```

---

## 6. 源码结构（v4.1.0）

```
agent-self-development/
├── openclaw.plugin.json          # 插件 manifest（含 injectionMode 配置）
├── package.json                  # npm 包配置（ESM）
├── README.md                     # 项目总览
├── src/
│   ├── index.js                  # 插件入口：依赖注入 + registerTools()
│   ├── metacognition/              # 元认知模块
│   │   ├── module.js             # Hook 注册与调度 + toolCalls 解析
│   │   ├── plan.js               # Plan 业务逻辑
│   │   ├── deviation.js            # Deviation 业务逻辑
│   │   ├── attribution.js          # Attribution 业务逻辑
│   │   ├── event.js                # Event 归档逻辑
│   │   ├── planning/SKILL.md       # Plan 对象操作指南（tool 返回源）
│   │   ├── monitoring/SKILL.md     # Deviation 操作指南（tool 返回源）
│   │   └── regulation/SKILL.md     # Attribution 操作指南（tool 返回源）
│   ├── working-memory/             # 工作记忆模块
│   │   ├── module.js               # Session 生命周期 hooks
│   │   ├── session.js              # Session 业务逻辑
│   │   └── SKILL.md                # Session 管理指南（tool 返回源）
│   ├── personality/                # 人格模块
│   │   ├── module.js               # development skill 注入
│   │   └── SKILL.md                # 同化/顺应指导（tool 返回源）
│   ├── common/                     # 公共组件
│   │   ├── hook.js                 # HookRegistry（v4.1.0 新增：调用链可视化）
│   │   ├── heartbeat.js            # 后台监控
│   │   ├── skills.js               # skill 加载
│   │   ├── stream.js               # 流式输出处理
│   │   ├── utils.js                # 工具函数
│   │   └── adapters/               # 适配器层
│   └── tools/                      # Tool 层（v4.1.0 新增）
│       ├── index.js                # ToolRegistry：注册所有 tools
│       ├── schemas.js              # ToolSchema：13 个 tools 的 JSON Schema
│       ├── metacognition-tools.js  # ToolHandler：元认知 tools 实现
│       └── working-memory-tools.js # ToolHandler：工作记忆 + 诊断 tools 实现
├── test/                           # 测试套件
├── skills/                         # 项目级技能
├── agents/                         # 角色定义
└── docs/                           # 项目文档
```

---

## 7. 类设计表（v4.1.0）

| 类 | 职责 | 方法 | 新增/变更 |
|---|------|------|-----------|
| `Skills` | Skill 文件加载与缓存 | `load()`, `forget()`, `list()` | — |
| `Stream` | 流式输出检测与缓冲 | `classify()`, `extract()`, `accumulate()`, `drain()`, `purge()` | — |
| `State` | 状态存储适配器 | `saveTask()`, `getTask()`, `saveSession()`, `getSession()`, `archiveTask()`, `listTasks()` | 新增 `listTasks()` |
| `Task` | 任务适配器 | `createTask()`, `getTask()`, `updateTask()`, `deleteTask()` | — |
| `Flow` | 应用 Flow 适配器 | `createPlanFlow()`, `advancePhase()`, `waitForApproval()`, `getByRunId()` | — |
| `Memory` | 记忆存储适配器 | `archiveSession()`, `logEvent()`, `queryHistory()` | — |
| `Log` | 日志适配器 | `write()`, `read()`, `query()` | — |
| `Hook` | Hook 文件生成器 | `init()`, `updateEvents()`, `readMetadata()` | — |
| **ToolRegistry** | **Tool 注册与分发** | `registerTools(api, deps)` | **v4.1.0 新增** |
| **ToolSchema** | **Tool JSON Schema 定义** | `TOOL_SCHEMAS`, `ALL_TOOLS`, `QUERY_TOOLS`, `ACTION_TOOLS` | **v4.1.0 新增** |
| **ToolHandler** | **Tool 业务逻辑实现** | `get_planning_guide()`, `create_plan()`, `update_task_status()`, ... | **v4.1.0 新增** |
| **HookRegistry** | **Hook 抽象层 + 调用链累积** | `register()`, `flushChain()`, `stop()`, `_addToChain()` | **v4.1.0 重构** |
| `Plan` | 计划业务逻辑 | `createPlan()`, `approvePlan()`, `completePhase()` | — |
| `Deviation` | 偏差认知业务逻辑 | `createDeviation()`, `acknowledgeDeviation()`, `resolveDeviation()` | — |
| `Attribution` | 归因调节业务逻辑 | `analyzeAttribution()`, `completeAttribution()`, `applyAdjustment()` | — |
| `Session` | 会话业务逻辑 | `createSession()`, `releaseSession()`, `destroySession()` | — |
| `Event` | 任务归档逻辑 | `archiveTask()`, `queryEventLog()` | — |
| `Heartbeat` | 后台状态监控 | `onHeartbeatPromptContribution()` | — |
| `Metacognition` | 元认知闭环调度 | `onBeforePromptBuild()`, `onLlmOutput()`, `onBeforeAgentFinalize()`, `onAgentEnd()` | v4.1.0 简化注入 |
| `WorkingMemory` | 任务空间生命周期管理 | `onBeforeToolCall()`, `onAfterToolCall()`, `onSubagentSpawning()`, `onSubagentSpawned()`, `onSubagentEnded()`, `onAgentEnd()` | — |
| `Personality` | 任务级人格更新 | `onBeforePromptBuild()`, `onAgentEnd()` | — |

---

*文档版本：v4.1.0*
*最后更新：2026-05-11*
*维护者：Developer*
