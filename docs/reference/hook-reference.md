# Hook 与 Tool 混合架构参考（v4.1.0）

> **版本**：v4.1.0
> **适用**：`agent-self-development` 插件
> **架构**：Tool 暴露为主，最小化 Hook 注入为辅

---

## 1. 架构概览

v4.1.0 从 "Hook 注入 Skill" 架构迁移到 **"Tool 暴露 + Agent 自主调用"** 架构。

```
┌─────────────────────────────────────────┐
│  Agent 层（自主决策）                    │
│  ├─ 调用 get_task_status() 了解状态     │
│  ├─ 调用 get_planning_guide() 获取指导  │
│  ├─ 调用 create_plan() / update_task_status() 推进状态
│  └─ 调用 record_deviation() 记录偏差    │
├─────────────────────────────────────────┤
│  Tool 层（13 个 tools）                  │
│  ├─ 查询型（7 个）：get_* / self_diagnose
│  └─ 操作型（6 个）：create_* / update_* / advance_* / record_* / archive_*
├─────────────────────────────────────────┤
│  Hook 层（7 个 hooks）                   │
│  ├─ before_prompt_build：最小化注入      │
│  ├─ before_agent_finalize：标记解析      │
│  ├─ llm_output / agent_end：观察型      │
│  └─ before_tool_call / after_tool_call  │
├─────────────────────────────────────────┤
│  适配器层（State / Memory / Log）         │
└─────────────────────────────────────────┘
```

---

## 2. Hook 类型与职责（v4.1.0）

| Hook | 类型 | v4.1.0 职责 | 对应 Tool |
|------|------|------------|-----------|
| `before_prompt_build` | **MODIFYING** | **最小化注入**：当前 task 状态摘要 + 可用 tools 列表（1-2 句） | 无（仅提示 Agent 可调用 tools） |
| `heartbeat_prompt_contribution` | MODIFYING | 状态统计 prependContext | 无 |
| `before_agent_finalize` | **CLAIMING** | 1. 解析 `[STATUS]`/`[NEED_PLAN]` 标记（deprecated）<br>2. 解析 `ctx.toolCalls` 中的 tool 调用结果，同步更新 task | `update_task_status`, `create_plan` 等 |
| `llm_output` | **VOID** | 流式缓冲聚合、保存输出到 task | 无 |
| `agent_end` | VOID | 归档 task、清理资源、**flush hook 调用链** | `archive_task` |
| `before_tool_call` | VOID | Session 追踪 | 无 |
| `after_tool_call` | VOID | 记录工具结果、文件变更审计 | 无 |

### 2.1 关键变更说明

**before_prompt_build（注入简化）**
- **tool-driven 模式**：始终只注入最小化提示（状态 + tools 列表）
- **legacy 模式**：保留 v4.0.0 完整 skill 注入（向后兼容）
- 配置开关：`injectionMode: "legacy" | "tool-driven"`，默认 `"tool-driven"`

**before_agent_finalize（双轨解析）**
- 保留 `[STATUS: xxx]` 和 `[NEED_PLAN]` 标记解析（deprecated）
- 新增 `ctx.toolCalls` 结果解析：Agent 调用 `update_task_status` 后，状态自动同步
- 当检测到 `[NEED_PLAN]` 时，不再自动创建 task，而是返回 `action: "revise"` 提示 Agent 使用 `create_plan` tool

---

## 3. Tool 列表（13 个）

### 3.1 查询型 Tool（只读）

| Tool | 输入 | 输出 | 职责 |
|------|------|------|------|
| `get_task_status` | `runId: string` | `task: TaskJSON` | 查询完整 Task JSON |
| `get_task_files` | `runId: string` | `files: File[]` | 获取任务关联文件列表 |
| `get_planning_guide` | `phase: string` | `guide: string` | 获取 planning 阶段指导 |
| `get_monitoring_guide` | `runId: string` | `guide + currentPhase + historyDeviations` | 获取 monitoring 指导 |
| `get_regulation_guide` | `runId: string` | `guide + deviationSummary` | 条件可用（有未处理偏差时） |
| `get_development_guide` | `runId: string` | `guide + Event摘要` | 获取 development 指导 |
| `self_diagnose` | `runId?: string` | `diagnosis: object` | 诊断当前任务/全局状态 |

### 3.2 操作型 Tool（读写，被动响应）

| Tool | 输入 | 输出 | 职责 |
|------|------|------|------|
| `create_plan` | `runId, prompt, planInput?` | `task: TaskJSON` | 创建 draft task |
| `update_task_status` | `runId, status, reason?` | `success: boolean` | 更新 task 状态 |
| `advance_phase` | `runId, phaseId?` | `success + nextPhase` | 推进 currentPhase |
| `record_deviation` | `runId, type, description, impact?` | `success + deviation` | 记录偏差到 task + 事件文件 |
| `record_attribution` | `runId, rootCause, impact?, strategy` | `success + attribution` | 记录归因到 task + 事件文件 |
| `archive_task` | `runId: string` | `success: boolean` | 归档 completed task |

### 3.3 Tool 与 Hook 的协作关系

```
Agent 调用 create_plan()
    └→ Tool handler 写入 .agent/tasks/{runId}.json
    └→ before_agent_finalize 解析 ctx.toolCalls（双重保险）

Agent 调用 update_task_status("active")
    └→ Tool handler 更新 task.status
    └→ before_agent_finalize 解析 toolCall.result（双重保险）

Agent 调用 record_deviation()
    └→ Tool handler 追加到 task.deviations[]
    └→ Tool handler 追加到 .agent/events/{date}/{time}.md

Agent 调用 archive_task()
    └→ Tool handler 调用 state.archiveTask()
    └→ agent_end 时已完成清理
```

