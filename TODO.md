---
name: TODO
version: 2.3.0
author: Yang Quan
---

# TODO.md — Agent Autobiography 进度看板

> 项目：`agent-autobiography`（原 `agent-self-development`）| 当前版本：`v4.3.0`（工具插件重构中）
> 更新日期：2026-05-26
> 维护者：PM（产品经理）

---

## 版本目标

### v4.5.0：Hook 注入时机精细化 🔨 开发中（预计 2026-05-29 完成）

借鉴 self-improving-agent 条件触发机制，优化 Hook 注入时机，实现精准提醒。

**核心变更**：
- **条件触发**：通过 `after_tool_call` 监听关键工具返回值，条件触发提醒
- **精准时机**：只在业务关键节点触发，不打扰正常执行
- **注入时机矩阵**：M1~M4 四个触发场景

**注入时机矩阵**：
| # | 触发时机 | 监听工具 | 条件 | 注入内容 |
|---|----------|----------|------|----------|
| M1 | 任务创建后 | `task.create` | 返回成功 | 提醒：制定计划 → 拆解 TODO |
| M2 | 偏差记录后 | `task.update` | 检测到 deviation 字段 | 提醒：执行偏差分析 → 归因分析 |
| M3 | 事件生成后 | `event.report` | 返回成功 | 提醒：六维度平衡性判断 |
| M4 | 无任务执行时 | `before_prompt_build` | 检测无 active task | 提醒：创建任务 |

**详细设计**：见 `docs/roadmap/v4.5.0.md`

预计完成：**2026-05-29**

---

### v4.3.0：Object-Driven Tool Plugin ✅ 已完成

从「全功能认知框架」退回到「工具插件」——只通过 `api.registerTool()` 暴露 6 个命名空间工具，让 Agent 自主调用完成 task.json 和 event.md 的全生命周期管理。不再维护元认知模块、工作记忆模块、人格模块、Hook 注入、Heartbeat 等重框架组件。

**核心原则**：
- **插件只暴露工具**：不做决策、不注入 prompt、不代劳
- **Agent 自主管理**：自行决定何时 create / record / advance / archive
- **对象即边界**：TaskObject 是 `.agentstasks/` 的唯一写入者，EventObject 是 `.agentsevents/` 的唯一写入者
- **目录极简**：`src/` 下仅保留 `objects/`、`assets/`、`tools/`、`utils/`

**详细设计**：见 `docs/roadmap/v4.3.0.md`

预计完成：**2026-05-31** ✅ 已完成（2026-05-26）

---

## 里程碑

### v4.5.0 里程碑

| 里程碑 | 时间 | 交付物 | 状态 |
|--------|------|--------|------|
| M1 | 2026-05-27 | `after_tool_call` + M1/M3 条件触发 | 🔨 开发中 |
| M2 | 2026-05-28 | `after_tool_call` + M2 条件触发 | ⏳ 待开发 |
| M3 | 2026-05-28 | `before_prompt_build` + M4 条件降频 | ⏳ 待开发 |
| M4 | 2026-05-29 | 测试覆盖 + 文档更新 | ⏳ 待开发 |

### v4.3.0 里程碑

| 里程碑 | 时间 | 交付物 | 状态 |
|--------|------|--------|------|
| M1 | 2026-05-23 | 目录清理 + utils 提取 + handlers 实现 + **旧代码零残留验证** | ✅ 已完成 |
| M2 | 2026-05-26 | tools 重写 + schemas 精简 + 插件入口适配 + metadata 同步 | ✅ 已完成（M1 合并） |
| M3 | 2026-05-29 | 测试套件重写（≥50 用例）+ README/SKILL.md 更新 | ✅ 已完成 |
| M4 | 2026-05-31 | 验收 + 发布 v4.3.0 | ✅ 已完成 |

---

## 任务树

### v4.5.0 任务

#### P0：阻塞项

- [x] **P0-1：`after_tool_call` Hook 注册 + M1/M3 条件触发** — Developer
  - 来源问题：v4.3.0 移除了 Hook 注入层，需要重新引入条件触发机制
  - 交付物：
    - `src/hooks/condition.js`（新增）：条件判断逻辑封装
    - 修改 `src/index.js`：注册 `after_tool_call` hook
    - M1：`task.create` 返回成功后注入提醒（idempotencyKey: `agent-autobiography:task-created`）
    - M3：`event.report` 返回成功后注入提醒（idempotencyKey: `agent-autobiography:event-generated`）
  - 验收标准：
    - `after_tool_call` hook 正确注册 ✅
    - `task.create` 后收到提醒 ✅
    - `event.report` 后收到提醒 ✅
  - 里程碑：M1 🔖 commit: `feat: P0-1 after_tool_call Hook 注册 + M1/M3 条件触发`

