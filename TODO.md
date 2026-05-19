---
name: TODO
version: 2.3.0
author: Yang Quan
---

# TODO.md — Agent Self-Development 进度看板

> 项目：`agent-self-development` | 当前版本：`v4.3.0`（工具插件重构中）
> 更新日期：2026-05-19
> 维护者：PM（产品经理）

---

## 版本目标

### v4.3.0：Object-Driven Tool Plugin 🔨 开发中（预计 2026-05-31 完成）

从「全功能认知框架」退回到「工具插件」——只通过 `api.registerTool()` 暴露 7 个命名空间工具，让 Agent 自主调用完成 task.json 和 event.md 的全生命周期管理。不再维护元认知模块、工作记忆模块、人格模块、Hook 注入、Heartbeat 等重框架组件。

**核心原则**：
- **插件只暴露工具**：不做决策、不注入 prompt、不代劳
- **Agent 自主管理**：自行决定何时 create / record / advance / archive
- **对象即边界**：TaskObject 是 `.agent/tasks/` 的唯一写入者，EventObject 是 `.agent/events/` 的唯一写入者
- **目录极简**：`src/` 下仅保留 `objects/`、`assets/`、`tools/`、`utils/`

**详细设计**：见 `docs/roadmap/v4.3.0.md`

预计完成：**2026-05-31**

---

## 里程碑

| 里程碑 | 时间 | 交付物 | 状态 |
|--------|------|--------|------|
| M1 | 2026-05-23 | 目录清理 + utils 提取 + objects 精简 + 新增方法实现 | 🚧 待启动 |
| M2 | 2026-05-26 | tools 重写 + schemas 精简 + 插件入口适配 + metadata 同步 | 🚧 待启动 |
| M3 | 2026-05-29 | 测试套件重写（≥50 用例）+ README/SKILL.md 更新 | 🚧 待启动 |
| M4 | 2026-05-31 | 验收 + 发布 v4.3.0 | 🚧 待启动 |

---

## 任务树

### P0：阻塞项（必须完成，否则版本无法发布）

- [ ] **P0-1：目录清理与代码迁移** — Developer
  - 来源问题：v4.2.0 遗留大量非工具插件代码（metacognition/、working-memory/、personality/、common/ 中大部分）
  - 交付物：
    - 删除 `src/metacognition/`、`src/working-memory/`、`src/personality/`
    - 删除 `src/common/adapters/`、`src/common/heartbeat.js`、`src/common/cognitive-trace.js`、`src/common/case-index.js`、`src/common/skills.js`、`src/common/template-engine.js`、`src/common/stream.js`、`src/common/hook.js`
    - 迁移 `src/common/project-context.js` → `src/utils/path.js`
    - 迁移 `src/common/utils.js` 中通用函数 → `src/utils/`（分拆为 file.js / validate.js / helpers.js）
    - 迁移有用模板 `src/templates/` → `src/assets/templates/`
  - 验收标准：`src/` 下仅剩 `objects/`、`assets/`、`tools/`、`utils/` 四个目录；`npm test` 能运行（此时可能测试为空或失败，但编译不报错）
  - 里程碑：M1

- [ ] **P0-2：objects 精简与依赖剥离 + 新方法实现** — Developer
  - 来源问题：
    1. 当前 TaskObject/EventObject 依赖 caseIndex、log、events 等非核心模块
    2. **task.json 的 deviations / attributions / outcome / eventFilePath 字段无对应方法，任务流脱节**
    3. EventObject.record() 写 event.md 时不同步 task.json
  - 交付物：
    - `src/objects/TaskObject.js`：
      - 移除 caseIndex、log、events、认知轨迹等非核心依赖
      - 保留核心 CRUD + advance + archive + validate
      - **新增 `recordDeviation(runId, {type, description, impact})`** → 向 `deviations[]` 追加，自动更新 `updatedAt`
      - **新增 `recordAttribution(runId, {rootCause, strategy, impact, deviationIds?})`** → 向 `attributions[]` 追加，标记对应偏差为已归因，自动更新 `updatedAt`
      - **新增 `setOutcome(runId, {summary, deliverables, lessonsLearned})`** → 写入 `outcome` 字段
      - **新增 `linkEventFile(runId, eventFilePath)`** → 写入 `eventFilePath` 字段（createEvent 后调用）
    - `src/objects/EventObject.js`：
      - 移除 createEvent()、record() 的增量追加逻辑、_appendToSection() 等
      - **新增 `generate(runId, task)`** → 从 task.json 凝练生成 `./.agent/events/{date}/{runId}.md`（date = task.createdAt 的 YYYY-MM-DD）
      - 保留 `query(filters)` → 扫描 `./.agent/events/{date}/` 目录
      - 保留 `archive(runId)` → 移动 event.md
    - `src/objects/index.js`：更新导出
  - 验收标准：
    - TaskObject 和 EventObject 仅依赖 `utils/path.js` 和 `utils/file.js`
    - `recordDeviation` + `recordAttribution` + `setOutcome` + `linkEventFile` 单测 = 至少 8 个用例通过
    - `EventObject.generate()` 单测 = 至少 4 个用例通过（正常生成、缺字段、无 task、路径正确）
    - event.md 文件路径格式：`./.agent/events/{YYYY-MM-DD}/{runId}.md`

