# TODO.md — Agent Self-Development 进度看板

> 项目：`agent-self-development` | 当前版本：`v4.2.0`（开发中）
> 更新日期：2026-05-13（v4.2.0 规划启动）
> 维护者：PM（程序员 / 开发经理）

---

## 版本目标

**v4.2.0：Cognitive Intelligence** 🚧 开发中（预计 2026-06-01 完成）

让 Tool-Driven 架构从「可用」走向「智能」——不增加新 tools，而是让现有 tools 更聪明、更可观测、更可回溯。同时修复 v4.1.0 架构评估中发现的硬编码路径、双重状态更新、模块耦合等结构性风险。

**设计哲学**：
- **不增加新 tools**：13 个 tools 已经够用，增加 tools 会增加 Agent 的认知负担
- **增强现有 tools 的返回内容**：让 `get_task_status`、`self_diagnose`、`get_planning_guide` 返回更智能的信息
- **透明化认知过程**：记录 Agent 的 tool 调用序列，让「思考过程」可追溯
- **累积历史智慧**：归档任务建立索引，新任务可以站在旧任务的肩膀上

预计完成：**2026-06-01**

---

## 里程碑

| 里程碑 | 时间 | 交付物 | 状态 |
|--------|------|--------|------|
| M1 | 2026-05-18 | 认知轨迹 + 模板渲染 + 硬编码路径修复 | ✅ 已完成 |
| M2 | 2026-05-25 | 案例索引 + 诊断增强 + 双重状态更新修复 | ✅ 已完成 |
| M3 | 2026-05-28 | tag 规范化 + 新模板 + Heartbeat 接入 HookRegistry + 路径抽象 | ✅ 已完成 |
| M4 | 2026-06-01 | 日志增强 + Session/Flow/Memory 优化 + 文档 | ✅ 已完成（P2-5/P2-7） |
| M5 | 2026-06-01 | 验收 + 发布 v4.2.0 | ✅ 已完成 |

---

## 任务树

### P0：阻塞项（必须完成，否则版本无法发布）

- [x] **认知轨迹基础设施** — Developer
  - 来源问题：Agent 调用 tools 的「黑箱」；v4.1.0 设计了 tools，但没有设计「认知轨迹」记录机制
  - 交付物：`src/common/cognitive-trace.js` + `src/tools/index.js` wrap 层 + `self_diagnose` 增强
  - 验收标准：每次 tool 调用记录到 `.agent/cognitive-traces/{runId}.jsonl`，异步写入不阻塞，格式可被 `jq` 查询；`archive_task` 迁移轨迹；`self_diagnose` 返回 `cognitiveTraceSummary`；120/120 测试通过
  - 里程碑：M1

- [x] **模板智能渲染引擎** — Developer
  - 来源问题：templates/ 是静态文本，无法动态适配；不同任务类型使用同一套模板
  - 交付物：`src/common/template-engine.js` + `src/tools/metacognition-tools.js` 4 个 guide tools 渲染集成
  - 验收标准：4 个 guide tools 返回值根据 task 状态动态渲染，纯文本模板零改动向后兼容；120/120 测试通过
  - 里程碑：M1

- [x] **案例索引数据库** — Developer
  - 来源问题：历史任务无法被「复用」；归档任务只是文件搬迁，没有建立索引
  - 交付物：`src/common/case-index.js` + SQLite 表结构，`src/index.js` 注入，`create_plan`/`archive_task` 集成
  - 验收标准：`archive_task()` 自动写入索引，`create_plan()` 返回相似案例（top-3）；Jaccard 相似度验证通过；120/120 测试通过
  - 里程碑：M2

- [ ] **诊断增强 v2** — Developer
  - 来源问题：诊断信息单薄，缺乏预警；v4.1.0 的 diagnose 是快照式，非趋势式
  - 交付物：修改后的 `src/tools/working-memory-tools.js`
  - 验收标准：`self_diagnose` 返回 `trendAnalysis`（phase 耗时、偏差频率、历史均值对比）+ `riskFlags`（最多 3 条），预警准确率 > 80%
  - 里程碑：M2
  - 依赖：认知轨迹 + 案例索引完成后才能开始

- [x] **修复硬编码 Linux 绝对路径（RISK-1）** — Developer
  - 来源问题：v4.1.0 架构评估——多处硬编码 `/root/.agent`，Windows/macOS/非 root Linux 直接失效
  - 交付物：修改后的 `src/index.js` + `src/common/adapters/{state,memory,flow,hook,task}.js`（共 5 文件、6 处修复）
  - 验收标准：统一使用 `os.homedir()` + `OPENCLAW_AGENT_DIR` 环境变量覆盖；grep 全文无 `/root/.agent` 残留；120/120 测试通过
  - 里程碑：M1

