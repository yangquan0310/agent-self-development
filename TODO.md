---
name: TODO
version: 2.2.0
author: Yang Quan
---
# TODO.md — Agent Self-Development 进度看板

> 项目：`agent-self-development` | 当前版本：`v4.3.0`（规划中）
> 更新日期：2026-05-19（v4.3.0 规划启动）
> 维护者：PM（程序员 / 开发经理）

---

## 版本目标

### v4.2.0：Cognitive Intelligence ✅ 已完成（2026-06-01）

让 Tool-Driven 架构从「可用」走向「智能」——不增加新 tools，而是让现有 tools 更聪明、更可观测、更可回溯。

**里程碑状态**：M1 ~ M5 全部完成，360/360 测试通过。

---

### v4.3.0：Object-Driven Architecture 🚧 规划中（预计 2026-06-15 完成）

将插件从「平面 Tool 集合」升级为「对象驱动的命名空间架构」——引入 **TaskObject** 与 **EventObject** 两个核心对象，接管 task.json 与 event.md 的全生命周期管理；同时将 13 个平面 tools 重组为命名空间工具（`task.create`、`event.record` 等），全面适配 OpenClaw 新工具注册方式 `api.registerTool({ name, description, parameters, execute })`。

**设计哲学**：
- **对象即边界**：TaskObject 是 task.json 的唯一写入者，EventObject 是 event.md 的唯一写入者，彻底消除「多模块同构数据」的竞态风险（RISK-4 的最终根治）
- **命名空间即语义**：`task.*` 管理任务状态机，`event.*` 管理事件流，`guide.*` 提供认知指导，Agent 调用意图更清晰
- **模板即契约**：`assets/task.json` 与 `assets/event.md` 作为 canonical 模板，是对象与文件系统之间的契约层

预计完成：**2026-06-15**

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
| **PM** | v4.3.0 规划中，已输出需求清单 + 架构建议 + TODO 更新 |
| **Developer** | 待命，待 P0-1/P0-2 接口冻结后启动实现 |
| **Reviewer** | 待命，待 M2 完成后介入架构复查 |
| **Architect** | v4.3.0 ADR-009 已输出 ✅ |

---

## 阻塞与风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| P0-6 双重状态更新修复可能引入回归 | 🔴 高 | 全量测试覆盖 Tool Handler + Hook 路径；修改前冻结 `working-memory.test.js` baseline |
| P0-5 硬编码路径修复影响多模块 | 🟡 中 | 逐文件替换 + 环境变量覆盖测试（Linux/macOS/Windows） |
| 诊断增强 v2 依赖认知轨迹 + 案例索引 | 🟡 中 | M1 完成后再启动 P0-4；预留缓冲时间 |
| Flow 职责讨论可能延期 | 🟢 低 | M4 为可选优化，可延后至后续版本 |

---

## v4.3.0 版本规划

### v4.3.0 版本目标

**v4.3.0：Object-Driven Architecture** 🚧 规划中（预计 2026-06-15 完成）

将插件从「平面 Tool 集合」升级为「对象驱动的命名空间架构」——引入 **TaskObject** 与 **EventObject** 两个核心对象，接管 task.json 与 event.md 的全生命周期管理；同时将 13 个平面 tools 重组为命名空间工具（`task.create`, `event.record` 等），全面适配 OpenClaw 新工具注册方式 `api.registerTool({ name, description, parameters, execute })`。

**设计哲学**：
- **对象即边界**：TaskObject 是 task.json 的唯一写入者，EventObject 是 event.md 的唯一写入者，彻底消除「多模块同构数据」的竞态风险（RISK-4 的最终根治）
- **命名空间即语义**：`task.*` 管理任务状态机，`event.*` 管理事件流，`guide.*` 提供认知指导，Agent 调用意图更清晰
- **模板即契约**：`assets/task.json` 与 `assets/event.md` 作为 canonical 模板，是对象与文件系统之间的契约层

预计完成：**2026-06-15**

---

### v4.3.0 里程碑

| 里程碑 | 时间 | 交付物 | 状态 |
|--------|------|--------|------|
| M1 | 2026-05-25 | TaskObject + EventObject 核心实现 + 单元测试 | 🚧 规划中 |
| M2 | 2026-06-01 | 命名空间 Tool 注册迁移 + schemas.js 重构 | 🚧 规划中 |
| M3 | 2026-06-08 | assets/ 模板 + 对象-模板契约层 + 旧名清理 | 🚧 规划中 |
| M4 | 2026-06-12 | 全量测试迁移 + 文档更新 | 🚧 规划中 |
| M5 | 2026-06-15 | 验收 + 发布 v4.3.0 | 🚧 规划中 |

---

### v4.3.0 任务树

#### P0：阻塞项（必须完成，否则版本无法发布）