- [ ] **P0-2：`after_tool_call` + M2 条件触发** — Developer
  - 来源问题：偏差记录后需要触发偏差分析提醒
  - 交付物：
    - 修改 `src/hooks/condition.js`：新增 deviation 检测逻辑
    - M2：`task.update` 含 deviation 字段时注入提醒（idempotencyKey: `reg:deviation-detected`）
  - 验收标准：`task.update` 含 deviation 后收到偏差分析提醒
  - 里程碑：M2

- [ ] **P0-3：`before_prompt_build` + M4 条件降频** — Developer
  - 来源问题：无任务执行时需要提醒创建任务
  - 交付物：
    - 修改 `src/index.js`：注册 `before_prompt_build` hook
    - M4：检测无 active task 时注入提醒（idempotencyKey: `reg:no-active-task`）
    - 有 active task 时跳过，避免打扰
  - 验收标准：
    - 无 active task 时收到提醒
    - 有任务时不打扰
  - 里程碑：M3

- [ ] **P0-4：测试覆盖 + 文档更新** — Developer
  - 来源问题：Hook 注入需要完整测试覆盖
  - 交付物：
    - `test/hooks-conditional.test.js`（新增）：4 个触发场景的单元测试
    - 更新 `SKILL.md`：新增 Hook 时机矩阵说明
  - 验收标准：4 个触发场景全部测试通过
  - 里程碑：M4

#### P1：重要项

- [ ] **P1-1：openclaw.plugin.json 同步更新** — Developer
  - 交付物：更新 `openclaw.plugin.json`
  - 验收标准：`version` 更新为 `4.5.0`
  - 里程碑：M4

- [ ] **P1-2：changelog + 发布 v4.5.0** — Developer
  - 交付物：更新 `docs/changelog/unreleased.md`，发布 v4.5.0
  - 验收标准：changelog 完整记录变更；版本标签已推送
  - 里程碑：M4

---

### v4.3.0 P0：阻塞项（已完成）

- [x] **P0-1：目录清理与代码迁移** — Developer
  - 来源问题：v4.2.0 遗留大量非工具插件代码（metacognition/、working-memory/、personality/、common/ 中大部分）
  - 交付物：
    - 删除 `src/metacognition/`、`src/working-memory/`、`src/personality/`、`src/objects/`、`src/common/`、`src/assets/`、`src/templates/`
    - 新建 `src/utils/`（`path.js` / `io.js` / `validate.js` / `helpers.js`）
    - 新建 `src/tools/handlers.js`（8 个扁平化 Handler）
    - 重写 `src/tools/schemas.js`、`src/tools/index.js`、`src/index.js`
  - 验收标准：`src/` 下仅剩 `tools/`、`utils/` 两个目录 + `index.js`；`npm test` 20/20 通过
  - 里程碑：M1 🔖 commit: `feat: M1 扁平化架构实现 — 6 个 Handler + utils + 零残留验证`

- [x] **P0-2：扁平化 Handler 实现（替代 Object 中间层）** — Developer
  - 来源问题：ADR-014 已批准删除 TaskObject/EventObject 类，Handler 直接 IO
  - 交付物：
    - `src/tools/handlers.js`：
      - `create`：直接生成 task.json，含 `generatePlan` 自动推断
      - `update`：唯一更新入口，支持 status / deviation / attribution / outcome / eventFilePath 任意组合
      - `advance`：推进阶段，支持指定 phaseId
      - `get`：读取完整 task.json（双路径扫描 tasks/ + archive/）
      - `archive`：仅允许 completed → archived
      - `report`：任务完成后从 task.json 一次性凝练生成 event.md
      - `query`：按 runId / date / type 筛选事件
      - `archiveEvent`：将 event.md 移动到 archive/ 目录
  - 验收标准：
    - 8 个 Handler 零依赖旧模块，仅依赖 `src/utils/`
    - `test/handlers.test.js` 20/20 通过
    - event.md 文件路径格式：`.agentsevents/{YYYY-MM-DD}/{HH-MM-SS}.md`