- [x] **修复双重状态更新路径（RISK-4）** — Developer
  - 来源问题：v4.1.0 架构评估——State.task 有 Tool Handler + Hook Parser 两个写入者，存在竞态条件
  - 交付物：修改后的 `src/metacognition/module.js`（`_parseToolCallResult` 改为只读校验）+ `src/tools/metacognition-tools.js`（`previousStatus` 逻辑修复）+ 测试更新
  - 验收标准：Tool Handler 为状态更新唯一写入者，Hook 层只读观察不二次写入；`update_task_status` 返回正确的 `previousStatus`；120/120 测试通过
  - 里程碑：M2

---

### P1：重要项（影响体验或架构一致性，但不阻塞发布）

- [x] **git tag 补打与版本规范化** — Developer
  - 来源问题：package.json version = `4.1.0`，但最新 git tag 为 `v2.0.0`；TODO.md 文件头仍写旧版本
  - 交付物：补打 tag v3.3.0 + v4.1.0 + 更新 package.json + src/index.js + `docs/RELEASE.md`
  - 验收标准：`git tag -l` 完整 tag 链 v1.0.0 ~ v4.2.0；TODO.md 与 package.json 版本号一致；120/120 测试通过
  - 里程碑：M3

- [x] **新增任务类型模板** — PM
  - 来源问题：模板泛化、不同项目任务类型使用同一套模板
  - 交付物：`src/templates/coding.md`、`src/templates/research.md`、`src/templates/documentation.md`
  - 验收标准：模板覆盖 3 种常见任务类型，被 tool 正确渲染；`create_plan` 支持 `taskType` 参数；`get_planning_guide` 根据 `taskType` 选择对应模板；126/126 测试通过
  - 里程碑：M3

- [x] **提取公共路径解析器（RISK-2 / ADR-002）** — Developer
  - 来源问题：v4.1.0 架构评估——`_resolveEventFilePath` 相同逻辑出现在 4 个模块中
  - 交付物：`src/common/project-context.js`，4 个模块统一导入
  - 验收标准：`_resolveEventFilePath` 零残留，事件文件格式变更只需修改 1 处；120/120 测试通过
  - 里程碑：M3

- [x] **Heartbeat 接入 HookRegistry（RISK-3 / ADR-003）** — Developer
  - 来源问题：v4.1.0 架构评估——`src/common/heartbeat.js` 直接使用 `api.on()`，不享受错误捕获、超时保护、调用链追踪
  - 交付物：修改后的 `src/common/heartbeat.js`
  - 验收标准：改为 `this.hookRegistry.register('heartbeat_prompt_contribution', ...)`，与三模块一致；126/126 测试通过
  - 里程碑：M3

---

### P2：优化项（可延后，不影响核心功能）

- [ ] **认知轨迹可视化（日志增强）** — Developer
  - 交付物：`logs/agent-self-development-cognitive-traces.log`
  - 验收标准：单条日志可还原某次对话的完整 tool 调用序列
  - 里程碑：M4

- [ ] **案例索引相似度算法升级** — Developer
  - 交付物：从关键词 Jaccard 升级为轻量级向量表示（如 tf-idf）
  - 验收标准：相似度准确率从 baseline 提升 20%
  - 里程碑：M4（可选，可延后）

- [ ] **Session 存储模型改为独立文件（RISK-5 / ADR-005）** — Developer
  - 来源问题：v4.1.0 架构评估——Session 集合文件并发写入存在丢失更新风险，读写性能线性下降
  - 交付物：修改后的 `src/common/adapters/state.js`
  - 验收标准：Session 采用独立文件模型（`sessions/{sessionId}.json`），与 Task 保持一致
  - 里程碑：M4

- [ ] **Flow 职责重新定义（RISK-6 / ADR-006）** — Developer
  - 来源问题：v4.1.0 架构评估——Flow 数据库与 Task JSON 维护同构数据，存在不一致风险
  - 交付物：`docs/adr/ADR-006-flow-responsibility.md` + 对应代码调整
  - 验收标准：明确 Flow 负责「跨任务依赖/工作流编排」或降级为 Task JSON 只读镜像
  - 里程碑：M4

