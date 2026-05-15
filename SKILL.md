# agent-self-development 操作手册

> 版本：4.2.0
> 类型：OpenClaw 插件项目

---

## 项目入门

任何 Agent 进入本项目后，必须按以下顺序执行：

```
1. 阅读 README.md
   └── 了解插件架构、三层认知理论、设计哲学

2. 打开 metadata.json 和 openclaw.plugin.json
   └── 了解插件元数据、configSchema、已注册 tools

3. 打开 {项目路径}/.agent/agents/
   └── 查看自己的角色文件（PM / Developer / Reviewer）
   └── 明确自己的职责边界

4. 打开 TODO.md
   └── 了解当前版本目标（v4.2.0 Cognitive Intelligence）
   └── 确认自己负责的任务项（P0/P1/P2）
```

---

## 协作规范

**线性协作流程：程序员创建4个子代理，按顺序串行执行。**

```
程序员（主代理）
  ↓ 创建子代理1：产品经理（PM）
  ↓ 加载 .agent/agents/product-manager.md
产品经理：分析需求 → 制定版本计划 → 更新 TODO（P0/P1/P2 分级）
  ↓ 返回主代理
主代理 → 创建子代理2：架构师
  ↓ 加载 .agent/agents/architect.md
架构师：审核插件架构 → 评估 Hook/tool 设计 → 更新 TODO
  ↓ 返回主代理
主代理 → 创建子代理3：程序员（Developer）
  ↓ 加载 .agent/agents/developer.md
程序员：按 TODO 完成 src/ 代码编写 → 编写测试 → 更新 TODO
  ↓ 返回主代理
主代理 → 创建子代理4：审核（Reviewer）
  ↓ 加载 .agent/agents/reviewer.md
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
| 插件源代码 | `src/` | .js 模块文件，含 metacognition/、working-memory/、personality/、common/ |
| 测试代码 | `test/` | .test.js 测试套件 |
| 项目级技能 | `.agent/skills/` | 协作协议、技术规范、上下文管理 |
| 角色定义 | `.agent/agents/` | PM / Developer / Reviewer 角色 .md 文件 |
| 架构文档 | `docs/reference/` | architecture.md、data-model.md、hook-reference.md 等 |
| 版本路线图 | `docs/roadmap/` | v4.x ~ v5.0 规划 |
| 变更日志 | `docs/changelog/` | 完整版本历史 |
| 测试报告 | `docs/reports/` | 测试覆盖率、审查报告 |
| 运行日志 | `logs/` | 插件运行时日志、认知轨迹日志 |
| 临时文件 | `temp/` | .tmp/.temp/.bak 等中间文件 |

> **禁止在根目录存放任何文档**。所有产出物必须归入上表目录。如有例外，需经主代理确认。

### 插件特定文件

| 文件 | 说明 | 修改权限 |
|------|------|----------|
| `openclaw.plugin.json` | 插件清单（id、configSchema、skills 等） | PM + 架构师 |
| `package.json` | npm 配置（dependencies、scripts 等） | Developer |
| `src/index.js` | 插件入口（register/activate） | Developer |
| `src/tools/` | 13 个 tools 实现 | Developer |

---

## 保护文件

以下文件禁止移动/修改（除非明确授权）：

| 文件 | 说明 |
|------|------|
| README.md | 项目总览 |
| SKILL.md | 本文件 |
| TODO.md | 进度看板 |
| metadata.json | 项目元数据 |
| openclaw.plugin.json | 插件清单 |
| package.json | npm 配置 |
| .gitignore | 版本控制忽略 |
| .agentignore | 可见性控制 |

---

## 插件工具清单（13个）

Agent 可通过 `api.callTool()` 调用以下工具：

| Tool | 功能 | 所属模块 |
|------|------|----------|
| `get_task_status` | 查询任务状态 | Working Memory |
| `get_task_files` | 获取任务关联文件 | Working Memory |
| `get_planning_guide` | 获取计划指南 | Metacognition |
| `get_monitoring_guide` | 获取监控指南 | Metacognition |
| `get_regulation_guide` | 获取调节指南 | Metacognition |
| `get_development_guide` | 获取发展指南 | Personality |
| `self_diagnose` | 自我诊断 | Working Memory |
| `create_plan` | 创建计划 | Metacognition |
| `update_task_status` | 更新任务状态 | Working Memory |
| `advance_phase` | 推进阶段 | Metacognition |
| `record_deviation` | 记录偏差 | Metacognition |
| `record_attribution` | 记录归因 | Metacognition |
| `archive_task` | 归档任务 | Working Memory |

---

## Git 工作流

### 双分支策略

```
main（主分支）
  ↑
  │  ← 完成整体任务时合并
  │
development（开发分支）
  ├── commit: feat: 需求分析
  ├── commit: feat: 核心模块开发
  ├── commit: fix: 修复边界条件
  └── commit: feat: 功能完成  ← 推送到 main
```

| 分支 | 用途 | 推送时机 |
|------|------|---------|
| `main` | 稳定版本，已发布的功能 | **完成整体任务时** |
| `development` | 日常开发，功能迭代中 | **完成阶段子任务时** |

### 规则

- **日常开发**：只推送到 `development`
- **完成整体任务**：同时推送到 `main` 和 `development`
- **禁止直接推 main**：除非在完成整体任务流程中

### Commit Message 格式

```
{类型}: {简要说明}
```

| 类型 | 使用场景 | 示例 |
|------|---------|------|
| `feat` | 新增功能 | `feat: 添加用户认证模块` |
| `fix` | 修复问题 | `fix: 修复空指针异常` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `refactor` | 代码重构 | `refactor: 优化查询逻辑` |
| `test` | 测试相关 | `test: 补充单元测试` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |

### 完成整体任务流程

```bash
# 确保在 development 分支
git checkout development

# 提交所有变更
git add -A
git commit -m "feat: 功能完成"

# 推送到 development
git push origin development

# 合并到 main
git checkout main
git merge development

# 推送到 main
git push origin main

# 回到 development 继续下一任务
git checkout development
```

---

## 👥 Agent 角色速查

| 角色 | 核心职责 | 可操作目录 | 禁止事项 |
|------|----------|-----------|---------|
| **产品经理** | 需求分析、架构设计、任务分配 | 全局 | 不写代码 |
| **程序员** | 代码实现、测试验证、文档同步 | `src/`、`test/` | 不决定产品方向 |
| **审查员** | 代码审查、合规检查、裁决 | `src/`（只读） | 不修改代码 |

> 详细角色规范见 `.agent/agents/` 目录下各角色文件。
