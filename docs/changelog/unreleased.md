# Unreleased

## Added
- `skills/openclaw-skill-dev/` — skill authoring guide for OpenClaw plugin development
- `.openclaw/` 目录结构 — 项目级元数据层（events, locks, decisions, tasks）
- `.openclawignore` — 可见性控制文件
- 业务目录 — manuscripts/, knowledge/, temp/, uploads/
- 四文件契约 — README.md（更新）, metadata.json, SKILL.md（项目级）, TODO.md
- `.mcp.json` — 项目级配置占位
- `getTaskFilePaths()` 静态方法 — 从项目级 tasks/{runId}.json 读取文件列表
- WM `before_prompt_build` 注入 — 文件系统上下文管理（条件注入）
- 文件变更审计追踪 — after_tool_call 扩展，读取事件文件变更记录

## Changed
- `docs/technical/` renamed to `docs/reference/`
- **版本升级至 v4.0.0** — 项目上下文层 & 多 Agent 协作体系
- monitoring 职责重定义 — 从"偏差检测器"改为"偏差预防提醒 + 自我监控指引"
- regulation 注入改为条件注入 — 事件文件中有未处理偏差时触发
- Personality 数据供给改为事件文件驱动 — 向后兼容回退到 task 顶层字段
- WM 移除全局索引 `working_memory:active_sessions` — 上下文保持转向文件系统
- 所有 SKILL.md 更新至 v4.0.0 — planning, monitoring, regulation, working_memory, development
- 参考文档同步更新 — data-model.md, hook-reference.md, state-keys.md, architecture.md
- 归档逻辑调整 — agent_end 读取项目级事件文件和 task 索引，写入系统层 Memory
