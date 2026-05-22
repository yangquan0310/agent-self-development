# agent-self-development

OpenClaw 插件 — Agent 自我发展工具集

> **核心原则**：用户领航 → Agent 执行 → 插件只记录（Plugin asks, Agent decides, Plugin records）
>
> **当前版本**：v4.5.0
>
> **设计哲学**：钩子加工具，暴露工具加适时提醒

---

## 架构（v4.5.0）

v4.5.0 采用**钩子 + 工具**混合架构：Hook 负责精准注入时机，Tool 负责数据持久化，两者协同实现 Agent 自我发展。

**注入时机矩阵（M1-M4）**：

| 里程碑 | 触发时机 | 事件 | 用途 |
|--------|----------|------|------|
| M1 | task.create | 计划阶段 | 注入目标约束 |
| M2 | task.update 含 deviation | 偏差检测 | 触发归因分析 |
| M3 | event.report | 任务完成 | 生成事件文件 |
| M4 | 无任务执行 | 定期检查 | 适时提醒 |

**8 个命名空间工具**：

| 工具 | 功能 | 说明 |
|------|------|------|
| `task.create` | 创建 draft task | 基于 prompt 自动推断 plan，写入 `.agentstasks/{runId}.json` |
| `task.update` | 更新 task | 唯一更新入口，支持 status / deviation / attribution / outcome / eventFilePath |
| `task.advance` | 推进阶段 | 推进到下一阶段或指定 phaseId |
| `task.get` | 查询 task | 返回完整 task.json（支持活跃/归档双路径回退） |
| `task.archive` | 归档 task | 移动 task.json 到 `.agentstasks/archive/` |
| `event.report` | 生成事件文件 | 任务完成后从 task.json 凝练生成 event.md |
| `event.query` | 查询事件 | 按 runId / date / type 筛选 |
| `event.archive` | 归档事件 | 移动 event.md 到 `.agentsevents/archive/` |

**状态机**：
```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

---

## 理论基础

本框架基于两大理论基础：

### 1. 分布式自传体记忆 → [ch02](docs/reference/ch02-distributed-autobiographical-memory-architecture.md)

**工作自我的三种功能**（Conway & Pleydell-Pearce, 2000）：

| 工作自我功能 | 代理操作 | 记录位置 |
|-------------|---------|---------|
| **计划** | 任务启动前制定执行方案 | `.agentstasks/{runId}.json` |
| **偏差** | 实际执行与预期的差异 | `.agentstasks/{runId}.json` |
| **归因** | 对偏差的分析与策略调整 | `.agentstasks/{runId}.json` |

**自传体记忆：以"我"为索引**
- 核心问题：为什么语义检索不够？
- 自传体记忆以"我之前做了什么、为什么那样做、结果如何"为主线组织经验

**分布式架构**：
- **外部文件系统**：`.agentsevents/` 存储行动轨迹
- **内部上下文窗口**：Session 承担内部记忆
- **二者协同**：扩展 Agent 的自我加工能力

### 2. 皮亚杰发展理论 → [ch01](docs/reference/ch01-piaget-development-algorithm.md)

**六维度平衡**：

| 维度 | 内容 | 失衡信号 |
|------|------|----------|
| $D_1$ 自我认知 | 能力边界集合 | 发现新能力边界或盲区 |
| $D_2$ 风格 | 行为模式集合 | 风格效率高低 |
| $D_3$ 信念 | 价值判断集合 | 信念被冲突或验证 |
| $D_4$ 身份 | 角色定义集合 | 承担超出身份的职责 |
| $D_5$ 程序性记忆 | 因果模式集合 | 归因揭示新因果模式 |
| $D_6$ 技能 | 技能条目集合 | 获得新技能或发现不足 |

**核心机制**：同化（结构不变）+ 顺应（结构重组）+ 动态平衡

---

## 快速开始

### 安装

```bash
openclaw plugins install git:github.com/yangquan0310/agent-self-development
openclaw plugins enable agent-self-development
```

### Agent 白名单配置

```json
{
  "tools": {
    "alsoAllow": [
      "task.create", "task.update", "task.advance",
      "task.get", "task.archive",
      "event.report", "event.query", "event.archive"
    ]
  }
}
```

---

## 项目结构

```
agent-self-development/
├── src/                    # 插件源码
├── test/                   # 测试套件
├── docs/                   # 文档
│   └── reference/          # 技术参考手册（10章节）
└── README.md               # 本文档
```

---

## 文档导航

### 第一部分：方法论

| 文档 | 说明 |
|------|------|
| [ch01 皮亚杰发展算法](docs/reference/ch01-piaget-development-algorithm.md) | 六维度形式化、同化/顺应/平衡建模、李雅普诺夫函数、范畴论框架 |
| [ch02 分布式自传体记忆架构](docs/reference/ch02-distributed-autobiographical-memory-architecture.md) | 工作自我、自传体记忆、三层认知架构 |

### 第二部分：架构

| 文档 | 说明 |
|------|------|
| [ch03 设计哲学](docs/reference/ch03-design-philosophy.md) | 钩子加工具，暴露工具加适时提醒 |
| [ch04 架构设计](docs/reference/ch04-architecture.md) | 扁平工具架构、8个命名空间工具 |
| [ch05 架构数学基础](docs/reference/ch05-architecture-mathematical.md) | 范畴论定义、状态机、复杂度分析 |

### 第三部分：技术实现

| 文档 | 说明 |
|------|------|
| [ch06 数据模型](docs/reference/ch06-data-model.md) | Task/Event JSON Schema、状态转换 |
| [ch07 对象模型](docs/reference/ch07-object-model.md) | 函数模块模型、对象层/工具层/基础设施层 |
| [ch08 项目结构](docs/reference/ch08-project-structure.md) | 标准目录结构、四文件契约 |
| [ch09 状态键](docs/reference/ch09-state-keys.md) | 文件系统键空间、task.json 字段规范 |
| [ch10 Hook机制](docs/reference/ch10-hook-reference.md) | v4.5.0 条件触发、注入时机矩阵 |

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| **v4.5.0** | 2026-05-22 | 钩子 + 工具混合架构，条件触发机制，注入时机矩阵（M1-M4） |
| v4.3.0 | 2026-05-19 | 扁平化架构：纯 Tool Plugin，8 个命名空间工具 |
| v4.2.0 | 2026-05-13 | Cognitive Intelligence：认知轨迹、模板引擎、案例索引 |
| v4.1.0 | 2026-05-11 | Tool-Driven 架构：13 个 tools 暴露、Hook 注入最小化 |

---

*License: MIT*