- [ ] **P0-3：tools 重写与注册适配** — Developer
  - 来源问题：当前 tools 仍包含 guide.* 工具和多余工具；event.record 未适配「task 完成后凝练」策略
  - 交付物：
    - `src/tools/task-tools.js`：task.create / task.update / task.advance / task.query / task.archive
    - `src/tools/event-tools.js`：
      - `event.record`：**task 完成后调用**，读取 task.json → 调用 `EventObject.generate(runId, task)` → 生成 `./.agent/events/{date}/{runId}.md`
      - `event.query`：扫描 `./.agent/events/{date}/` 目录
    - `src/tools/schemas.js`：7 个工具的 parameters schema
    - `src/tools/index.js`：注册入口，适配 OpenClaw 新规范 `api.registerTool({ name, parameters, execute })`
    - `src/tools/return-adapter.js`：保留并验证
  - 验收标准：
    - 仅暴露 7 个工具；旧工具名（含 guide.*、task.deviate、task.attribute）零残留
    - `event.record` 调用后，event.md 完整包含 task.json 的 plan / deviations / attributions / outcome 信息
    - event.md 路径格式正确：`./.agent/events/{YYYY-MM-DD}/{runId}.md`
    - 返回格式统一为 `{ content: [{ type: "text", text: JSON.stringify(result) }] }`
  - 里程碑：M2

- [ ] **P0-4：插件入口重写** — Developer
  - 来源问题：当前 `src/index.js` 使用传统 export default 对象，包含大量模块初始化
  - 交付物：重写 `src/index.js`，使用 `definePluginEntry`（或保持传统格式但仅做工具注册）
  - 验收标准：入口文件 < 80 行；仅初始化 TaskObject/EventObject + 注册 tools；无 metacognition/working-memory/personality/heartbeat 引用
  - 里程碑：M2

- [ ] **P0-5：assets 模板契约确认** — PM + Developer
  - 来源问题：需要确认 task.json 和 event.md 模板是否满足 Agent 自主管理需求
  - 交付物：
    - `src/assets/task.json`：精简字段，保留核心状态机结构
    - `src/assets/event.md`：七章节模板（元信息、计划、执行、变更记录、偏差、归因、结果），供 EventObject.generate() 一次性渲染
    - `src/assets/templates/`（可选）：planning.md / monitoring.md / regulation.md / development.md
  - 验收标准：模板可被 TaskObject/EventObject 直接消费；Agent 通过 task.query 获取的 task 结构自解释
  - 里程碑：M1

---

### P1：重要项（影响体验或架构一致性，但不阻塞发布）

- [ ] **P1-1：openclaw.plugin.json 同步更新** — PM
  - 交付物：更新 `openclaw.plugin.json`
  - 验收标准：
    - `version` 为 `4.3.0`
    - `contracts.tools` 仅列出 7 个命名空间工具
    - 移除 metacognition / workingMemory / personality / heartbeat 配置项
    - 新增 `activation.onStartup: true`
  - 里程碑：M2

- [ ] **P1-2：metadata.json 同步更新** — PM
  - 交付物：更新 `metadata.json`
  - 验收标准：`version` 为 `v4.3.0`；`tags` 更新；`.agent` 角色保留但职责更新
  - 里程碑：M2

- [ ] **P1-3：package.json 同步更新** — PM
  - 交付物：更新 `package.json`
  - 验收标准：`version` 为 `4.3.0`；`scripts.test` 指向新测试文件；依赖清理（移除不必要的依赖）
  - 里程碑：M2

- [ ] **P1-4：旧代码清理验证（M1 验收标准）** — Developer
  - 来源问题：Reviewer I8 — M1 删除大量代码，误删风险高，需立即验证
  - 交付物：`grep` 全量验证旧模块/旧工具名零残留
  - 验收标准：
    - `grep -r "metacognition\|workingMemory\|personality\|heartbeat\|cognitiveTrace\|caseIndex" src/` 零匹配
    - `grep -r "create_plan\|update_task_status\|advance_phase\|get_task_status\|get_task_files\|self_diagnose\|archive_task\|record_deviation\|record_attribution\|get_planning_guide\|get_monitoring_guide\|get_regulation_guide\|get_development_guide" src/ test/` 零匹配
    - `grep -r "task.deviate\|task.attribute\|task.files\|task.diagnose\|guide.planning\|guide.monitoring\|guide.regulation\|guide.development" src/ test/` 零匹配
  - 里程碑：**M1**（原为 M3，Architect 建议 + PM 接受提前）