- [ ] **P0-1：TaskObject 核心对象** — Developer
  - 来源问题：v4.1.0 ~ v4.2.0 中 task.json 的 CRUD 逻辑散落在 `metacognition-tools.js`、`working-memory-tools.js`、多个 adapters 中，没有单一对象负责 task 生命周期
  - 交付物：`src/objects/task-object.js` + `test/task-object.test.js`
  - 验收标准：
    - 封装 `create()`, `get()`, `update()`, `advance()`, `archive()`, `diagnose()` 六个方法
    - 每个方法操作后自动更新 `updatedAt`，写入原子化（文件锁或临时文件替换）
    - 与 `State` adapter 协作但不越界：TaskObject 负责业务规则，State 负责原始 IO
    - `task.json` 校验：写入前通过 `assets/task.json` schema 校验，失败返回 `{ error, validationErrors }`
    - 单测覆盖 6 个方法 × 正常/异常路径 = 至少 12 个用例，全部通过
  - 里程碑：M1

- [ ] **P0-2：EventObject 核心对象** — Developer
  - 来源问题：event.md 的「偏差」「归因」记录逻辑分布在 `metacognition/deviation.js`、`metacognition/attribution.js`、Tool Handler 中，没有统一的事件文件生命周期管理者
  - 交付物：`src/objects/event-object.js` + `test/event-object.test.js`
  - 验收标准：
    - 封装 `createEvent()`, `recordDeviation()`, `recordAttribution()`, `query()`, `archive()` 五个方法
    - event.md 严格遵循 `assets/event.md` 七章节模板：元信息 → 计划 → 执行 → 变更记录 → 偏差 → 归因 → 结果
    - `recordDeviation()` / `recordAttribution()` 支持追加写入，不破坏已有章节结构
    - 查询支持按 `runId`、`date`、`type` 过滤，返回结构化 JSON（非原始 Markdown）
    - 单测覆盖 5 个方法 × 正常/异常路径 = 至少 10 个用例，全部通过
  - 里程碑：M1

- [ ] **P0-3：命名空间 Tool 注册迁移** — Developer
  - 来源问题：OpenClaw 新插件规范要求工具注册使用 `api.registerTool({ name, description, parameters, execute })`，且支持命名空间命名；当前 v4.2.0 使用旧版 `api.registerTool(name, { name, description, inputSchema, handler })` 平面注册
  - 交付物：重构后的 `src/tools/index.js` + `src/tools/schemas.js` + `src/tools/namespaced/`（或保留原文件但更新接口）
  - 验收标准：
    - 所有 tools 按命名空间注册，仅暴露 13 个新命名空间工具：
      - `task.create`
      - `task.update`
      - `task.advance`
      - `task.query`
      - `task.files`
      - `task.diagnose`
      - `task.archive`
      - `event.record`（合并原 `record_deviation` + `record_attribution`，通过参数区分类型）
      - `event.query`（新增）
      - `guide.planning`
      - `guide.monitoring`
      - `guide.regulation`
      - `guide.development`
    - 旧工具名全部废弃，不再保留任何映射或 shim：Agent 直接调用命名空间工具名
    - 使用新注册方式：`parameters` 替代 `inputSchema`，`execute(_id, params)` 替代 `handler(params)`，返回 `{ content: [{ type: "text", text: JSON.stringify(result) }] }`
    - `openclaw.plugin.json` 中 `configSchema` 和 `metadata.json` 中工具清单同步更新，仅列出命名空间工具
    - 全量测试通过（命名空间调用路径覆盖）
  - 里程碑：M2
  - 依赖：P0-1、P0-2 完成后才能冻结接口

- [ ] **P0-4：assets/ 核心模板** — PM + Developer
  - 来源问题：task.json 和 event.md 的字段/章节没有 canonical 定义，各模块各自约定，导致格式漂移（如 v4.1.0 新增 `tools` 字段时多文件未同步）
  - 交付物：`assets/task.json`（Task 数据结构模板）+ `assets/event.md`（Event Markdown 章节模板）
  - 验收标准：
    - `assets/task.json` 包含完整字段定义、类型标注、必填/选填标记、默认值、字段说明注释；可被 `jq` 直接解析作为校验基准
    - `assets/event.md` 包含七章节 Markdown 模板，每章节带占位符（如 `{{runId}}`、`{{createdAt}}`），可被 EventObject 渲染引擎消费
    - 两个模板作为「契约」：TaskObject 写入前校验、EventObject 渲染时引用
    - README.md 中新增「数据结构模板」章节，指向 assets/
  - 里程碑：M3

---

#### P1：重要项（影响体验或架构一致性，但不阻塞发布）

