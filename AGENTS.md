<!-- ⚠️ 保护：本段已加 GENERATED 标记，sync 时由 manager 技能模板替换 -->
<!-- GENERATED_START -->
# agent-self-development 操作手册

> 版本：4.5.1
> 类型：OpenClaw 插件项目

---

## 项目入门

任何 Agent 进入本项目后，必须按以下顺序执行：

```
1. 阅读 README.md
   └── 了解插件架构、设计哲学、6 个工具

2. 打开 metadata.json 和 openclaw.plugin.json
   └── 了解插件元数据、configSchema、已注册 tools

3. 打开 {项目路径}/.agents/agents/
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
  ↓ 加载 .agents/agents/product-manager.md
产品经理：分析需求 → 制定版本计划 → 更新 TODO（P0/P1/P2 分级）
  ↓ 返回主代理
主代理 → 创建子代理2：架构师
  ↓ 加载 .agents/agents/architect.md
架构师：审核插件架构 → 评估工具设计 → 更新 TODO
  ↓ 返回主代理
主代理 → 创建子代理3：程序员（Developer）
  ↓ 加载 .agents/agents/developer.md
程序员：按 TODO 完成 src/ 代码编写 → 编写测试 → 更新 TODO
  ↓ 返回主代理
主代理 → 创建子代理4：审核（Reviewer）
  ↓ 加载 .agents/agents/reviewer.md
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
| 项目级技能 | `.agents/skills/` | 协作协议、技术规范、上下文管理 |
| 角色定义 | `.agents/agents/` | PM / Developer / Reviewer 角色 .md 文件 |
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
| AGENTS.md | 本文件 |
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
| `task_create` | 创建 draft task | `prompt` |
| `task_update` | 更新 task（状态/偏差/归因/结果/事件路径） | `runId` |
| `task_advance` | 推进到下一阶段 | `runId` |
| `task_get` | 查询完整 task JSON（支持双路径扫描） | `runId` |
| `task_archive` | 归档 completed task | `runId` |
| `event_report` | 从 task.json 生成 event.md | `runId` |
| `event_query` | 查询事件记录 | — |
| `event_archive` | 归档事件文件 | `runId` |

**状态机**：
```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

**Agent 典型工作流**：
```
1. task_create({ prompt: "..." }) → 获取 runId
2. task_update({ runId, status: "pending_approval" })
3. task_update({ runId, status: "active" })
4. 执行任务中... task_advance({ runId }) 推进阶段
5. 发现偏差 → task_update({ runId, deviation: {...} })
6. 分析归因 → task_update({ runId, attribution: {...} })
7. 任务完成 → task_update({ runId, status: "completed", outcome: {...} })
8. event_report({ runId }) → 生成事件文件，自动关联 task.eventFilePath
9. event_query({ runId, date, type }) → 按需查询历史事件
10. event_archive({ runId }) → 归档事件文件
11. task_archive({ runId }) → 归档任务
```

---

## Git 工作流

### 分支模型（4 层流转）

```
main   （稳定版 / 同步远程分支）
  ↑
  │  ← beta 稳定 + 打 tag vX.Y.Z
  │
beta   （公测预发布 / 同步远程分支）
  ↑
  │  ← alpha 稳定 + 打 tag vX.Y.Z-beta.N
  │
alpha  （内测预发布 / 同步远程分支）
  ↑
  │  ← dev 稳定后切出 + 打 tag vX.Y.Z-alpha.N
  │
dev   （开发主线）
  ↑ ↑
  │ │
  │ └── fix/<name>   （bug 修复）
  │
  └──── feature/<name>（新功能开发）
```

### 分支清单

| 分支 | 命名规则 | 用途 | 生命周期 | 远程推送 |
|------|----------|------|----------|----------|
| `main` | 固定 | 稳定发布版（同步远程分支） | 永久 | ✅ **每次发布** |
| `beta` | 固定 | 公测预发布（同步远程分支） | 长期 | ✅ **切出时** |
| `alpha` | 固定 | 内测预发布（同步远程分支） | 长期 | ✅ **切出时** |
| `dev` | 固定 | 开发主线（**仅本地，不推远程**） | 永久（本地） | ❌ **仅本地** |
| `feature/<name>` | `feature/<kebab-desc>` | 新功能开发 | 短期（合并后删除） | ❌ **仅本地** |
| `fix/<name>` | `fix/<kebab-desc>` | bug 修复 | 短期（合并后删除） | ❌ **仅本地** |

> **`<name>` 命名规范**：kebab-case，2~4 个单词，描述功能或修复内容。
> 示例：`feature/task-archive` / `fix/deviation-false-positive` / `feature/adapt-loop`

### 分支流转规则

| 流转 | 触发条件 | 操作 |
|------|----------|------|
| `feature/*` → `dev` | 功能开发完成 + 自测通过 | 本地 PR 合并到 dev，删除 feature 分支（**不推远程**） |
| `fix/*` → `dev` | bug 修复完成 + 回归测试通过 | 本地 PR 合并到 dev，删除 fix 分支（**不推远程**） |
| `dev` → `alpha` | dev 稳定，需要内测预发布 | 从 dev 切出 alpha 分支，推远程 + 打 `vX.Y.Z-alpha.N` tag |
| `alpha` → `beta` | alpha 阶段无重大问题 | 从 alpha 切出 beta，推远程 + 打 `vX.Y.Z-beta.N` tag |
| `beta` → `main` | beta 反馈处理完毕 + 发布就绪 | 合并 beta → main，打 `vX.Y.Z` tag，推远程 |
| `main` → `dev` | 每次发布后同步 | 本地 main 合并到 dev（**不推远程**） |

