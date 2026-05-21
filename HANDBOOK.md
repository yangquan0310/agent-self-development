# agent-self-development 操作手册

> 版本：4.3.0
> 类型：OpenClaw 插件项目

---

## 项目入门

任何 Agent 进入本项目后，必须按以下顺序执行：

```
1. 阅读 README.md
   └── 了解插件架构、设计哲学、6 个工具

2. 打开 metadata.json 和 openclaw.plugin.json
   └── 了解插件元数据、configSchema、已注册 tools

3. 打开 {项目路径}/.agentsagents/
   └── 查看自己的角色文件（PM / Developer / Reviewer）
   └── 明确自己的职责边界

4. 打开 TODO.md
   └── 了解当前版本目标（v4.3.0 Flat Architecture）
   └── 确认自己负责的任务项（P0/P1/P2）
```

---

## 协作规范

**线性协作流程：程序员创建4个子代理，按顺序串行执行。**

```
程序员（主代理）
  ↓ 创建子代理1：产品经理（PM）
  ↓ 加载 .agentsagents/product-manager.md
产品经理：分析需求 → 制定版本计划 → 更新 TODO（P0/P1/P2 分级）
  ↓ 返回主代理
主代理 → 创建子代理2：架构师
  ↓ 加载 .agentsagents/architect.md
架构师：审核插件架构 → 评估工具设计 → 更新 TODO
  ↓ 返回主代理
主代理 → 创建子代理3：程序员（Developer）
  ↓ 加载 .agentsagents/developer.md
程序员：按 TODO 完成 src/ 代码编写 → 编写测试 → 更新 TODO
  ↓ 返回主代理
主代理 → 创建子代理4：审核（Reviewer）
  ↓ 加载 .agentsagents/reviewer.md
审核：代码审查 + 架构合规检查 → 输出审核意见
  ↓ 返回主代理
主代理：汇总结果，更新 openclaw.plugin.json / package.json → 向老板汇报
```

**关键规则：**
- 每个子代理**只加载自己的角色配置**，不加载其他角色
- 子代理完成自己的任务后**必须更新 TODO.md**，标记进度和状态
- 子代理**完成后返回主代理**，由主代理决定是否进入下一阶段
- 主代理负责**创建和销毁子代理**，子代理之间不直接通信
- 使用 `sessions_spawn` 创建子代理，`context="fork"` 传递当前上下文
- **禁止修改 src/ 目录之外的文件**（除非主代理明确授权）

**子任务必须在 TODO.md 中发布。**

- 任何需要子代理执行的任务，必须先在 TODO.md 中创建任务项
- 任务项需包含：任务ID、任务描述、负责人、状态、创建时间
- 子代理收到任务后，应先查看 TODO.md 确认任务状态
- 子代理完成后更新 TODO.md 状态为 completed

---

## 文件归档规范

各代理完成工作后的产出物，必须按以下规则归档到对应目录：

| 产出类型 | 归档目录 | 说明 |
|----------|----------|------|
| 插件源代码 | `src/` | .js 模块文件，含 `tools/`、`utils/`、`index.js` |
| 测试代码 | `test/` | .test.js 测试套件 |
| 项目级技能 | `.agentsskills/` | 协作协议、技术规范、上下文管理 |
| 角色定义 | `.agentsagents/` | PM / Developer / Reviewer 角色 .md 文件 |
| 架构文档 | `docs/reference/` | architecture.md、data-model.md 等 |
| 版本路线图 | `docs/roadmap/` | v4.x ~ v5.0 规划 |
| 变更日志 | `docs/changelog/` | 完整版本历史 |
| 测试报告 | `docs/reports/` | 测试覆盖率、审查报告 |
| 运行日志 | `logs/` | 插件运行时日志 |
| 临时文件 | `temp/` | .tmp/.temp/.bak 等中间文件 |

> **禁止在根目录存放任何文档**。所有产出物必须归入上表目录。如有例外，需经主代理确认。

### 插件特定文件

