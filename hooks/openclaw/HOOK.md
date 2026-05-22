---
name: agent-self-development
description: "Agent self-development plugin hooks: task lifecycle, self-regulation, and event reporting"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events":
          [
            "session:start",
            "session:compact:after",
            "before_prompt_build",
          ],
      },
  }
---

# Agent Self-Development Hook

> **版本**：v4.5.0  
> **Managed by**：agent-self-development 插件  
> **Actual handlers**：运行在插件内部 `src/index.js`，通过 `api.on()` 注册

---

## 事件列表

| 事件 | 触发时机 | 功能 |
|------|----------|------|
| `session:start` | 会话启动（仅 compaction 恢复时） | 注入自我调节提醒 |
| `session:compact:after` | 压缩合并完成后 | 注入自我调节提醒 |
| `before_prompt_build` | 每次 prompt 构建前 | 注入自我调节提醒 |

---

## 注入内容

Hook 注入以下提醒文本，触发 Agent 执行自我调节流程：

### 自我调节 → 技能固化流程

**第一步：平衡判断**  
读取 event.md，执行六维度平衡性分析

**第二步：决策**  
- **同化**（技能存在但不平衡）：修改/细化现有技能
- **顺应**（技能不存在）：创建新技能条目

**第三步：程序性记忆**  
借鉴 self-improving-agent 机制

**第四步：执行同化/顺应**  
- **同化**：找到对应技能文件，修改/细化内容
- **顺应**：在 skills/ 下创建新的 SKILL.md

---

## 自我调节六维度

| 维度 | 对应文件 | 不平衡信号 |
|------|----------|------------|
| 自我认知 | SOUL.md | 发现新能力边界或盲区 |
| 风格 | SOUL.md | 某种风格效率低或效果好 |
| 信念 | SOUL.md | 结果与原有信念冲突或验证 |
| 身份 | IDENTITY.md | 承担超出当前身份的职责 |
| 程序性记忆 | MEMORY.md | 归因揭示新的因果模式 |
| 技能 | skills/ | 获得新技能或发现不足 |

---

*本 Hook 由 agent-self-development 插件管理*
