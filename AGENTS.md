# Agent Self-Development — Agent 开发指南

> 本文档面向 coding agent，记录项目背景、架构决策、编码规范与开发偏好。

---

## 1. 项目背景

OpenClaw 插件，基于皮亚杰认知发展理论的 Agent 自我发展框架。

**核心原则**：用户领航 → Agent 执行 → 插件书记员只记录（Plugin asks, Agent decides, Plugin records）

**三层认知架构**：
- 元认知层（Metacognition）：计划 → 监控 → 调节
- 工作记忆层（Working Memory）：Session = 情景缓冲器
- 人格发展层（Personality）：同化 / 顺应 → 人格文件更新

---

## 2. 架构决策（v3.5.0）

### 2.1 钩子合规规范（强制执行）

| 类型 | 钩子 | 能否返回 `prependSystemContext` | 能否返回 `action` |
|------|------|-------------------------------|------------------|
| **决策/注入型** | `before_prompt_build` | ✅ 可返回 | — |
| **决策/注入型** | `before_agent_finalize` | — | ✅ 可返回 `{action, reason, retry?}` |
| **决策/注入型** | `heartbeat_prompt_contribution` | ✅ 可返回 `prependContext` | — |
| **纯观察型** | `llm_output` | ❌ 禁止 | ❌ 禁止 |
| **纯观察型** | `agent_end` | ❌ 禁止 | ❌ 禁止 |
| **纯观察型** | `before_tool_call` / `after_tool_call` | — | — |
| **纯观察型** | `subagent_spawning` / `subagent_spawned` / `subagent_ended` | ❌ 禁止 | — |

> **红线**：`llm_output` 和 `agent_end` 中如果出现 `return { prependSystemContext: ... }`，必须立即重构到 `before_prompt_build` 或 `before_agent_finalize`。

### 2.2 Skill 注入时机映射

| Task 状态 | `before_prompt_build` 注入的 skill |
|-----------|-----------------------------------|
| 无 task | `planning`（评估阶段） |
| `draft` | `planning`（制定阶段） |
| `pending_approval` | `planning`（汇报/处理反馈） |
| `revising` | `planning` + 修改原因 |
| `active` | `monitoring` + 执行上下文 |
| `completed` | `development`（人格回顾） |

### 2.3 状态转换机制

Agent 输出标记 → `before_agent_finalize` 解析 → 写入 State

```
[STATUS: pending_approval]
[STATUS: active]
[STATUS: revising] [REASON: xxx]
[STATUS: completed]
```

### 2.4 Prompt 暂存

`before_prompt_build` 把用户原始 prompt 存 `ctx.state.set('prompt:${runId}', prompt)` → `before_agent_finalize` 读取用于创建 draft task。

---

## 3. 编码规范

### 3.1 命名规范

| 层级 | 规范 | 示例 |
|------|------|------|
| 类名 | 单一非复合名词，PascalCase | `Metacognition`, `WorkingMemory`, `Heartbeat` |
| 方法名 | 动词开头，camelCase | `createPlan()`, `onBeforePromptBuild()`, `archiveTask()` |
| 文件名 | 与类名一致，小写 | `module.js`, `plan.js`, `event.js` |
| 模块入口 | 统一为 `module.js` | `metacognition/module.js` |

### 3.2 模块结构

每个业务模块遵循统一结构：

```javascript
export class ModuleName {
  constructor({ api, config, state, skills, logger, log, ...deps }) {
    // 依赖注入
  }

  register() {
    // 注册所有 hooks
  }

  // v3.5.0: 统一清理接口
  stop() {
    // Gateway 停止时释放资源
  }
}
```

### 3.3 错误处理

- 适配器方法使用 try-catch，失败时记录日志但不阻断流程
- Hook 处理器内部错误不应导致 OpenClaw 崩溃
- 数据库操作后必须关闭连接（`gateway_stop` 中统一处理）

---

## 4. 数据模型

### 4.1 Task JSON（v3.5.0）

```json
{
  "runId": "uuid",
  "status": "draft | pending_approval | active | revising | completed",
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000,
  "plan": { "prompt", "context", "workspace", "execution" },
  "deviations": [],
  "attributions": [],
  "outcome": {},
  "sessionIds": [],
  "tools": []
}
```

> ❌ 已移除 `event` 嵌套字段。`deviations` / `attributions` / `outcome` 为顶层字段。

### 4.2 EventLog（Memory）

```json
{
  "runId": "uuid",
  "status": "completed",
  "deviations": [],
  "attributions": [],
  "outcome": {},
  "plan": { "prompt", "phaseCount" },
  "archivedAt": 1234567890000
}
```

---

## 5. 开发偏好

- **最小修改原则**：只做必要的变更，不重构无关代码
- **向后兼容**：适配器支持 `api === null` 时回退到文件系统
- **防御性编程**：OpenClaw 钩子可能不存在，使用 try-catch 或标志位保护
- **日志规范**：所有模块使用 `[Module] message` 前缀，`logger.debug/info/warn/error`
- **版本注释**：重大变更添加 `// v3.5.0: description` 注释

---

## 6. 文件清单

| 路径 | 职责 | 修改频率 |
|------|------|----------|
| `src/index.js` | 插件入口，依赖注入 | 低 |
| `src/metacognition/module.js` | 元认知 hooks 注册与调度 | 中 |
| `src/metacognition/plan.js` | Plan 业务逻辑 | 低 |
| `src/metacognition/deviation.js` | Deviation 业务逻辑 | 低 |
| `src/metacognition/attribution.js` | Attribution 业务逻辑 | 低 |
| `src/metacognition/event.js` | Event 归档逻辑 | 低 |
| `src/working-memory/module.js` | 工作记忆 hooks 注册 | 中 |
| `src/working-memory/session.js` | Session 业务逻辑 | 低 |
| `src/personality/module.js` | 人格 hooks 注册 | 中 |
| `src/common/heartbeat.js` | Heartbeat 后台监控 | 低 |
| `src/common/skills.js` | Skill 加载 | 低 |
| `src/common/stream.js` | 流式输出处理 | 低 |
| `src/common/adapters/*.js` | 适配器层 | 低 |