- [x] **P0-3：tools 注册与入口适配** — Developer
  - 来源问题：当前 tools 仍包含 guide.* 工具和多余工具；需适配扁平化 Handler
  - 交付物：
    - `src/tools/index.js`：注册入口，适配 OpenClaw 新规范 `api.registerTool({ name, parameters, execute })`
    - 注册 8 个命名空间工具：`task.create` / `task.update` / `task.advance` / `task.get` / `task.archive` / `event.report` / `event.query` / `event.archive`
    - 旧工具名（含 guide.*、task.deviate、task.attribute、task.files、task.diagnose）零残留
  - 验收标准：
    - 8 个工具注册成功；旧注册方式零残留
    - 返回格式统一为 `{ content: [{ type: "text", text: JSON.stringify(result) }] }`
    - `openclaw.plugin.json` 同步更新（版本 4.3.0，移除 metacognition/workingMemory/personality/heartbeat/guide 配置）
  - 里程碑：M1

- [x] **P0-4：插件入口重写** — Developer
  - 来源问题：当前 `src/index.js` 包含大量模块初始化
  - 交付物：重写 `src/index.js` → 14 行（含注释），仅 `registerTools(api)`
  - 验收标准：入口 `initialize(api, config)` 加载模板构造 context；无旧模块引用；`npm test` 通过
  - 里程碑：M1

- [x] **P0-5：M1 架构对齐** — Developer
  - 来源问题：Architect M1 kickoff 指令要求代码结构对齐
  - 交付物：
    - `src/utils/resolve.js`（替代 path.js）
    - `src/objects/task.js` + `src/objects/event.js`（裸动词、返回 {error}、不 throw）
    - `src/tools/handlers.js`（中间适配层，event.report 关联 eventFilePath）
    - `src/index.js` → `initialize(api, config)` 接口
    - 补充 `event.archive` 工具（第 8 个）
  - 验收标准：98/98 测试通过；代码结构符合 Architect 规范
  - 里程碑：M1 🔖 commit: `feat: M1 架构对齐 — 8 工具、扁平化 Handler、initialize 接口`

---

### P1：重要项（影响体验或架构一致性，但不阻塞发布）

- [x] **P1-1：openclaw.plugin.json 同步更新** — Developer
  - 交付物：更新 `openclaw.plugin.json`
  - 验收标准：
    - `version` 为 `4.3.0`
    - 移除 metacognition / workingMemory / personality / heartbeat / guide / injectionMode 配置项
    - 仅保留 archive 配置
  - 里程碑：M1

- [x] **P1-2：metadata.json 同步更新** — Developer
  - 交付物：更新 `metadata.json`
  - 验收标准：`version` 为 `v4.3.0`；`tags` 更新（移除 metacognition，添加 tool-plugin / flat-architecture）
  - 里程碑：M2

- [x] **P1-3：package.json 同步更新** — Developer
  - 交付物：更新 `package.json`
  - 验收标准：`scripts.test` 指向新测试文件 `test/handlers.test.js`；20/20 通过
  - 里程碑：M1

- [x] **P1-4：旧代码清理验证（M1 验收标准）** — Developer
  - 来源问题：Reviewer I8 — M1 删除大量代码，误删风险高，需立即验证
  - 交付物：`grep` 全量验证旧模块/旧工具名零残留
  - 验收标准：
    - `grep -r "Metacognition\|WorkingMemory\|Personality\|Heartbeat\|State\|Flow\|Memory\|Log\|CaseIndex\|Skills\|TaskObject\|EventObject" src/` 零匹配 ✅
    - `grep -r "task.query\|task.files\|task.diagnose\|task.deviate\|task.attribute\|event.record\|event.query\|guide\." src/` 零匹配 ✅
    - `grep -r "metacognition/\|working-memory/\|personality/\|objects/\|common/adapters/\|assets/\|templates/" src/` 零匹配 ✅
    - `grep -r "inputSchema\|registerTool(name\|recordTrace\|cognitiveTrace" src/` 零匹配 ✅
  - 里程碑：M1

---

### P2：优化项（可延后，不影响核心功能）

- [x] **P2-1：README.md 重写** — Developer
  - 交付物：重写 `README.md`
  - 验收标准：
    - 版本显示 v4.3.0（Flat Architecture）
    - 说明 8 个工具的用途和调用方式
    - 更新项目结构（仅 tools/ + utils/ + index.js）
    - 移除元认知/工作记忆/人格/Hook 相关描述
  - 里程碑：M3

- [x] **P2-2：SKILL.md 更新** — Developer
  - 交付物：更新 `SKILL.md`
  - 验收标准：
    - 工具清单与实现一致（8 个工具）
    - 提供 Agent 典型工作流示例
    - 更新文件归档规范（移除旧模块目录）
  - 里程碑：M3

