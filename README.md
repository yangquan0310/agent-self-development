# agent-self-development

OpenClaw 插件 — Agent 自我发展工具集

> **核心原则**：用户领航 → Agent 执行 → 插件只记录（Plugin asks, Agent decides, Plugin records）
>
> **当前版本**：v4.3.0（Flat Architecture）
>
> **设计哲学**：从"代劳"到"赋能"——插件暴露工具，Agent 自主决定需要什么。

---

## 扁平化架构（v4.3.0）

v4.3.0 是纯粹的 **Tool Plugin**：仅通过 `api.registerTool()` 暴露 8 个命名空间工具，Handler 直接读写文件，无类、无 Hook、无依赖注入。

**8 个命名空间工具**：

| 工具 | 功能 | 说明 |
|------|------|------|
| `task.create` | 创建 draft task | 基于 prompt 自动推断 plan，写入 `.agent/tasks/{runId}.json` |
| `task.update` | 更新 task | 唯一更新入口，支持 status / deviation / attribution / outcome / eventFilePath 任意组合 |
| `task.advance` | 推进阶段 | 推进到下一阶段或指定 phaseId |
| `task.get` | 查询 task | 返回完整 task.json（支持活跃/归档双路径回退） |
| `task.archive` | 归档 task | 移动 task.json 到 `.agent/tasks/archive/` |
| `event.report` | 生成事件文件 | 任务完成后从 task.json 一次性凝练生成 event.md，并回写 task.eventFilePath |
| `event.query` | 查询事件 | 按 runId / date / type 筛选 |
| `event.archive` | 归档事件 | 移动 event.md 到 `.agent/events/archive/` |

**状态机**：
```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

---

## 快速开始

### 安装

```bash
openclaw plugins install git:github.com/yangquan0310/agent-self-development
openclaw plugins enable agent-self-development
```

### Agent 白名单配置

在 `openclaw.json` 中启用 8 个工具：

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

重启 Gateway 后生效。

---

## 理论基础

本框架的理论基础来源于**仓库作者的博士论文**《数字化存储对自传体记忆的影响及其机制》。将人类自传体记忆机制迁移至 Agent 记忆设计：

- **语义记忆** → 语义向量检索（memory-core）
- **自传体记忆** → 行动序列索引（`.agent/events/` 事件流）

详见 [`docs/reference/theory.md`](docs/reference/theory.md)。

---

## 项目结构

```
agent-self-development/
├── src/                    # 插件源码
│   ├── index.js            # 入口：加载模板 + 注册 8 个工具
│   ├── objects/            # 业务函数（task.js / event.js）
│   ├── tools/              # 工具注册 + Handler + Schema
│   ├── utils/              # IO / 路径解析 / 校验 / 生成器
│   └── assets/             # 模板文件（task.json / event.md）
├── test/                   # 测试套件
├── docs/                   # 文档
└── README.md               # 本文档
```

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [`docs/reference/architecture.md`](docs/reference/architecture.md) | 三层架构、数据流、模块职责 |
| [`docs/reference/data-model.md`](docs/reference/data-model.md) | Task JSON Schema、状态转换、工具示例 |
| [`docs/reference/design-philosophy.md`](docs/reference/design-philosophy.md) | "从代劳到赋能"的设计哲学 |
| [`docs/COLLABORATION.md`](docs/COLLABORATION.md) | 多 Agent 协作协议、角色边界 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | 编码规范、目录命名 |
| [`docs/roadmap/`](docs/roadmap/) | 版本路线图 |
| [`docs/changelog/`](docs/changelog/) | 完整版本历史 |

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| **v4.3.0** | 2026-05-31（预计） | 扁平化架构：纯 Tool Plugin，8 个命名空间工具，Handler 直接 IO |
| v4.2.0 | 2026-05-13 | Cognitive Intelligence：认知轨迹、模板引擎、案例索引 |
| v4.1.0 | 2026-05-11 | Tool-Driven 架构：13 个 tools 暴露、Hook 注入最小化 |

完整历史见 [`docs/changelog/`](docs/changelog/)。

---

*License: MIT*
