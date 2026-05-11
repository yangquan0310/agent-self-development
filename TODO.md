# TODO.md — Agent Self-Development 进度看板

> 项目：`agent-self-development` | 当前版本：`v4.0.0` → `v4.1.0`
> 更新日期：2026-05-11（M3 完成）
> 维护者：PM（产品经理）

---

## 版本目标

**v4.1.0：Tool-Driven Agent Autonomy**

从 "Hook 注入 Skill" 架构迁移到 "Tool 暴露 + Agent 自主调用" 架构。
合并内容：v4.0.1（Hook 可靠性 + 命名统一）已整合至本版本，不再独立发布。

预计完成：**2026-05-20**

---

## 里程碑

| 里程碑 | 时间 | 交付物 | 状态 |
|--------|------|--------|------|
| M1 | 2026-05-12 | Hook 抽象层 + 命名统一 | ✅ 已完成 |
| M2 | 2026-05-14 | Tool 注册 + 核心 Tools 实现 | ✅ 已完成 |
| M3 | 2026-05-16 | Hook 注入简化 + 配置开关 + Skill 重构 | ✅ 已完成 |
| M4 | 2026-05-18 | 测试 + 文档 + 向后兼容说明 | ✅ 已完成 |
| M5 | 2026-05-20 | 验收 + 发布 v4.1.0 | 🔵 待开始 |

---

## P0：阻塞项（必须完成，否则版本无法发布）

### 基础设施（来自已合并的 v4.0.1）

- [x] **Hook 抽象层基类**
  - 负责人：Developer
  - 来源问题：Hook 注册与触发机制不可靠
  - 交付物：`src/common/hook.js`
  - 验收标准：封装 `api.on()`、按官方文档区分 modifying/void/claiming、统一错误捕获、统一日志到 `logs/agent-self-development-hooks.log`、任一 handler 抛异常不中断 hook 链
  - 里程碑：M1

- [x] **三模块迁移到 Hook 基类**
  - 负责人：Developer
  - 来源问题：Hook 注册与触发机制不可靠
  - 交付物：修改后的 `src/metacognition/module.js`、`src/working-memory/module.js`、`src/personality/module.js`
  - 验收标准：所有模块移除 `.bind(this)`，改为继承基类注册；handler 签名和返回值符合官方契约
  - 里程碑：M1
  - 依赖：Hook 抽象层基类完成后才能开始

- [x] **命名全局替换：`.openclaw` → `.agent`**
  - 负责人：Developer
  - 来源问题：项目文件命名不统一
  - 交付物：全仓库路径引用更新 + wiki 模板重命名
  - 验收标准：grep 全文无 `.openclaw` 残留；wiki 页面 `project-directory.md`、`project-metadata.md`、`project-todo.md` 可正常访问
  - 里程碑：M1

### 核心架构（v4.1.0 目标）

- [x] **设计 Tool Schema**
  - 负责人：Developer
  - 来源问题：推送式架构、与生态脱节、隐式标记
  - 交付物：`src/tools/` 目录下 13 个 tools 的 JSON Schema 定义
  - 验收标准：所有 tools 的输入/输出/错误处理明确，Agent 可见
  - 里程碑：M2

- [x] **实现 Tool 注册层**
  - 负责人：Developer
  - 交付物：修改后的 `src/index.js`
  - 验收标准：`api.registerTool()` 注册所有 13 个 tools，Agent 可在 tool 列表中看到
  - 里程碑：M2
  - 依赖：Tool Schema 完成后才能开始

- [x] **实现核心 Tools（元认知）**
  - 负责人：Developer
  - 交付物：`src/tools/metacognition-tools.js`
  - 验收标准：
    - `get_planning_guide` — 返回对应 phase 的 skill 文本
    - `get_monitoring_guide` — 返回 monitoring 指导 + 当前阶段 + 历史偏差
    - `get_regulation_guide` — 条件可用，返回 regulation 指导 + 偏差摘要
    - `get_development_guide` — 返回 development 指导 + Event 摘要
    - `create_plan` — 创建 draft task（替代 `[NEED_PLAN]`）
    - `update_task_status` — 更新 task.status（替代 `[STATUS]`）
    - `advance_phase` — 推进 currentPhase
    - `record_deviation` — 写入事件文件偏差章节
    - `record_attribution` — 写入事件文件归因章节
  - 里程碑：M2
  - 依赖：Tool 注册层 + 命名替换完成后才能开始（因为工具需要读写 `.agent/` 目录）

- [x] **实现辅助 Tools（工作记忆 + 人格 + 诊断）**
  - 负责人：Developer
  - 交付物：`src/tools/working-memory-tools.js`、`src/tools/personality-tools.js`
  - 验收标准：
    - `get_task_status` — 返回完整 Task JSON
    - `get_task_files` — 返回 `.agent/tasks/{runId}.json` 中的文件列表
    - `self_diagnose` — 返回当前任务诊断信息
    - `archive_task` — 触发归档流程
  - 里程碑：M2

---

## P1：重要项（影响体验，但不阻塞发布）

- [x] **简化 `before_prompt_build` 注入**
  - 负责人：Developer
  - 来源问题：推送式架构、system context 膨胀
  - 交付物：修改后的 `src/metacognition/module.js` 等
  - 验收标准：不再注入完整 skill 文本，仅输出最小化提示（状态 + tools 列表，1-2 句）
  - 里程碑：M3

