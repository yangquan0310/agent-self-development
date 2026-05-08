# 状态存储键空间

| 键 | 存储域 | 类型 | 生命周期 | 说明 |
|----|--------|------|----------|------|
| `task:{runId}` | State (插件) | Task JSON | runId | 统一任务 JSON：`plan` + `deviations` + `attributions` + `outcome` + `sessionIds` + `tools`（`state/tasks/{runId}.json`） |
| `session:{sessionId}` | State (插件) | Session | 长期 | 任务空间（`state/sessions.json`） |
| `working_memory:active_sessions` | State (插件) | Session[] | 全局 | 全局活跃任务空间索引（`state/sessions.json`） |
| `flow:{flowId}` | Flow | Flow | 长期 | Flow 工作流实例（`flows/registry.sqlite`） |
| `task:{runId}` | Task (核心) | TaskRecord | runId | 任务元数据（`tasks/runs.sqlite`） |
| `eventlog:{YYYY-MM-DD}` | Memory | EventLog | 日期 | 按日聚合的事件（`memory/{agentId}.sqlite`） |
| `logs:{YYYY-MM-DD}` | Log | LogEntry[] | 日期 | 按日累积的日志（`logs/{agentId}.log`） |
| `prompt:${runId}` | State | String | runId | `before_prompt_build` 缓存的用户原始 prompt，供 `before_agent_finalize` 读取创建 draft task |

## 命名规则

- State 插件键：`{domain}:{identifier}`（如 `task:{runId}`、`session:{sessionId}`）
- 全局索引键：`working_memory:active_sessions`
- Memory 日志键：`eventlog:{YYYY-MM-DD}`、`logs:{YYYY-MM-DD}`
- Prompt 缓存键：`prompt:${runId}`（使用模板字符串语法，实际存储时替换为具体 runId）
