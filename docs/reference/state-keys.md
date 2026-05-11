# 状态存储键空间

## 项目级键（Agent 读写，插件读取）

| 键/文件 | 存储域 | 类型 | 生命周期 | 说明 |
|---------|--------|------|----------|------|
| `.agent/tasks/{runId}.json` | 项目文件系统 | TaskIndex JSON | runId | 项目级任务文件索引：文件列表、Agent 信息、类型（draft/artifact） |
| `.agent/tasks/INDEX.md` | 项目文件系统 | Markdown | 项目全周期 | 任务索引：按日期分组列出所有任务摘要 |
| `.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md` | 项目文件系统 | Markdown | 任务期间 | 事件文件：元信息→计划→执行→变更记录→偏差→归因→结果 |
| `.agent/locks/{file-path}.json` | 项目文件系统 | Lock JSON | 10分钟 | 文件锁：并发控制，Agent 编辑前创建、编辑后删除 |
| `README.md` | 项目文件系统 | Markdown | 项目全周期 | 项目总览：项目定位、目录结构、快速开始 |
| `metadata.json` | 项目文件系统 | JSON | 项目全周期 | 机器可读架构：模块列表、技能列表、Agent 能力定义 |
| `SKILL.md` | 项目文件系统 | Markdown | 项目全周期 | 项目级操作手册：工作流程、工具规范、输出格式 |
| `TODO.md` | 项目文件系统 | Markdown | 项目全周期 | 进度看板：待办/进行中/待分配/待确认/已完成 |

## 系统级键（插件读写，Agent 不直接访问）

| 键 | 存储域 | 类型 | 生命周期 | 说明 |
|----|--------|------|----------|------|
| `task:{runId}` | State (插件) | Task JSON | runId | 统一任务 JSON：`plan` + `deviations` + `attributions` + `outcome` + `sessionIds` + `tools`（`state/tasks/{runId}.json`） |
| `session:{sessionId}` | State (插件) | Session | 长期 | 任务空间（`state/sessions.json`） |
| `eventlog:{YYYY-MM-DD}` | Memory | EventLog | 日期 | 按日聚合的事件（`memory/{agentId}.sqlite`） |
| `logs:{YYYY-MM-DD}` | Log | LogEntry[] | 日期 | 按日累积的日志（`logs/{agentId}.log`） |
| `prompt:${runId}` | State | String | runId | `before_prompt_build` 缓存的用户原始 prompt，供 `before_agent_finalize` 读取创建 draft task |

## 已移除的键（v4.0.0）

| 键 | 移除原因 | 替代方案 |
|----|---------|---------|
| `working_memory:active_sessions` | 上下文保持从 Session 内存转向文件系统 | `.agent/tasks/{runId}.json` 文件列表 |

## [占位符] 系统层键（当前无消费者，待后续按需实现）

| 键 | 存储域 | 说明 |
|----|--------|------|
| `flow:{flowId}` | Flow | Flow 工作流实例（`flows/registry.sqlite`）— [占位符] |
| `task:{runId}` | Task (核心) | 任务元数据（`tasks/runs.sqlite`）— [占位符] |
| `state:archive` | State | 系统级 JSON 归档（`archive/tasks_archive.json`）— [占位符] |

## 命名规则

- State 插件键：`{domain}:{identifier}`（如 `task:{runId}`、`session:{sessionId}`）
- Memory 日志键：`eventlog:{YYYY-MM-DD}`、`logs:{YYYY-MM-DD}`
- Prompt 缓存键：`prompt:${runId}`（使用模板字符串语法，实际存储时替换为具体 runId）