- [x] **P2-3：测试套件重写** — Developer
  - 交付物：`test/handlers.test.js` + `test/handlers-edge.test.js` + `test/utils.test.js` + `test/registry.test.js`
  - 验收标准：
    - 覆盖 8 个 Handler × 正常/异常/边界路径 + utils + registry = 98 个用例
    - 全部通过 ✅
  - 里程碑：M3

- [ ] **P2-4：docs/ 文档清理** — PM
  - 交付物：清理 docs/ 中过时的架构/参考文档
  - 验收标准：移除与 v4.2.0 重框架相关的过时文档；保留 roadmap/ 和 changelog/
  - 里程碑：M3

---

## 废弃清单

v4.3.0 以下模块、工具、概念**全部废弃**：

| 类别 | 废弃项 | 说明 |
|------|--------|------|
| 模块 | `src/metacognition/` | 元认知框架由 Agent 自行维护 |
| 模块 | `src/working-memory/` | 工作记忆由 Agent 自行维护 |
| 模块 | `src/personality/` | 人格发展由 Agent 自行维护 |
| 工具 | `guide.planning` | Agent 自行规划 |
| 工具 | `guide.monitoring` | Agent 自行监控 |
| 工具 | `guide.regulation` | Agent 自行调节 |
| 工具 | `guide.development` | Agent 自行发展 |
| 工具 | `task.files` | 非核心职责 |
| 工具 | `task.diagnose` | 非核心职责 |
| 工具 | `task.deviate` | 从未在架构中定义，直接移除 |
| 工具 | `task.attribute` | 从未在架构中定义，直接移除 |
| 组件 | `src/common/heartbeat.js` | 非工具插件职责 |
| 组件 | `src/common/cognitive-trace.js` | 非核心工具职责 |
| 组件 | `src/common/case-index.js` | 非核心工具职责 |
| 组件 | `src/common/skills.js` | Skill 加载不再由插件维护 |
| 组件 | `src/common/template-engine.js` | 模板渲染简化 |
| 组件 | `src/common/stream.js` | 不再需要 |
| 架构 | Hook 注入 | 工具插件不注入 Hook |
| 架构 | `injectionMode` | 不再区分 legacy / tool-driven |

---

## 问题-解决对照表

| 问题 | 来源 | 解决方案 | 对应任务 |
|------|------|----------|----------|
| 1. 插件过于复杂，与 OpenClaw 工具插件定位不符 | PM 决策 | 退回到工具插件，仅暴露 8 个工具 | P0-1 ~ P0-4 |
| 2. TaskObject/EventObject 依赖过重 | v4.2.0 遗留 | 剥离 caseIndex、log、events 等非核心依赖 | P0-2 |
| 3. task.json  deviations/attributions/outcome/eventFilePath 无方法操作，任务流脱节 | task.json 结构分析 | TaskObject 新增 recordDeviation / recordAttribution / setOutcome / linkEventFile | P0-2 |
| 4. event.md 增量追加策略过于复杂，且与 task.json 数据易不一致 | 架构设计反思 | event.md 改为 task 完成后从 task.json 一次性凝练生成 | P0-2 / P0-3 |
| 5. 工具名不统一，存在多余工具 | v4.2.0 遗留 + dev 分支误增 | 仅保留 6 个命名空间工具，移除 guide.* / task.deviate / task.attribute | P0-3 |
| 6. 插件入口过于复杂 | v4.2.0 遗留 | 重写为仅初始化对象 + 注册工具 | P0-4 |
| 7. 旧模块/旧工具名残留 | 重构遗留 | M3 全量 grep 验证零残留 | P1-4 |

---

## 角色分工

| 角色 | 当前状态 |
|------|----------|
| **PM** | v4.3.0 新方向已确认，已输出 roadmap + TODO 更新 |
| **Developer** | 🔨 M1 开发中 — 扁平化 Handler 实现 |
| **Reviewer** | 待命，待 M3 完成后介入审查 |
| **Architect** | ✅ **`[ARCH_APPROVED]`** — ADR-014 扁平化架构已批准，specs v3.0.0 + CONVENTIONS 已交付 |

---

## 阻塞与风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 删除大量代码可能误删有用逻辑 | 🔴 高 | 逐文件审查；保留的代码先复制到新目录再删除；git 历史可回滚 |
| TaskObject/EventObject 依赖剥离引入回归 | 🟡 中 | 每剥离一个依赖后运行 objects 单元测试；archive/validate 等复杂方法保留核心逻辑 |
| 新增 recordDeviation / recordAttribution 方法引入数据不一致 | 🟡 中 | Tool Handler 层保证双写原子性（先写 task.json，再写 event.md；失败时回滚或标记） |
| Agent 失去 guide.* 后需要适应期 | 🟡 中 | README 提供清晰的工具调用示例和工作流指引 |
| 测试覆盖不足导致发布后发现问题 | 🟡 中 | M3 强制 ≥ 50 个用例，覆盖正常/异常/边界路径；新增方法单独 8 个用例 |