---

## 4. Hook 注入映射（v4.1.0）

### 4.1 tool-driven 模式（默认）

| task.status | before_prompt_build 注入内容 | 目的 |
|-------------|------------------------------|------|
| 无 task | 最小化提示：状态=none + 可用 tools 列表 | 提示 Agent 评估任务复杂度 |
| `draft` | 最小化提示：状态=draft + 可用 tools 列表 | 提示 Agent 调用 get_planning_guide("draft") |
| `pending_approval` | 最小化提示：状态=pending_approval + 可用 tools 列表 | 提示 Agent 处理用户反馈 |
| `active` | 最小化提示：状态=active + 当前阶段 + 可用 tools 列表 | 提示 Agent 调用 get_monitoring_guide() |
| `revising` | 最小化提示：状态=revising + 可用 tools 列表 | 提示 Agent 调用 get_planning_guide("revising") |
| `completed` | 最小化提示：状态=completed + 可用 tools 列表 | 提示 Agent 调用 get_development_guide() |

### 4.2 legacy 模式（向后兼容）

保留 v4.0.0 完整 skill 注入逻辑：
- 无 task → planning skill（评估阶段）
- draft → planning skill + 文件上下文
- pending_approval → planning skill + 反馈处理
- active → monitoring + regulation(条件) + 执行上下文
- revising → planning + regulation(条件)
- completed → 无注入（agent_end 纯观察）

---

## 5. 状态流转（Tool 驱动版）

```
用户输入
    │
    ▼
Agent 调用 get_task_status()
    ├─ 无 task → get_planning_guide("assessment") → 评估 → create_plan()
    ├─ draft → get_planning_guide("draft") → 制定 Plan → update_task_status("pending_approval")
    ├─ pending_approval → 处理用户反馈 → update_task_status("active") / ("revising") / ("completed")
    ├─ active → get_monitoring_guide() → 执行 → advance_phase() / record_deviation()
    ├─ revising → get_planning_guide("revising") → 修订 → update_task_status("active")
    └─ completed → get_development_guide() → 分析 → archive_task()
```

**与 v4.0.0 的区别**：
- v4.0.0：插件根据 task.status **推送** skill 文本，Agent 被动接收
- v4.1.0：插件 **暴露 tools**，Agent 主动调用获取指导

---

## 6. 向后兼容说明

| 变更 | 兼容性 | 处理方案 |
|------|--------|---------|
| 新增 13 个 Tools | ✅ 向后兼容 | 新增功能，不影响现有流程 |
| `before_prompt_build` 注入简化 | ⚠️ **BREAKING** | `injectionMode: "legacy" \| "tool-driven"`，默认 `"tool-driven"` |
| `[STATUS]` / `[NEED_PLAN]` 标记 | ✅ 向后兼容（deprecated） | `before_agent_finalize` 继续解析，但推荐改用 tool 调用 |
| Skill 文件（SKILL.md） | ✅ 向后兼容 | 保留作为 tool 返回的文本源 |

---

## 7. 钩子调用链日志（v4.1.0-M4 新增）

**日志文件**：`~/.agent/logs/agent-self-development-hooks.log`

### 7.1 单条 hook 日志格式

```
[timestamp] [hookName] [pluginId] [runId] [status] elapsed=Nms type=T
```

示例：
```
[2026-05-11T10:03:12.345Z] [before_prompt_build] [agent-self-development] [run-abc] [returned] elapsed=2ms type=modifying
[2026-05-11T10:03:15.678Z] [llm_output] [agent-self-development] [run-abc] [ok] elapsed=1ms type=void
[2026-05-11T10:03:16.901Z] [before_agent_finalize] [agent-self-development] [run-abc] [returned] elapsed=3ms type=claiming
```

### 7.2 调用链汇总日志格式

```
[timestamp] [runId] [hookChain=a:ok:2ms,b:ok:1ms,c:returned:3ms] [complete] total=N
```

示例：
```
[2026-05-11T10:03:17.000Z] [run-abc] [hookChain=before_prompt_build:returned:2ms,llm_output:ok:1ms,before_agent_finalize:returned:3ms,agent_end:ok:1ms] [complete] total=4
```

**可还原信息**：
- 哪些 hook 执行了（hookChain 列表）
- 各 hook 执行耗时（elapsedMs）
- 各 hook 返回状态（ok / returned / warn / error / timeout）
- 错误 hook 的错误信息（error 字段）

**flush 时机**：
- `agent_end` 时自动 flush（status=complete）
- `gateway_stop` 时 flush 所有剩余 chain（status=flushed）
- 5 分钟无新 hook 的旧 chain 自动清理（status=incomplete）

---

## 8. 红线（合规要求）

- `llm_output` 和 `agent_end` 为**纯观察型 hook**，禁止返回 `prependSystemContext` 或 `action`
- 所有 skill 注入必须通过 `before_prompt_build` 或 `before_agent_finalize`
- VOID 型 hook 返回非空值时，HookRegistry 会记录 warn 并忽略返回值
- MODIFYING 型 hook 返回值必须包含 `prependSystemContext` 或 `prependContext`
- CLAIMING 型 hook 返回值必须包含 `action` 字段

---

*文档版本：v4.1.0*
*最后更新：2026-05-11*
*维护者：Developer*
