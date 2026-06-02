# Release 流程

> 项目：agent-self-development
> 维护者：Developer / PM

---

## v4.3.0 — Flat Tool Plugin（2026-05-31）

**主题**：从「全功能认知框架」退回到「极简工具插件」

**核心交付**：
- **扁平架构重构（ADR-014）**：移除所有类和 Hook 注入，采用纯函数 + 直接 IO
- **目录清理（M1）**：`src/` 下仅剩 `objects/`、`tools/`、`utils/`、`assets/`，旧模块零残留
- **8 个命名空间工具（M2）**：`task_create/update/advance/get/archive` + `event_report/query/archive`
- **通用更新入口**：`task_update` 支持 status/deviation/attribution/outcome/eventFilePath/reason 任一字段
- **延迟事件生成**：`event_report` 任务完成后一次性从 task.json 凝练生成 event.md
- **归档目录**：`.agentsarchive/tasks/` + `.agentsarchive/events/` 分离活跃与归档数据
- **测试套件重写（M3）**：覆盖正常/异常/边界路径

**移除**：
- 7 个 Hook 注入（`before_prompt_build`、`agent_end` 等）
- 3 个认知模块（metacognition / working-memory / personality）
- 适配器层（State / Memory / Flow / Log / Hook 类）
- 5 个 guide 类工具 + 4 个诊断/文件类工具
- 系统级持久化（`~/.agentsstate/`、`~/.agentsmemory/`、`~/.agentslogs/`）
- 废弃字段 `sessionIds`、`tools`、`revisionReason`

**参考文档同步**：`architecture.md`、`object-model.md`、`data-model.md`、`project-structure.md`、`state-keys.md`、`design-philosophy.md`

---

## v4.2.0 — Cognitive Intelligence（2026-05-13）

**主题**：让 Tool-Driven 架构从「可用」走向「智能」

**核心交付**：
- **认知轨迹基础设施**（P0-1）：每次 tool 调用记录到 `~/.agentscognitive-traces/{runId}.jsonl`，`self_diagnose` 返回 `cognitiveTraceSummary`
- **模板智能渲染引擎**（P0-2）：`src/common/template-engine.js` 支持变量/条件/列表/嵌套，4 个 guide tools 集成
- **案例索引数据库**（P0-3）：SQLite + Jaccard 相似度，`create_plan` 返回相似案例，`archive_task` 自动索引
- **诊断增强 v2**（P0-4）：`self_diagnose` 返回 `trendAnalysis`（阶段耗时/偏差频率/历史均值）+ `riskFlags`（最多 3 条预警）
- **硬编码路径修复**（P0-5 / RISK-1）：`os.homedir()` + `OPENCLAW_AGENT_DIR` 环境变量覆盖，5 文件 6 处修复
- **双重状态更新修复**（P0-6 / RISK-4）：Tool Handler 为唯一写入者，Hook 层只读校验
- **git tag 规范化**（P1-1）：补打 v3.3.0 ~ v4.1.0 tag，`package.json` 升至 4.2.0
- **任务类型模板**（P1-2）：新增 coding / research / documentation 专用 planning 模板，`create_plan` 支持 `taskType`
- **路径抽象完善**（P1-3 / P2-5 / RISK-2 / RISK-8）：`src/common/project-context.js` 集中管理系统级/项目级路径，`getBaseDir` 零重复
- **Heartbeat 接入 HookRegistry**（P1-4 / RISK-3）：统一注册模式，获得错误捕获/超时保护/调用链追踪

**测试**：126/126 断言通过，45 个 suite，0 失败

---

## 版本号规范

- 格式：`v{major}.{minor}.{patch}`
- Git tag 与 `package.json` version 保持一致
- TODO.md 头部标注当前版本

## 发布步骤

1. **删除错误 tag** — `4.3.0`（不带 v）
2. **更新版本号** — `package.json` + `openclaw.plugin.json` 保持一致 ✅
3. **重新打 tag** — `git tag -f v4.3.0`
4. **推送 tag** — `git push origin v4.3.0 --force`
5. **触发 workflow** — GitHub Actions 自动验证 + 打包 + Release

## 历史 Tag 链

```
v1.0.0 → v1.1.0 → v1.1.1 → v1.1.2 → v1.2.0 → ... → v1.3.0
v2.0.0 → v2.0.1 → v2.0.2
v3.0.0 → v3.1.0 → v3.1.1 → v3.1.2 → v3.1.3 → v3.2.0 → v3.2.1 → v3.3.0 → v3.4.0 → v3.4.1 → v3.5.0 → v3.6.0
v4.0.0 → v4.1.0 → v4.2.0 → v4.3.0（当前）
```

## 技术债务记录

| 版本 | 债务 | 计划修复版本 |
|------|------|-------------|
| v4.1.0 | 硬编码 `/root/.agent` 路径 | v4.2.0（RISK-1）✅ |
| v4.1.0 | 双重状态更新路径 | v4.2.0（RISK-4）✅ |
| v4.1.0 | 事件文件路径解析重复 | v4.2.0（RISK-2）✅ |
| v4.1.0 | Heartbeat 未接入 HookRegistry | v4.2.0（RISK-3）✅ |
| v4.1.0 | 项目级文件路径未集中抽象 | v4.2.0（RISK-8）✅ |
| v4.2.0 | 架构过重，与 Tool Plugin 定位不符 | v4.3.0（ADR-014）✅ |
| v4.2.0 | Hook 注入使 Agent 行为难以预测 | v4.3.0（ADR-014）✅ |
| v4.2.0 | 13 个工具过多，认知指导类工具越界 | v4.3.0（ADR-014）✅ |