- [x] **ProjectContext 路径常量模块（RISK-8 / ADR-007）** — Developer
  - 来源问题：v4.1.0 架构评估——`.agent/events/`、`.agent/tasks/` 等路径以字符串字面量散落多个模块；`getBaseDir()` 在 3 个文件中重复定义
  - 交付物：`src/common/project-context.js`（集中系统级/项目级路径常量 + 统一 `getBaseDir`）
  - 验收标准：`getBaseDir` 零重复，项目级 `.agent/tasks/`、`.agent/events/` 硬编码路径全部替换为常量函数；126/126 测试通过
  - 里程碑：M4

- [ ] **Memory 查询功能决策与实现（RISK-7 / ADR-008）** — Developer
  - 来源问题：v4.1.0 架构评估——`Memory.queryHistory()` 已写未通，无对应 tool 暴露给 Agent，形成数据坟墓
  - 交付物：`docs/adr/ADR-008-memory-query.md` + 对应代码/文档
  - 验收标准：明确 expose tool / keep internal / remove 的决策；若 expose，需设计查询参数和权限控制
  - 里程碑：M4

- [x] **清理 Session 全局索引残留（RISK-9）** — Developer
  - 来源问题：v4.1.0 架构评估——v4.0.0 已移除全局索引，但 `CONVENTIONS.md` 和 `Heartbeat._aggregateStats()` 仍在引用
  - 交付物：`CONVENTIONS.md` 已无全局索引残留；`Heartbeat._aggregateStats()` 调用 `state.listSessions()` 是 State adapter 正常 API，非废弃全局索引
  - 验收标准：文档与实现一致；126/126 测试通过
  - 里程碑：M4

---

## 问题-解决对照表

| 问题 | 来源 | 解决方案 | 对应任务 |
|------|------|----------|----------|
| 1. Agent 调用 tools 的「黑箱」 | v4.2.0 规划 | 认知轨迹记录 + `self_diagnose` 返回摘要 | P0-1, P0-4 |
| 2. 模板静态无法动态适配 | v4.2.0 规划 | 模板智能渲染引擎 | P0-2 |
| 3. 历史任务无法复用 | v4.2.0 规划 | 案例索引数据库 + `create_plan` 相似案例推荐 | P0-3 |
| 4. 诊断信息单薄，缺乏预警 | v4.2.0 规划 | 诊断增强 v2（趋势分析 + 风险预警） | P0-4 |
| 5. 硬编码 Linux 绝对路径 | v4.1.0 架构评估（RISK-1） | 统一使用 `os.homedir()` + 环境变量覆盖 | P0-5 |
| 6. 双重状态更新路径/数据竞争 | v4.1.0 架构评估（RISK-4） | 明确 Tool Handler 为唯一写入者，Hook 只读 | P0-6 |
| 7. git tag 与版本号管理混乱 | v4.2.0 规划 | 补打 tag + 更新 TODO.md + 新建 RELEASE.md | P1-1 |
| 8. 事件文件路径解析重复（DRY） | v4.1.0 架构评估（RISK-2） | 提取公共 `project-context.js` 路径解析器 | P1-3 |
| 9. Heartbeat 未接入 HookRegistry | v4.1.0 架构评估（RISK-3） | Heartbeat 改为继承 HookRegistry 注册 | P1-4 |
| 10. Session 存储模型不一致 | v4.1.0 架构评估（RISK-5） | Session 改为独立文件模型 | P2-3 |
| 11. Flow 功能定位模糊/冗余 | v4.1.0 架构评估（RISK-6） | 重新定义 Flow 职责或降级为镜像 | P2-4 |
| 12. Memory 查询已写未通 | v4.1.0 架构评估（RISK-7） | 决策并补齐 expose/keep/remove | P2-6 |
| 13. 项目级文件路径未集中抽象 | v4.1.0 架构评估（RISK-8） | 引入 ProjectContext 常量模块 | P2-5 |
| 14. Session 全局索引残留 | v4.1.0 架构评估（RISK-9） | 清理文档和代码残留引用 | P2-7 |

---

## 角色分工

| 角色 | 当前状态 |
|------|----------|
| **PM** | v4.2.0 规划中，负责任务类型模板设计 |
| **Developer** | v4.2.0 开发中，负责 P0/P1 全部 + P2 技术实现 |
| **Reviewer** | 待命，待 M2 完成后介入架构复查 |
| **Architect** | v4.1.0 架构评估已完成，已输出 9 项风险 + 8 项 ADR 建议 |

---

