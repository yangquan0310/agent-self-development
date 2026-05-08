# agent-self-development

OpenClaw 插件 — Agent 自我发展框架

> **核心原则**：用户领航 → Agent 执行 → 插件书记员只记录（Plugin asks, Agent decides, Plugin records）
>
> **当前版本**：v3.5.0（Hooks 合规重构）

---

## 三层认知架构

```
┌─────────────────────────────────────────┐
│           元认知层 (Metacognition)         │
│  计划 → 监控 → 调节                      │
├─────────────────────────────────────────┤
│           工作记忆层 (Working Memory)      │
│  Session = 情景缓冲器                    │
├─────────────────────────────────────────┤
│           人格发展层 (Personality)       │
│  同化/顺应 → 人格文件更新                │
└─────────────────────────────────────────┘
```

- **元认知层**：计划（Plan）→ 监控（Deviation）→ 调节（Attribution）
- **工作记忆层**：Session 管理、任务空间复用、归档
- **人格发展层**：任务完成后分析同化/顺应，更新人格文件

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
│   ├── working-memory/     # 工作记忆模块（Session 管理）
│   ├── personality/        # 人格发展模块（同化/顺应）
│   └── common/             # 公共组件（适配器、心跳、流式处理）
├── test/                   # 测试套件（31 tests）
├── skills/                 # 项目级技能（协作协议、技术规范、上下文管理）
├── agents/                 # 多 Agent 角色定义（PM / Developer / Reviewer）
├── docs/
│   ├── roadmap/            # 版本路线图
│   └── technical/          # 技术文档（架构、数据模型、Hook 参考）
└── README.md               # 本文档
```

---

## 版本历史

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| **v3.5.0** | 2026-05-04 | Hooks 合规重构：`llm_output`/`agent_end` 纯观察；`before_prompt_build` 按状态分发 skill；Heartbeat 监控；`subagent_*` 原生钩子 |
| v3.4.0 | 2026-04-29 | 延迟创建 task JSON；Agent 评估 + 用户确认后才创建 task |
| v3.3.0 | 2026-04-29 | 统一 task JSON；移除 Cron/Diary；6 维度人格扩展 |

完整版本历史见 [`docs/changelog/`](docs/changelog/)。

| 版本 | 日期 | 变更摘要 |
|------|------|----------|
| **v3.6.0** | 2026-05-08 | 多 Agent 协作体系、项目级 skills、文档分层 |
| **v3.5.0** | 2026-05-04 | Hooks 合规重构、Heartbeat、subagent 钩子、task 扁平化 |
| v3.4.0 | 2026-04-29 | 延迟创建 task JSON；Agent 自主评估 |
| v3.3.0 | 2026-04-29 | 统一 task JSON；移除 Cron/Diary；6 维度人格 |

---

## 贡献

- **编码规范**：[`skills/project-conventions/SKILL.md`](skills/project-conventions/SKILL.md)
- **协作协议**：[`skills/collaboration-protocol/SKILL.md`](skills/collaboration-protocol/SKILL.md)
- **技术文档**：[`docs/reference/`](docs/reference/)

---

*License: MIT*
