# Release 流程

> 项目：agent-self-development
> 维护者：Developer / PM

---

## v4.2.0 — Cognitive Intelligence（2026-05-13）

**主题**：让 Tool-Driven 架构从「可用」走向「智能」

**核心交付**：
- **认知轨迹基础设施**（P0-1）：每次 tool 调用记录到 `~/.agent/cognitive-traces/{runId}.jsonl`，`self_diagnose` 返回 `cognitiveTraceSummary`
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

1. **冻结功能** — 确认当前里程碑所有 P0 任务完成
2. **全量测试** — `npm test`，确保 120/120 通过
3. **更新版本号** — `package.json` + `src/index.js` plugin version
4. **更新 TODO.md** — 标记版本发布完成，更新历史版本表
5. **打 tag** — `git tag v{X.Y.Z} {commit}`
6. **推送 tag** — `git push origin v{X.Y.Z}`
7. **生成报告** — `docs/reports/test-YYYY-MM-DD-HH-mm-ss.md`

## 历史 Tag 链

```
v1.0.0 → v1.1.0 → v1.1.1 → v1.1.2 → v1.2.0 → ... → v1.3.0
v2.0.0 → v2.0.1 → v2.0.2
v3.0.0 → v3.1.0 → v3.1.1 → v3.1.2 → v3.1.3 → v3.2.0 → v3.2.1 → v3.3.0 → v3.4.0 → v3.4.1 → v3.5.0 → v3.6.0
v4.0.0 → v4.1.0 → v4.2.0（当前）
```

## 技术债务记录

| 版本 | 债务 | 计划修复版本 |
|------|------|-------------|
| v4.1.0 | 硬编码 `/root/.agent` 路径 | v4.2.0（RISK-1）✅ |
| v4.1.0 | 双重状态更新路径 | v4.2.0（RISK-4）✅ |
| v4.1.0 | 事件文件路径解析重复 | v4.2.0（RISK-2）✅ |
| v4.1.0 | Heartbeat 未接入 HookRegistry | v4.2.0（RISK-3）✅ |
| v4.1.0 | 项目级文件路径未集中抽象 | v4.2.0（RISK-8）✅ |