- [ ] **P1-1：Tool Handler 委托重构** — Developer
  - 交付物：修改后的 `src/tools/metacognition-tools.js` + `src/tools/working-memory-tools.js`
  - 验收标准：所有 Tool Handler 不再直接操作 adapters，而是通过 `TaskObject` / `EventObject` 委托；handler 代码量减少 30% 以上；行为零回归（v4.2.0 测试基线全部通过）
  - 里程碑：M2
  - 依赖：P0-1、P0-2

- [ ] **P1-2：测试基线冻结 + 旧名零残留** — Developer
  - 来源问题：命名空间改名是破坏性变更——需确保 v4.2.0 旧工具名在代码中完全移除
  - 交付物：`grep -r "create_plan\|update_task_status\|advance_phase\|get_task_status\|get_task_files\|self_diagnose\|archive_task\|record_deviation\|record_attribution\|get_planning_guide\|get_monitoring_guide\|get_regulation_guide\|get_development_guide" src/ test/` 零匹配
  - 验收标准：旧工具名字面量在 src/、test/、docs/ 中零残留；`openclaw.plugin.json` 中 `tools` 字段直接标注新命名空间分组；测试全部使用 `task.*` / `event.*` / `guide.*` 调用；Agent 配置白名单同步更新
  - 里程碑：M3

- [ ] **P1-3：openclaw.plugin.json + metadata.json 同步更新** — PM
  - 交付物：更新后的 `openclaw.plugin.json` + `metadata.json`
  - 验收标准：
    - `openclaw.plugin.json` 版本号升至 `4.3.0`，`minVersion` 检查是否需要提升
    - `metadata.json` 版本号、工具清单、tags 同步更新
    - 新增 `tools` 字段说明命名空间分组（task / event / guide）
  - 里程碑：M2

- [x] **P1-4：对象-适配器边界澄清（ADR-009）** — Architect + Developer
  - 交付物：`docs/adr/ADR-009-object-adapter-boundary.md` + `docs/architecture/v4.3.0-design.md` + `docs/specs/*.md`
  - 验收标准：明确「TaskObject = 业务规则 + 生命周期编排」，「State = 原始 JSON 读写」，「Flow = 跨任务工作流编排（或降级为只读镜像）」；与 RISK-6（Flow 职责模糊）形成闭环决策
  - 里程碑：M3 ✅ 架构设计已完成（2026-05-19）

---

#### P2：优化项（可延后，不影响核心功能）

- [ ] **P2-1：README + SKILL.md 文档更新** — PM + Developer
  - 交付物：更新后的 `README.md`（新增 Object-Driven 架构说明）+ `SKILL.md`（工具名映射表）
  - 验收标准：Agent 可通过 README 理解命名空间工具调用方式；SKILL.md 中工具清单与实现一致
  - 里程碑：M4

- [ ] **P2-2：Test Suite 命名空间路径迁移** — Developer
  - 交付物：更新后的 `test/tools.test.js` + `test/tools-integration.test.js`
  - 验收标准：所有测试使用新命名空间工具名调用；新增 TaskObject / EventObject 独立测试文件；总测试数 ≥ 180，全部通过
  - 里程碑：M4

- [ ] **P2-3：对象模型 + 数据模型文档更新** — PM
  - 交付物：更新后的 `docs/reference/object-model.md` + `docs/reference/data-model.md`
  - 验收标准：文档包含 TaskObject / EventObject 类图、方法表、与 adapters 的交互序列图；数据模型章节新增 `assets/task.json` 和 `assets/event.md` 字段详解
  - 里程碑：M4

- [ ] **P2-4：案例索引适配命名空间查询** — Developer
  - 交付物：修改后的 `src/common/case-index.js`
  - 验收标准：`case-index` 的字段定义与 TaskObject 输出的标准 task 结构对齐；`task.query` 返回结果中 `similarCases` 字段保持兼容
  - 里程碑：M4（可选）

---

### v4.3.0 废弃清单

以下 13 个旧工具名在 v4.3.0 中**全部废弃**，不再保留任何映射、shim 或向后兼容层。Agent 必须直接使用新命名空间工具名调用。

| 序号 | 旧工具名 | 新命名空间工具名 | 所属命名空间 |
|------|----------|------------------|--------------|
| 1 | `create_plan` | `task.create` | task |
| 2 | `update_task_status` | `task.update` | task |
| 3 | `advance_phase` | `task.advance` | task |
| 4 | `get_task_status` | `task.query` | task |
| 5 | `get_task_files` | `task.files` | task |
| 6 | `self_diagnose` | `task.diagnose` | task |
| 7 | `archive_task` | `task.archive` | task |
| 8 | `record_deviation` | `event.record` | event |
| 9 | `record_attribution` | `event.record` | event |
| 10 | `get_planning_guide` | `guide.planning` | guide |
| 11 | `get_monitoring_guide` | `guide.monitoring` | guide |
| 12 | `get_regulation_guide` | `guide.regulation` | guide |
| 13 | `get_development_guide` | `guide.development` | guide |