---

### P2：优化项（可延后，不影响核心功能）

- [ ] **P2-1：README.md 重写** — PM
  - 交付物：重写 `README.md`
  - 验收标准：
    - 版本显示 v4.3.0（Tool Plugin）
    - 说明 7 个工具的用途和调用方式
    - 提供 Agent 全生命周期工作流示例
    - 移除元认知/工作记忆/人格/Hook 相关描述
  - 里程碑：M3

- [ ] **P2-2：SKILL.md 更新** — PM
  - 交付物：更新 `SKILL.md`
  - 验收标准：工具清单与实现一致；提供 Agent 配置白名单示例
  - 里程碑：M3

- [ ] **P2-3：测试套件重写** — Developer
  - 交付物：`test/task-tools.test.js` + `test/event-tools.test.js` + `test/objects.test.js`
  - 验收标准：
    - 覆盖 7 个工具 × 正常/异常/边界路径 = ≥ 50 个用例
    - 覆盖 TaskObject 6 个方法 + EventObject 4 个方法
    - 全部通过
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
| 1. 插件过于复杂，与 OpenClaw 工具插件定位不符 | PM 决策 | 退回到工具插件，仅暴露 7 个工具 | P0-1 ~ P0-4 |
| 2. TaskObject/EventObject 依赖过重 | v4.2.0 遗留 | 剥离 caseIndex、log、events 等非核心依赖 | P0-2 |
| 3. task.json  deviations/attributions/outcome/eventFilePath 无方法操作，任务流脱节 | task.json 结构分析 | TaskObject 新增 recordDeviation / recordAttribution / setOutcome / linkEventFile | P0-2 |
| 4. event.md 增量追加策略过于复杂，且与 task.json 数据易不一致 | 架构设计反思 | event.md 改为 task 完成后从 task.json 一次性凝练生成 | P0-2 / P0-3 |
| 5. 工具名不统一，存在多余工具 | v4.2.0 遗留 + dev 分支误增 | 仅保留 7 个命名空间工具，移除 guide.* / task.deviate / task.attribute | P0-3 |
| 6. 插件入口过于复杂 | v4.2.0 遗留 | 重写为仅初始化对象 + 注册工具 | P0-4 |
| 7. 旧模块/旧工具名残留 | 重构遗留 | M3 全量 grep 验证零残留 | P1-4 |

---

## 角色分工

| 角色 | 当前状态 |
|------|----------|
| **PM** | v4.3.0 新方向已确认，已输出 roadmap + TODO 更新 |
| **Developer** | 待启动 M1 目录清理和代码迁移 |
| **Reviewer** | 待命，待 M3 完成后介入审查 |
| **Architect** | ✅ 已确认 6 项决策无技术不可行项；design.md/ADR-009 已归档；三份 specs 已重写为 `[ARCH_READY]`；输出 v4.3.0 架构评审 + 4 份 ADR |

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
| **v4.3.0** | 2026-05-31（预计） | Object-Driven Tool Plugin：精简为 7 个工具，移除重框架 | 🔨 开发中 |
| v4.2.0 | 2026-06-01 | Cognitive Intelligence + 架构风险评估修复 | ✅ 已完成 |
| v4.1.0 | 2026-05-11 | Tool-Driven Agent Autonomy | ✅ 已发布 |
| v4.0.0 | 2026-05-01 | 项目上下文层 + 双系统架构 | ✅ 已发布 |

---

## 最近更新

- **2026-05-19**：v4.3.0 方向重大调整——从「渐进式重构」改为「工具插件精简」。PM 输出新 roadmap + TODO。确认仅保留 7 个工具（task.* 5 个 + event.* 2 个），移除 guide.* / metacognition / working-memory / personality / heartbeat。
- **2026-05-19**：拉取远程 dev，获取 dev 分支上已有的 TaskObject/EventObject/命名空间注册等代码，作为 v4.3.0 新架构的基础素材。

---

## 🔖 Commit 标记规范

每个任务完成后，使用以下格式提交 Git：

- 进行中的任务：`feat: 简要说明`
- 已完成的任务：在任务树中标注 `🔖 commit: feat: 简要说明`

> 详见 `SKILL.md` 中「Git 工作流」章节。