---

## 历史版本

| 版本 | 日期 | 核心变化 | 状态 |
|------|------|----------|------|
| **v4.5.0** | 2026-05-29（预计） | Hook 注入时机精细化：条件触发精准提醒 | 🔨 开发中 |
| **v4.3.0** | 2026-05-26 | 扁平化 Tool Plugin：8 个 Handler 直接 IO，移除重框架 | ✅ 已完成 |
| v4.2.0 | 2026-06-01 | Cognitive Intelligence + 架构风险评估修复 | ✅ 已完成 |
| v4.1.0 | 2026-05-11 | Tool-Driven Agent Autonomy | ✅ 已发布 |
| v4.0.0 | 2026-05-01 | 项目上下文层 + 双系统架构 | ✅ 已发布 |

---

## 最近更新

- **2026-05-26 10:13**：项目更名 `agent-self-development` → `agent-autobiography`。v4.5.0 启动：Hook 注入时机精细化。
- **2026-05-19 14:20**：PM 批准 Architect 扁平化架构 `[ARCH_APPROVED]`。核心变更：删除 TaskObject/EventObject 类 → Handler 直接 IO；工具规范为 8 个（`task.*` 5 个 + `event.*` 3 个）；目录结构改为 `assets/objects/tools/utils`。Developer 正式启动 M1。
- **2026-05-19 ~ 2026-05-20**：Developer 完成 M1~M3 全部编码：
  - 新建 `src/utils/` 4 个文件 + `src/tools/handlers.js` + 重写 `src/tools/index.js` / `src/tools/schemas.js` / `src/index.js`
  - 删除 `src/metacognition/`、`src/working-memory/`、`src/personality/`、`src/objects/`、`src/common/`、`src/assets/`、`src/templates/`
  - `grep` 零残留验证 16 项全部 CLEAN
  - `npm test` 98/98 通过
- **2026-05-19 13:59:00**：Reviewer 提交审查报告 `[CONDITIONAL_APPROVED]`，提出 3 BLOCKER + 6 WARNING
- **2026-05-19 ~ 2026-05-20**：Developer 修复 Reviewer 全部意见：
  - ✅ BLOCKER #1 `archiveTask` 文件移动（`rename` 到 `archive/`）
  - ✅ BLOCKER #3 `writeJson/writeMarkdown` 原子写（temp+rename）
  - ✅ BLOCKER #2 `event.query` — PM 后续确认补充，已实现 + schema + 6 测试
  - ✅ WARNING #6~9 全部修复（event.md 文件名 / taskType enum / 动态计数 / 死代码删除）
  - ✅ WARNING #4~5 已确认（`task.get` / `event.report` 为 PM 批准的正式命名）
  - 新生成测试报告 `docs/reports/test-2026-05-19-06-10-47.md`（98/98 通过）
- **2026-05-19 13:45**：Architect 完成全部 specs + ADR 重写，输出 `[ARCH_READY]`。PM 确认 7 份交付物，采纳全部 4 项建议（S1~S4）。`docs/COLLABORATION.md` 全文中文化完成。
- **2026-05-19 12:15**：PM 接受 Architect 2 项建议——M1 延至 05-23，P1-4 零残留验证提升为 M1 验收标准。
- **2026-05-19 11:58**：Reviewer 提交审查报告，识别 10 项不一致（3 项阻塞 + 7 项影响）。PM 输出裁决文档，B1/B2/B3 已拍板。
- **2026-05-19**：v4.3.0 方向重大调整——从「渐进式重构」改为「工具插件精简」。PM 输出新 roadmap + TODO。确认仅保留 8 个工具（task.* 5 个 + event.* 3 个），移除 guide.* / metacognition / working-memory / personality / heartbeat。
- **2026-05-19**：拉取远程 dev，获取 dev 分支上已有的 TaskObject/EventObject/命名空间注册等代码，作为 v4.3.0 新架构的基础素材。

---

## 🔖 Commit 标记规范

每个任务完成后，使用以下格式提交 Git：

- 进行中的任务：`feat: 简要说明`
- 已完成的任务：在任务树中标注 `🔖 commit: feat: 简要说明`

> 详见 `SKILL.md` 中「Git 工作流」章节。