| 文件 | 说明 | 修改权限 |
|------|------|----------|
| `openclaw.plugin.json` | 插件清单（id、configSchema 等） | PM + 架构师 |
| `package.json` | npm 配置（dependencies、scripts 等） | Developer |
| `src/index.js` | 插件入口（initialize） | Developer |
| `src/tools/` | 8 个 tools 实现 + schemas + handlers | Developer |
| `src/utils/` | 工具函数（path、io、validate、helpers） | Developer |

---

## 保护文件

以下文件禁止移动/修改（除非明确授权）：

| 文件 | 说明 |
|------|------|
| README.md | 项目总览 |
| HANDBOOK.md | 本文件 |
| TODO.md | 进度看板 |
| metadata.json | 项目元数据 |
| openclaw.plugin.json | 插件清单 |
| package.json | npm 配置 |
| .gitignore | 版本控制忽略 |

---

## 插件工具清单（8 个）

Agent 可通过 `api.callTool()` 调用以下工具：

| 工具 | 功能 | 必填参数 |
|------|------|----------|
| `task.create` | 创建 draft task | `prompt` |
| `task.update` | 更新 task（状态/偏差/归因/结果/事件路径） | `runId` |
| `task.advance` | 推进到下一阶段 | `runId` |
| `task.get` | 查询完整 task JSON（支持双路径扫描） | `runId` |
| `task.archive` | 归档 completed task | `runId` |
| `event.report` | 从 task.json 生成 event.md | `runId` |
| `event.query` | 查询事件记录 | — |
| `event.archive` | 归档事件文件 | `runId` |

**状态机**：
```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

**Agent 典型工作流**：
```
1. task.create({ prompt: "..." }) → 获取 runId
2. task.update({ runId, status: "pending_approval" })
3. task.update({ runId, status: "active" })
4. 执行任务中... task.advance({ runId }) 推进阶段
5. 发现偏差 → task.update({ runId, deviation: {...} })
6. 分析归因 → task.update({ runId, attribution: {...} })
7. 任务完成 → task.update({ runId, status: "completed", outcome: {...} })
8. event.report({ runId }) → 生成事件文件，自动关联 task.eventFilePath
9. event.query({ runId, date, type }) → 按需查询历史事件
10. event.archive({ runId }) → 归档事件文件
11. task.archive({ runId }) → 归档任务
```

---

## Git 工作流

### 双分支策略

```
main（主分支）
  ↑
  │  ← 完成整体任务时合并
  │
dev（开发分支）
  ├── commit: feat: 需求分析
  ├── commit: feat: 核心模块开发
  ├── commit: fix: 修复边界条件
  └── commit: feat: 功能完成  ← 推送到 main
```

| 分支 | 用途 | 推送时机 |
|------|------|---------|
| `main` | 稳定版本，已发布的功能 | **完成整体任务时** |
| `dev` | 日常开发，功能迭代中 | **完成阶段子任务时** |

### 规则

- **日常开发**：只推送到 `dev`
- **完成整体任务**：同时推送到 `main` 和 `dev`
- **禁止直接推 main**：除非在完成整体任务流程中

### Commit Message 格式

```
{类型}: {简要说明}
```

| 类型 | 使用场景 | 示例 |
|------|---------|------|
| `feat` | 新增功能 | `feat: 添加 task.advance Handler` |
| `fix` | 修复问题 | `fix: 修复空指针异常` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `refactor` | 代码重构 | `refactor: 扁平化 Handler 架构` |
| `test` | 测试相关 | `test: 补充边界用例` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |

### 完成整体任务流程

```bash
# 确保在 dev 分支
git checkout dev

# 提交所有变更
git add -A
git commit -m "feat: 功能完成"

# 推送到 dev
git push origin dev

# 合并到 main
git checkout main
git merge dev

# 推送到 main
git push origin main

# 回到 dev 继续下一任务
git checkout dev
```

---

## 👥 Agent 角色速查

| 角色 | 核心职责 | 可操作目录 | 禁止事项 |
|------|----------|-----------|---------|
| **产品经理** | 需求分析、架构设计、任务分配 | 全局 | 不写代码 |
| **程序员** | 代码实现、测试验证、文档同步 | `src/`、`test/` | 不决定产品方向 |
| **审查员** | 代码审查、合规检查、裁决 | `src/`（只读） | 不修改代码 |

> 详细角色规范见 `.agentsagents/` 目录下各角色文件。