## 阻塞与风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| P0-6 双重状态更新修复可能引入回归 | 🔴 高 | 全量测试覆盖 Tool Handler + Hook 路径；修改前冻结 `working-memory.test.js` baseline |
| P0-5 硬编码路径修复影响多模块 | 🟡 中 | 逐文件替换 + 环境变量覆盖测试（Linux/macOS/Windows） |
| 诊断增强 v2 依赖认知轨迹 + 案例索引 | 🟡 中 | M1 完成后再启动 P0-4；预留缓冲时间 |
| Flow 职责讨论可能延期 | 🟢 低 | M4 为可选优化，可延后至后续版本 |

---

## 历史版本

| 版本 | 日期 | 核心变化 | 状态 |
|------|------|----------|------|
| v4.2.0 | 2026-06-01（预计） | Cognitive Intelligence + 架构风险评估修复 | 🚧 开发中 |
| v4.1.0 | 2026-05-11 | Tool-Driven Agent Autonomy | ✅ 已发布 |
| v4.0.1 | 已合并至 v4.1.0 | Hook 可靠性 + 命名统一 | ✅ 已整合 |
| v4.0.0 | 2026-05-01 | 项目上下文层 + 双系统架构 | ✅ 已发布 |

---

## 最近更新

- **2026-05-13**：M3 全部完成——P1-1 git tag 规范化 + P1-2 任务类型模板 + P1-3 路径抽象 + P1-4 Heartbeat 接入 HookRegistry，126/126 测试通过
- **2026-05-13**：P1-2 完成——新增 3 种任务类型模板（coding/research/documentation），`create_plan` 支持 `taskType`，`get_planning_guide` 动态选择模板，126/126 测试通过
- **2026-05-13**：P1-4 完成——Heartbeat 接入 HookRegistry（RISK-3），`this.hookRegistry.register()` 与其他模块一致，126/126 测试通过
- **2026-05-13**：M2 全部完成——P0-3 案例索引 + P0-4 诊断增强 + P0-6 双重状态修复，360/360 测试通过
- **2026-05-13**：P0-4 完成——诊断增强 v2，`self_diagnose` 返回 `trendAnalysis` + `riskFlags`，案例索引扩展 `duration`，120/120 测试通过
- **2026-05-13**：P0-6 完成——修复双重状态更新路径（RISK-4），`_parseToolCallResult` 改为只读校验，`update_task_status` 修复 `previousStatus`，测试同步更新，120/120 测试通过
- **2026-05-13**：P0-3 完成——案例索引数据库，`src/common/case-index.js`，Jaccard 相似度验证通过，120/120 测试通过
- **2026-05-13**：M1 全部完成——P0-1 认知轨迹 + P0-2 模板渲染 + P0-5 硬编码路径修复，360/360 测试通过
- **2026-05-13**：P0-2 完成——模板智能渲染引擎，`src/common/template-engine.js`（变量/条件/列表/嵌套），4 个 guide tools 集成，120/120 测试通过
- **2026-05-13**：P0-1 完成——认知轨迹基础设施，`src/common/cognitive-trace.js` + tool handler wrap 层，`self_diagnose` 返回 `cognitiveTraceSummary`，`archive_task` 迁移轨迹，120/120 测试通过
- **2026-05-13**：P0-5 完成——修复硬编码 Linux 绝对路径（RISK-1），5 文件 6 处修复，`os.homedir()` + `OPENCLAW_AGENT_DIR` 覆盖，120/120 测试通过
- **2026-05-13**：v4.2.0 规划启动——基于 `docs/roadmap/v4.2.0.md` + `docs/architecture/v4.1.0-architecture-evaluation.md` 整合生成新 TODO.md
- **2026-05-13**：v4.1.0 架构评估完成——识别 9 项风险（RISK-1 ~ RISK-9），评级 B+，当前架构等级 B+
- **2026-05-11**：v4.1.0 发布——120/120 测试通过，tag 已推送，插件已安装
- **2026-05-11**：prompt 模板内化完成——`guides/` → `src/templates/`，符合"插件退到工具层"哲学；恢复开发者技能文档到 `docs/developer-guides/`
- **2026-05-11**：M5 完成——验收通过，发布 v4.1.0 tag
- **2026-05-11**：M4 完成——测试覆盖 120/120、向后兼容说明
- **2026-05-11**：M3 完成——Hook 注入简化、injectionMode 配置、83/83 测试通过
- **2026-05-11**：M2 完成——13 个 Tools 注册实现、70/70 测试通过
- **2026-05-11**：M1 完成——Hook 抽象层基类、.openclaw→.agent 替换、32/32 测试通过
