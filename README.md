# agent-self-development

OpenClaw 插件 — Agent 自我发展框架

> **核心原则**：用户领航 → Agent 执行 → 插件史官只记录（Plugin asks, Agent decides, Plugin records）
>
> **当前版本**：v4.0.0（项目上下文层 & 多 Agent 协作体系）

---

## 三层认知架构 + 项目上下文层

v4.0.0 引入**项目上下文层**：位于 OpenClaw 会话层之下的持久化协作层，通过标准化的项目目录结构和文件协议，使多个独立的 Agent 能够在同一项目中共享上下文、协作完成任务。

**双系统平行架构**：
- **Agent 自行行动系统**（文件系统）：Agent 是唯一写入者，通过读写项目文件推进任务
- **史官系统**（插件记录系统）：插件只读取项目文件，将内容归档到系统层 Memory/Log

- **元认知层**：计划（Plan）→ 监控（Deviation）→ 调节（Attribution）
- **工作记忆层**：文件系统上下文管理、任务文件索引、归档
- **人格发展层**：任务完成后分析同化/顺应，更新人格文件
- **项目上下文层**：通过 Hook 注入 skill 提醒，驱动 Agent 建立标准化的项目级协作协议

详细架构设计见 [`docs/reference/`](docs/reference/)。

---

## 安装

### 前置条件

- OpenClaw >= 2026.4.0
- Node.js >= 18

### 步骤

```bash
# 安装插件
openclaw plugins install git:github.com/yangquan0310/agent-self-development

# 启用
openclaw plugins enable agent-self-development

# 重启 Gateway
openclaw gateway restart
```

### 配置

```json
{
  "plugins": {
    "entries": {
      "agent-self-development": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "metacognition": { "enabled": true },
          "workingMemory": { "enabled": true },
          "personality": { "enabled": true }
        }
      }
    }
  }
}
```

---

## 项目结构

```
agent-self-development/
├── src/                    # 插件源码
│   ├── metacognition/      # 元认知模块（计划/监控/调节）
│   ├── working-memory/     # 工作记忆模块（文件系统上下文管理）
│   ├── personality/        # 人格发展模块（同化/顺应）
│   └── common/             # 公共组件（适配器、心跳、流式处理）
├── test/                   # 测试套件
├── skills/                 # 项目级技能（协作协议、技术规范、上下文管理）
├── agents/                 # 多 Agent 角色定义（PM / Developer / Reviewer）
├── docs/
│   ├── roadmap/            # 版本路线图
│   └── reference/          # 技术文档（架构、数据模型、Hook 参考）
└── README.md               # 本文档
```

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| **v4.0.0** | 2026-05-08 | 项目上下文层：文件系统协作协议、Hook 职责对齐修复、事件文件驱动偏差/归因 |
| **v3.6.0** | 2026-05-08 | 多 Agent 协作体系、项目级 skills、文档分层 |
| **v3.5.0** | 2026-05-04 | Hooks 合规重构、Heartbeat、subagent 钩子、task 扁平化 |
| v3.4.0 | 2026-04-29 | 延迟创建 task JSON；Agent 自主评估 |
| v3.3.0 | 2026-04-29 | 统一 task JSON；移除 Cron/Diary；6 维度人格 |

完整版本历史见 [`docs/changelog/`](docs/changelog/)。

---

## 贡献

- **编码规范**：[`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)
- **协作协议**：[`docs/COLLABORATION.md`](docs/COLLABORATION.md)
- **技术文档**：[`docs/reference/`](docs/reference/)

---

*License: MIT*
