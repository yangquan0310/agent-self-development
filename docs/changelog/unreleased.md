# Unreleased

## Project Rename

- **项目名称变更**：`agent-self-development` → `agent-autobiography`
  - 理由：更准确地反映项目的核心功能——自传体记忆（Autobiographical Memory），记录 Agent 的事件记忆与发展历程
  - 日期：2026-05-26

## Added
- `src/objects/task.js` — 5 个裸函数（create/update/advance/get/archive），直接读写 `.agentstasks/{runId}.json`
- `src/objects/event.js` — 3 个裸函数（report/query/archive），直接读写 `.agentsevents/` 和 `.agentsarchive/events/`
- `src/tools/index.js` — 注册 8 个命名空间工具（task.* + event.*）
- `src/tools/schemas.js` — 8 个工具的 parameters schema
- `src/tools/handlers.js` — 薄适配层，包装 objects 函数返回值
- `src/tools/return-adapter.js` — 统一返回格式 `adaptReturn` / `adaptError`
- `src/utils/io.js` — 原子文件操作（ensureDir, readJson, writeJson, writeMarkdown, moveFile）
- `src/utils/resolve.js` — 路径解析器
- `src/utils/validate.js` — runId / status / 状态转换校验
- `src/utils/helpers.js` — getNow, generateRunId, generatePlan
- `src/assets/task.json` + `src/assets/event.md` — 模板文件
- `.agentsarchive/` — 归档目录结构（tasks/ + events/）
- `task.update` — 通用更新入口，支持 status/deviation/attribution/outcome/eventFilePath/reason 任一字段
- `event.report` — 任务完成后一次性从 task.json 生成 event.md
- `event.query` — 按 runId/date/type 筛选查询事件
- `event.archive` — 归档事件文件

## Changed
- **架构扁平化（ADR-014）** — 从四层架构 + 类层次 退回到 Agent/Tool/文件系统三层
- **版本升级至 v4.3.0** — 纯 Tool Plugin，无 Hook 注入
- `src/` 目录重构 — 移除 `metacognition/`、`working-memory/`、`personality/`、`common/adapters/`，收敛为 `objects/` + `tools/` + `utils/` + `assets/`
- 工具注册方式 — 从 13 个工具（含 guide 类）精简为 8 个命名空间工具（task 5 个 + event 3 个）
- 事件生成策略 — 从增量追加改为延迟一次性生成（`event.report`）
- task.json 字段 — 移除 `sessionIds`、`tools`、`revisionReason`
- 时间戳格式 — 从 Unix 毫秒数改为 ISO-8601 字符串
- 参考文档同步更新 — `architecture.md`、`object-model.md`、`data-model.md`、`project-structure.md`、`state-keys.md`、`design-philosophy.md`、`hook-reference.md`（标记废弃）

## Removed
- Hook 注入层 — `before_prompt_build`、`before_agent_finalize`、`agent_end` 等 7 个 Hook 全部移除
- 认知模块 — `src/metacognition/`（plan/deviation/attribution/event）
- 工作记忆模块 — `src/working-memory/`（session 生命周期管理）
- 人格模块 — `src/personality/`（同化/顺应驱动）
- 适配器层 — `State` / `Memory` / `Flow` / `Log` / `Hook` 类
- 管理器层 — `Plan` / `Session` / `Deviation` / `Attribution` 类
- Guide 类工具 — `guide.planning`、`guide.monitoring`、`guide.regulation`、`guide.development`
- 诊断/文件类工具 — `task.files`、`task.diagnose`、`task.deviate`、`task.attribute`
- 旧版 flat 工具名 — `create_plan`、`update_task_status`、`advance_phase`、`archive_task` 等
- 系统级持久化 — `~/.agentsstate/`、`~/.agentsmemory/`、`~/.agentslogs/` 等系统层存储
- `src/common/hook.js` — HookRegistry
- `src/common/heartbeat.js` — 后台监控（如有）

## Deprecated
- `docs/reference/hook-reference.md` — v4.2.x Hook + Tool 混合架构，仅作历史存档
