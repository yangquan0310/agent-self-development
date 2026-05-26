# Unreleased

> 发布日期：2026-05-26

## Beta Release

- **v4.5.1-beta.0** — Beta 版本发布
  - 修复 registry.test.js mock API 兼容性问题
  - baseDir 参数调整（从 params.baseDir 动态提取）
  - npm test 98/98 通过

---

# v4.5.0

> 发布日期：2026-05-26

## Project Rename

- **项目名称变更**：`agent-self-development` → `agent-autobiography`
  - 理由：更准确地反映项目的核心功能——自传体记忆（Autobiographical Memory），记录 Agent 的事件记忆与发展历程

## Added

- `src/hooks/condition.js` — Hook 条件判断逻辑
  - `evaluateAfterToolCall()`：判断 after_tool_call 是否需要触发注入
  - `evaluateBeforePromptBuild()`：判断 before_prompt_build 是否需要触发注入
  - `REMINDERS`：4 个提醒文本（taskCreated / deviationDetected / eventGenerated / noActiveTask）
- `test/hooks-conditional.test.js` — Hooks 条件触发测试（17 个用例）
- Hook 注入时机矩阵（4 个触发场景）

## Changed

- **插件入口重写** — `src/index.js` 从 v4.4.0 的 session_start/after_compaction/before_prompt_build 改为 after_tool_call + before_prompt_build 条件触发
- **版本升级至 v4.5.0** — 项目名称 + Hook 机制升级
- task.update 返回值 — 新增 `deviationRecorded` 字段，标记是否记录了偏差
- `before_prompt_build` 行为变更 — 从"每次触发"改为"只在无 active task 时触发"（M4）

## Hook 注入时机矩阵

| # | 触发时机 | 监听工具 | 条件 | 注入内容 | IdempotencyKey |
|---|----------|----------|------|----------|----------------|
| M1 | 任务创建后 | `task.create` | 返回成功 | 提醒：制定计划 → 拆解 TODO | `agent-autobiography:task-created` |
| M2 | 偏差记录后 | `task.update` | deviationRecorded=true | 提醒：执行偏差分析 → 归因分析 | `agent-autobiography:deviation-detected` |
| M3 | 事件生成后 | `event.report` | 返回成功 | 提醒：六维度平衡性判断 | `agent-autobiography:event-generated` |
| M4 | 无任务执行时 | `before_prompt_build` | 无 active task | 提醒：创建任务 | `agent-autobiography:no-active-task` |

---

# v4.4.0

> 发布日期：2026-05-21

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

## Changed

- **架构扁平化（ADR-014）** — 从四层架构 + 类层次 退回到 Agent/Tool/文件系统三层
- **版本升级至 v4.3.0** — 纯 Tool Plugin，无 Hook 注入
- `src/` 目录重构 — 移除 `metacognition/`、`working-memory/`、`personality/`、`common/adapters/`，收敛为 `objects/` + `tools/` + `utils/` + `assets/`
- 工具注册方式 — 从 13 个工具（含 guide 类）精简为 8 个命名空间工具（task 5 个 + event 3 个）
- 事件生成策略 — 从增量追加改为延迟一次性生成（`event.report`）
- task.json 字段 — 移除 `sessionIds`、`tools`、`revisionReason`
- 时间戳格式 — 从 Unix 毫秒数改为 ISO-8601 字符串