- [x] **添加配置开关 `injectionMode`**
  - 负责人：Developer
  - 来源问题：向后兼容
  - 交付物：修改后的 `openclaw.plugin.json`、`src/index.js`
  - 验收标准：`configSchema` 新增 `injectionMode: "legacy" | "tool-driven"`，默认 `"tool-driven"`
  - 里程碑：M3

- [x] **更新 `before_agent_finalize` 支持 tool 调用结果解析**
  - 负责人：Developer
  - 来源问题：隐式标记
  - 交付物：修改后的 `src/metacognition/module.js`
  - 验收标准：Agent 通过 tool 调用 `update_task_status` 后状态正确更新；保留 `[STATUS]` 标记解析（deprecated）
  - 里程碑：M3

- [x] **重写 Skill 文档为 Tool 返回源**
  - 负责人：Developer
  - 来源问题：推送式架构
  - 交付物：重构后的 `src/**/SKILL.md`
  - 验收标准：各 SKILL.md 内容可被 tool 直接返回，去除 frontmatter、Markdown 表格等 LLM 不友好格式
  - 里程碑：M3

---

## P2：优化项（可延后，不影响核心功能）

- [x] **更新技术参考文档**
  - 负责人：Developer
  - 交付物：`docs/reference/hook-reference.md`、`docs/reference/object-model.md`
  - 验收标准：更新为 Tool + Hook 混合架构描述
  - 里程碑：M4

- [x] **新增测试（Tool 调用路径）**
  - 负责人：Developer
  - 交付物：`test/` 新增用例
  - 验收标准：覆盖每个 tool 的输入验证、正常执行、错误处理
  - 里程碑：M4

- [x] **向后兼容说明文档**
  - 负责人：PM
  - 来源问题：破坏性变更
  - 交付物：`docs/changelog/v4.1.0.md`
  - 验收标准：包含迁移指南（如何从 `[STATUS]` 标记迁移到 tool 调用、`.openclaw` 如何重命名为 `.agent`）
  - 里程碑：M4

- [x] **钩子调用链可视化**
  - 负责人：Developer
  - 来源问题：可观测性
  - 交付物：`logs/agent-self-development-hooks.log` 增强格式
  - 验收标准：单条日志可还原「某次对话经历了哪些 hook、各 hook 执行结果」
  - 里程碑：M4

---

## 问题-解决对照表

| 问题 | 来源 | 解决方案 | 对应任务 |
|------|------|----------|----------|
| A. Hook 注册不可靠 | v4.0.1 | Hook 抽象层基类 + 三模块迁移 | P0-1, P0-2 |
| B. 命名不统一 | v4.0.1 | `.openclaw` → `.agent` 全局替换 | P0-3 |
| C. 插件职责越界 | v4.0.1 | 插件从"主动代劳"变为"被动响应"——操作型 Tool 仅在 Agent 调用时执行文件写入 | P0-5 ~ P0-7 |
| 1. 推送式架构 | v4.1.0 | Tool 暴露 + 最小化 Hook 注入 | P0-4 ~ P0-7, P1-1 |
| 2. 与生态脱节 | v4.1.0 | `api.registerTool()` 注册 13 个 tools | P0-4, P0-5 |
| 3. 隐式标记 | v4.1.0 | `create_plan`/`update_task_status` Tool 替代标记 | P0-6, P1-3 |
| 4. Agent 感知不到注入 | v4.1.0 | Tool 可直接调用，不依赖注入链路 | P0-5 ~ P0-7 |

---

## 角色分工

| 角色 | 当前任务 | 下一步任务 |
|------|----------|-----------|
| **PM** | 建立 TODO.md 看板、确认蓝图 | 向后兼容说明文档（P2-3） |
| **Developer** | 等待 PM 确认后开工 | Hook 抽象层基类（P0-1） |
| **Reviewer** | 待命 | 各里程碑完成后审查 |

---

## 阻塞与风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Hook 抽象层基类设计不当，影响所有模块 | 🔴 高 | 先输出设计草案，PM 评审后再编码 |
| `.openclaw` → `.agent` 替换遗漏，导致运行时错误 | 🟡 中 | 使用 grep 全仓库扫描，编写替换脚本 |
| Tool 注册后 Agent 仍无法感知 | 🟡 中 | 自测 `self_diagnose` tool，验证 Agent 可见性 |
| legacy 模式与 tool-driven 模式切换逻辑复杂 | 🟡 中 | 配置开关默认 tool-driven，legacy 仅作逃生舱 |

---

## 最近更新

- **2026-05-11**：M5 完成——验收通过，发布 v4.1.0 tag，推送到 origin
- **2026-05-11**：M4 完成——测试覆盖 120/120、4 个 reference 文档更新、changelog/v4.1.0.md 迁移指南、钩子调用链日志增强
- **2026-05-11**：M3 完成——Hook 注入简化、injectionMode 配置、Skill 重构、83/83 测试通过
- **2026-05-11**：M2 完成——13 个 Tools 注册实现、70/70 测试通过
- **2026-05-11**：M1 完成——Hook 抽象层基类、.openclaw→.agent 替换、32/32 测试通过
