# agent-self-development — Project Guide

> **定位**：本项目特定的操作手册
> **用途**：供操作本项目的 Agent 参考
> **版本**：v1.0.0

---

## 项目概览

| 属性 | 值 |
|------|-----|
| 名称 | agent-self-development |
| 类型 | OpenClaw 插件（Hook 驱动认知框架） |
| 分支 | dev（开发主分支） |
| 远程 | github.com:yangquan0310/agent-self-development |
| 核心目标 | 让 Agent 具备「计划 → 监控 → 调节」的元认知能力 |

### 技术栈
- Node.js (v22+)
- 插件框架：OpenClaw Extension API
- 测试：内置测试套件（31 tests）

### 项目结构
```
agent-self-development/
├── src/
│   ├── index.js              # 插件入口，模块注册
│   ├── _meta.json            # 版本元数据
│   ├── common/               # 共享工具
│   │   └── project-doc/      # [v4.0.0 新增] 项目文档底层引擎
│   ├── metacognition/        # 元认知层
│   │   ├── module.js
│   │   ├── planning/
│   │   ├── monitoring/
│   │   └── regulation/
│   ├── working-memory/       # 工作记忆层
│   │   ├── module.js
│   │   ├── session.js
│   │   └── SKILL.md
│   ├── personality/          # 人格发展层
│   │   └── module.js
│   └── project-documentation/  # [v4.0.0 新增]
├── test/
├── skills/
│   ├── project-context/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   └── project-guide.md  # ← 本文件
│   │   └── assets/
│   │       └── TODO_TEMPLATE.md
│   ├── project-conventions/
│   ├── collaboration-protocol/
│   └── skill-creator/
├── .agent/
│   ├── product-manager.md
│   ├── developer.md
│   └── reviewer.md
├── docs/
│   └── roadmap/
├── README.md
└── openclaw.plugin.json
```

---

## 代码约定

### 命名规范
- 模块类名：`PascalCase`（如 `ProjectDocumentation`）
- 文件名：`kebab-case`（如 `project-doc.js`）
- 钩子处理函数：`on{HookName}`（如 `onBeforePromptBuild`）

### 目录组织
- 新增模块 = 新增目录（与 `metacognition/` 同级）
- 每个模块至少包含：`module.js` + `{feature}.js` + `SKILL.md`

### 提交信息格式
```
{类型}: {简短描述}

可选：详细说明
```
类型：`feat` | `fix` | `docs` | `chore` | `test` | `refactor`

---

## 常用工具与命令

| 命令 | 用途 |
|------|------|
| `npm test` | 运行全量测试套件 |
| `git status` | 检查工作区状态 |
| `git log --oneline -5` | 查看最近提交 |
| `openclaw doctor` | 诊断 OpenClaw 系统 |
| `openclaw hooks list` | 查看已注册钩子 |

---

## 子模块说明

### metacognition（元认知层）
- `planning`：任务评估 → Plan 制定 → 用户确认
- `monitoring`：偏差预防提醒 + 自我监控指引
- `regulation`：归因分析 → 策略更新（v4.0.0 修复注入）
- **关键文件**：`src/metacognition/module.js`

### working-memory（工作记忆层）
- 管理 Session 生命周期（创建 / 复用 / 闲置 / 销毁）
- **关键规则**：同 `taskFamily` 优先复用 `idle` Session
- **关键文件**：`src/working-memory/session.js`

### personality（人格发展层）
- 任务完成后更新 Agent 自身文件（SOUL.md / MEMORY.md / IDENTITY.md）
- **触发时机**：`completed` 阶段（回顾性更新）

### project-documentation（项目文档层）【v4.0.0 新增】
- **职责**：项目级 README / SKILL / TODO / metadata 的「活文档」维护
- **触发时机**：`active` 阶段，检测到文件变更时即时更新
- **标记规范**：`[DOC_UPDATE: README]` / `[DOC_UPDATE: SKILL]` / `[DOC_SKIP]`

---

## 特殊注意事项

### ⚠️ 钩子合规红线
- `llm_output` / `agent_end` 为**纯观察型钩子**，禁止返回注入内容
- 所有 skill 注入必须通过 `before_prompt_build` 或 `before_agent_finalize`
- 修改钩子注册前，必须先阅读 `skills/project-conventions/SKILL.md` 2.1/2.2 节

### ⚠️ Session 复用陷阱
- `sessionId` 默认包含 `Date.now()`，精确匹配几乎不可能复用
- **解决方案**：Agent 在 Plan 中显式指定复用的 `sessionId`，或插件按 `taskFamily` 查询全局索引推荐
- 见 `docs/roadmap/v4.0.0.md` 问题 4

### ⚠️ 多代理协作协议
1. **主代理**负责：制定 Plan、监控偏差、整合产出
2. **子代理**负责：执行具体阶段任务
3. **同步方式**：子代理完成后通过 `sessions_send` 回传摘要
4. **冲突避免**：同一文件禁止并行修改

---

## 版本历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-05-08 | v4.0.0-draft | 新增 project-context 技能体系，建立项目级笔记系统 |

---

## 关联文档索引

- [架构治理计划](../../../docs/roadmap/v4.0.0.md) — 设计蓝图
- [任务看板模板](../assets/TODO_TEMPLATE.md) — 任务看板模板
- [技术规范](../../../project-conventions/SKILL.md) — 编码规范与钩子合规
- [协作协议](../../../collaboration-protocol/SKILL.md) — 多 Agent 协作协议
- [项目README](../../../README.md) — 对外说明