### 保护分支

| 分支 | 保护策略 |
|------|----------|
| `main` / `beta` / `alpha` | 禁止 force push，必须通过 PR 合并 |
| `dev` (本地) | 允许 force push（仅限本地修复） |
| `feature/*` / `fix/*` | 仅本地，无需保护 |

> 在 GitHub/GitLab 上为 `main` / `beta` / `alpha` 配置 **Branch Protection Rules**。

### Commit Message 格式

```
{类型}: {简要说明}
```

| 类型 | 使用场景 | 示例 |
|------|---------|------|
| `feat` | 新增功能 | `feat: 添加 task_advance Handler` |
| `fix` | 修复问题 | `fix: 修复空指针异常` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `refactor` | 代码重构 | `refactor: 扁平化 Handler 架构` |
| `test` | 测试相关 | `test: 补充边界用例` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |
| `alpha` | alpha 发布 | `alpha: 发布 v4.6.0-alpha.0` |
| `beta` | beta 发布 | `beta: 发布 v4.6.0-beta.0` |
| `release` | 正式发布 | `release: 发布 v4.6.0` |

> Tag 命名遵循 SemVer：`v<major>.<minor>.<patch>[-<pre>.<num>]`
> 示例：`v4.5.1` / `v4.6.0-alpha.0` / `v4.6.0-beta.1`

### 完整工作流示例

#### 1️⃣ 新功能开发（feature 分支 → dev）

```bash
# 从 dev 拉 feature 分支（dev 是开发主线，不推远程）
git checkout dev
git checkout -b feature/adapt-loop

# 开发 + 多次 commit
git add -A
git commit -m "feat: 实现 ADAPT Loop Phase 1（任务创建）"
git commit -m "feat: 实现 ADAPT Loop Phase 2（偏差分析）"

# 合并到 dev（本地 PR，--no-ff 保留分支历史）
git checkout dev
git merge --no-ff feature/adapt-loop
# 注意：不要 push origin dev

# 删除本地 feature 分支
git branch -d feature/adapt-loop
```

#### 2️⃣ Bug 修复（fix 分支 → dev）

```bash
git checkout dev
git checkout -b fix/deviation-false-positive

# 修复
git add -A
git commit -m "fix: 修复 task_update 中 deviation 误判"

# 回归测试 + 合并到 dev
npm test  # 98/98 通过
git checkout dev
git merge --no-ff fix/deviation-false-positive
# 注意：不要 push origin dev
git branch -d fix/deviation-false-positive
```

#### 3️⃣ 同步 dev 与 main（本地集成）

```bash
# 当 main 有新 tag 时，同步回 dev
git checkout dev
git merge main
# 不要 push origin dev
```

#### 4️⃣ 预发布流转（dev → alpha → beta → main）

```bash
# === alpha 预发布（内测，从 dev 切出）===
git checkout -b alpha dev          # 从 dev 切出 alpha
git push origin alpha              # 推远程（alpha 是同步远程分支）
git tag v4.6.0-alpha.0
git push origin alpha --tags

# === beta 预发布（公测，alpha 稳定后）===
git checkout -b beta alpha         # 从 alpha 切出 beta
git push origin beta               # 推远程
git tag v4.6.0-beta.0
git push origin beta --tags

# === 正式发布（beta 稳定后，合入 main）===
git checkout main
git merge beta
git tag v4.6.0
git push origin main --tags

# === 同步 main 回 dev ===
git checkout dev
git merge main
# 不要 push origin dev

# === 清理 alpha/beta 分支（如不再需要） ===
# 注意：tag 仍保留，删除分支不影响 tag
```

#### 5️⃣ 热修复（直接从 main 拉 fix）

```bash
# main 上发现紧急 bug
git checkout main
git checkout -b fix/critical-task-create-crash

git add -A
git commit -m "fix: 修复 task_create 崩溃（CVE-xxx）"

# 直接合并到 main
git checkout main
git merge --no-ff fix/critical-task-create-crash
git tag v4.5.2
git push origin main --tags

# 同步回 dev
git checkout dev
git merge main
# 不要 push origin dev

git branch -d fix/critical-task-create-crash
```

### 关键纪律

- ✅ **feature/fix 分支不推远程** — 避免远程分支污染，合并后立即删除
- ✅ **alpha/beta/main 必须经 PR 合并** — 强制 code review
- ✅ **每次发布必须打 tag** — tag 与发布版本一一对应
- ✅ **dev 是开发主线** — 本地分支，所有 feature/fix 合入此处
- ✅ **main/beta/alpha 是同步远程分支** — 推远程，存在 origin 上
- ✅ **alpha 从 dev 切出** — dev 稳定后切 alpha 推远程做内测
- ❌ **禁止推 dev 到远程** — 远程 dev 已删除
- ❌ **禁止回滚已发布的 tag** — 必须通过新 tag 修复

---

## 👥 Agent 角色速查

| 角色 | 核心职责 | 可操作目录 | 禁止事项 |
|------|----------|-----------|---------|
| **产品经理** | 需求分析、架构设计、任务分配 | 全局 | 不写代码 |
| **架构师** | 项目架构 | `docs/architecture`、`docs/adr` | 不决定产品方向、不修改代码 |
| **程序员** | 代码实现、测试验证、文档同步 | `src/`、`test/` | 不决定产品方向 |
| **审查员** | 代码审查、合规检查、裁决 | `src/`（只读） | 不修改代码 |

> 详细角色规范见 `.agents/agents/` 目录下各角色文件。

<!-- GENERATED_END -->