> ⚠️ **重要**：v4.3.0 发布后，任何使用旧工具名的 Agent 配置、脚本、白名单将直接报错，不存在过渡期。所有 Agent 必须在 v4.3.0 发布前完成白名单更新。

---

### v4.3.0 问题-解决对照表

| 问题 | 来源 | 解决方案 | 对应任务 |
|------|------|----------|----------|
| 1. task.json 生命周期管理无单一Owner | v4.1.0 架构评估 RISK-4 / v4.2.0 遗留 | 引入 TaskObject，统一 CRUD + 校验 + 诊断 | P0-1, P1-1 |
| 2. event.md 章节格式无契约 | v4.1.0 ~ v4.2.0 格式漂移观察 | 引入 EventObject + assets/event.md 模板，统一七章节结构 | P0-2, P0-4 |
| 3. Tool 注册方式过时 | OpenClaw 新插件规范 | 迁移到 `api.registerTool({ name, description, parameters, execute })` + 命名空间 | P0-3 |
| 4. 工具名扁平，语义不清晰 | v4.1.0 设计债 | 重组为 `task.*` / `event.*` / `guide.*` 命名空间 | P0-3 |
| 5. 命名空间迁移破坏现有 Agent 配置 | v4.3.0 引入 | README + SKILL.md 更新命名空间调用指南；Agent 白名单同步更新 | P1-2 |
| 6. Flow / State / Task adapters 职责模糊 | v4.1.0 架构评估 RISK-6 | ADR-009 明确边界：TaskObject 管业务，State 管 IO，Flow 管编排 | P1-4 |

---

### v4.3.0 阻塞与风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| P0-3 命名空间迁移影响全量测试 | 🔴 高 | P0-1/P0-2 接口冻结后再启动 M2；测试全部改为新命名空间调用；旧测试基线废弃 |
| TaskObject 与现有 State adapter 竞态 | 🟡 中 | TaskObject 写入使用原子文件替换；State adapter 降级为纯 IO 层，不维护业务状态 |
| event.md 模板渲染性能 | 🟡 中 | EventObject 采用「章节切片」追加策略，不重新渲染全文件；单次追加 < 50ms |
| Agent 白名单更新滞后 | 🔴 高 | 无向后兼容层；文档提前 1 周发布迁移指南；Agent 配置必须在 v4.3.0 发布前同步更新 |

---

## 历史版本

| 版本 | 日期 | 核心变化 | 状态 |
|------|------|----------|------|
| **v4.3.0** | 2026-06-15（预计） | Object-Driven Architecture：TaskObject + EventObject + 命名空间 Tools | 🚧 规划中 |
| v4.2.0 | 2026-06-01 | Cognitive Intelligence + 架构风险评估修复 | ✅ 已完成 |
| v4.1.0 | 2026-05-11 | Tool-Driven Agent Autonomy | ✅ 已发布 |
| v4.0.1 | 已合并至 v4.1.0 | Hook 可靠性 + 命名统一 | ✅ 已整合 |
| v4.0.0 | 2026-05-01 | 项目上下文层 + 双系统架构 | ✅ 已发布 |

---

## 最近更新

- **2026-05-19**：v4.3.0 TODO.md 更新——PM 删除所有向后兼容/过渡期/shim 描述，新增「废弃清单」章节明确 13 个旧工具名废弃；P0-3 验收标准改为仅暴露命名空间工具；P1-2 删除向后兼容备注；风险表更新为「无向后兼容层」；里程碑 M1~M5 无过渡期
- **2026-05-19**：v4.3.0 架构设计完成——Architect 输出 `docs/architecture/v4.3.0-design.md` + `docs/adr/ADR-009-object-adapter-boundary.md` + `docs/specs/task-object-interface.md` + `docs/specs/event-object-interface.md` + `docs/specs/tool-registry-interface.md`；涵盖模块划分、接口契约、数据流、命名空间工具映射、5 项关键架构决策；状态标记为 [ARCH_READY]
- **2026-05-19**：v4.3.0 规划启动——PM 完成需求分析、架构设计、TODO.md 更新；确认 P0-1 ~ P0-4 阻塞项 + P1-1 ~ P1-4 重要项 + P2-1 ~ P2-4 优化项
- **2026-05-19**：v4.2.0 全部完成——M1 ~ M5 验收通过，360/360 测试通过，版本状态更新为 ✅ 已完成
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

---

## 🔖 Commit 标记规范

每个任务完成后，使用以下格式提交 Git：

- 进行中的任务：`feat: 简要说明`
- 已完成的任务：在任务树中标注 `🔖 commit: feat: 简要说明`

> 详见 `SKILL.md` 中「Git 工作流」章节。
