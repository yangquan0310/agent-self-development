# 设计哲学：钩子加工具，暴露工具加适时提醒

> **版本**：v3.0.0
> **日期**：2026-05-22
> **来源**：v4.5.0 架构决策（PM 杨权确认）

---

## 核心哲学

**一句话概括**：

> 插件暴露工具能力，在关键业务时机适时提醒，Agent 自主决策。

v4.5.0 的设计哲学：**暴露工具** + **适时提醒**。

---

## 两个核心机制

### 1. 暴露工具（Tool Exposure）

| 维度 | v4.3.0 | v4.5.0 |
|------|---------|---------|
| 工具暴露 | 8 个命名空间工具 | 8 个命名空间工具（保持） |
| Agent 选择 | 完全自主调用 | 完全自主调用（保持） |
| 通信模式 | Agent ↔ 插件（双向交互） | Agent ↔ 插件（双向交互，保持） |

**核心**：插件通过 `api.registerTool()` 暴露 8 个命名空间工具，Agent 按需调用，完全自主。

**代码体现**：
- `task.create` / `task.update` / `task.advance` / `task.get` / `task.archive`
- `event.report` / `event.query` / `event.archive`

---

### 2. 适时提醒（Conditional Hook Injection）

| 维度 | v4.3.0 | v4.5.0 |
|------|---------|---------|
| Hook 注入 | **无**（完全移除） | **条件触发**（精准时机） |
| 触发时机 | - | task.create / task.update含deviation / event.report / 无任务执行 |
| 频率 | - | 仅关键节点，不打扰正常执行 |

**核心**：通过 `after_tool_call` 监听关键工具返回值，在业务关键节点条件触发提醒。

**问题**：v4.3.0 完全移除 Hook 后，Agent 在关键业务时机（任务创建/偏差记录/事件生成）缺乏自动提醒机制。

**解决**：v4.5.0 引入条件触发 Hook，只在关键节点提醒，不打扰正常执行。

**代码体现**：
```javascript
after_tool_call hook
    ↓
解析 event.toolName + event.result
    ↓
条件匹配
    ├── task.create → 'reg:task-created'
    ├── task.update(含deviation) → 'reg:deviation-detected'
    └── event.report → 'reg:event-generated'
    ↓
enqueueNextTurnInjection(perIdempotencyKey)
```

---

## 注入时机矩阵

| # | 触发时机 | 监听工具 | 条件 | 注入内容 | IdempotencyKey |
|---|----------|----------|------|----------|----------------|
| M1 | 任务创建后 | `task.create` | 返回成功 | 制定计划 → 拆解 TODO | `reg:task-created` |
| M2 | 偏差记录后 | `task.update` | 检测到 deviation | 偏差分析 → 归因分析 | `reg:deviation-detected` |
| M3 | 事件生成后 | `event.report` | 返回成功 | 六维度平衡性判断 | `reg:event-generated` |
| M4 | 无任务执行时 | `before_prompt_build` | 检测无 active task | 创建任务提醒 | `reg:no-active-task` |

---

## 架构体现

```
┌─────────────────────────────────────────────────┐
│ Agent 层（自主决策）                              │
│ · 自行读取 SKILL.md、TODO.md                     │
│ · 按需调用 Tool                                  │
│ · 直接读写项目文件（可选）                        │
├─────────────────────────────────────────────────┤
│ Tool 层（8 个命名空间工具）                       │
│ task.create / task.update / task.advance         │
│ task.get / task.archive                         │
│ event.report / event.query / event.archive      │
│ → 纯函数 handler，无类、无状态                   │
├─────────────────────────────────────────────────┤
│ Hook 层（条件触发）                              │
│ after_tool_call: 监听关键工具返回值               │
│ before_prompt_build: 仅无任务时触发              │
│ → 精准时机，不打扰正常执行                       │
├─────────────────────────────────────────────────┤
│ 文件系统（项目级持久化）                          │
│ .agentstasks/{runId}.json                       │
│ .agentsevents/{date}/{runId}.md                 │
└─────────────────────────────────────────────────┘
```

---

## 与 OpenClaw 生态的对齐

飞书官方插件的设计哲学：

> **"插件暴露能力，Agent 自主决策"**

v4.5.0 完全对齐：

- ✅ **暴露工具**：`api.registerTool()` 注册 8 个命名空间工具
- ✅ **适时提醒**：条件触发 Hook，不打扰正常执行
- ✅ **Agent 自主**：Hook 只提醒，决策权在 Agent

---

## 哲学在代码中的体现

| 哲学原则 | 代码表现 |
|----------|----------|
| 暴露工具 | 8 个命名空间工具有明确的 parameters schema |
| 适时提醒 | `after_tool_call` 条件触发 + idempotencyKey 去重 |
| Agent 自主 | Hook 只提醒，Agent 可选择忽略或执行 |
| 精准时机 | 仅关键节点触发（M1-M4），正常执行不打扰 |
| 扁平架构 | 无类、无依赖注入、三层清晰 |

---

## 理论基础的支撑

| 设计哲学 | 理论基础 |
|----------|----------|
| 适时提醒 | **工作自我理论**：执行控制系统需要在关键时机触发 |
| 条件触发 | **皮亚杰动态平衡**：失衡信号触发发展机制 |
| Agent 自主 | **自传体记忆**：以"我"为索引，Agent 自主决定需要什么经验 |

详见：`docs/reference/theory.md` 和 `docs/reference/ch01-piaget-development-algorithm.md`

---

## 一句话总结

> **v4.5.0 的设计哲学是：暴露工具能力，在关键时机适时提醒，把决策权留给 Agent。**
>
> 从纯 Tool 到 Tool + Hook，从被动响应到精准触发 —— 工具是能力，提醒是契机，决策在 Agent。

---

*文档版本：v3.0.0*
*更新日期：2026-05-22*
*决策者：PM（产品经理）*
