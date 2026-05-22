# 扁平工具架构（v4.5.0）

> **设计哲学**：钩子加工具，暴露工具加适时提醒。详见 [`ch03-design-philosophy.md`](ch03-design-philosophy.md)。
>
> **架构决策**：Agent / Tool / Hook / 文件系统 四层架构，纯函数 + 条件触发 Hook。

---

## 核心架构

```
┌─────────────────────────────────────────────────┐
│ Agent 层（自主决策）                              │
│ · 接收用户任务，制定 Plan                          │
│ · 按需调用 Tools                                  │
│ · 直接读写项目文件（可选）                         │
└─────────────────────────────────────────────────┘
              ↓ 显式 Tool 调用
┌─────────────────────────────────────────────────┐
│ Tool 层（8 个命名空间工具）                        │
│ · task.create / task.update / task.advance       │
│ · task.get / task.archive                        │
│ · event.report / event.query / event.archive     │
│ · 纯函数 handler，无类、无状态、无隐式行为        │
└─────────────────────────────────────────────────┘
              ↓ 条件 Hook 触发
┌─────────────────────────────────────────────────┐
│ Hook 层（条件触发）                               │
│ · after_tool_call: 监听关键工具返回值             │
│ · before_prompt_build: 仅无任务时触发            │
│ · 精准时机，idempotencyKey 去重                  │
└─────────────────────────────────────────────────┘
              ↓ 直接文件 IO
┌─────────────────────────────────────────────────┐
│ 文件系统（项目级持久化）                          │
│ · .agentstasks/{runId}.json                     │
│ · .agentsevents/{YYYY-MM-DD}/{runId}.md         │
│ · .agentstasks/archive/ + .agentsevents/archive/ │
└─────────────────────────────────────────────────┘
```

---

## v4.5.0 核心变更

### 从纯 Tool 到 Tool + Hook

| 维度 | v4.3.0 | v4.5.0 |
|------|---------|---------|
| 工具暴露 | 8 个命名空间工具 | 8 个命名空间工具（保持） |
| Hook 注入 | **无** | **条件触发** |
| 触发机制 | - | after_tool_call + before_prompt_build |
| 注入频率 | - | 仅关键节点，不打扰正常执行 |

### 注入时机矩阵

| # | 触发时机 | 监听工具 | 条件 | 注入内容 |
|---|----------|----------|------|----------|
| M1 | 任务创建后 | `task.create` | 返回成功 | 制定计划提醒 |
| M2 | 偏差记录后 | `task.update` | deviation 字段 | 偏差分析提醒 |
| M3 | 事件生成后 | `event.report` | 返回成功 | 六维度平衡性判断 |
| M4 | 无任务执行时 | `before_prompt_build` | 无 active task | 创建任务提醒 |

---

## 四层职责

### Agent 层

- ✅ 接收用户任务，制定 Plan
- ✅ 判断何时调用 Tool（创建、更新、推进、归档）
- ✅ 直接读写项目文件（如 SKILL.md、TODO.md）
- ✅ 接收 Hook 提醒，自主决策是否执行
- ❌ 不依赖插件做业务决策

### Tool 层

- ✅ 通过 `api.registerTool()` 暴露 8 个命名空间工具
- ✅ 接收 Agent 显式调用，执行原子文件操作
- ✅ 返回结构化结果 `{ success, data }` 或 `{ error }`
- ❌ 不主动注入任何内容
- ❌ 不做业务决策
- ❌ 不维护运行时状态

### Hook 层

- ✅ `after_tool_call`: 监听关键工具返回值，条件触发提醒
- ✅ `before_prompt_build`: 仅在无 active task 时触发
- ✅ 使用 idempotencyKey 避免重复注入
- ❌ 不替 Agent 做决策
- ❌ 不打扰正常执行流程

### 文件系统层

- ✅ `.agentstasks/{runId}.json` — 任务状态持久化
- ✅ `.agentsevents/{YYYY-MM-DD}/{runId}.md` — 事件归档
- ✅ `.agentstasks/archive/` + `.agentsevents/archive/` — 归档子目录
- ❌ 不做业务逻辑
- ❌ 不替 Agent 或插件决策

---

## 数据流向

```
Agent 调用 task.create({ prompt })
    └→ handlers.create() ──→ objects/task.create()
        └→ io.writeJson('.agentstasks/{runId}.json', taskJSON)
            └→ after_tool_call 触发 → M1 提醒

Agent 调用 task.update({ runId, deviation })
    └→ handlers.update() ──→ objects/task.update()
        └→ io.readJson() → 合并更新 → io.writeJson()
            └→ after_tool_call 触发 → M2 提醒

Agent 调用 event.report({ runId })
    └→ handlers.report() ──→ objects/event.report()
        ├─→ 读取 task.json
        ├─→ 渲染 event.md
        ├─→ io.writeMarkdown('.agentsevents/{date}/{runId}.md')
        └→ after_tool_call 触发 → M3 提醒
```

---

## 文件系统映射

| 存储类型 | 路径 | 格式 | 写入者 | 读取者 |
|----------|------|------|--------|--------|
| 活跃任务 | `.agentstasks/{runId}.json` | JSON | Tool handler | Agent + Tool |
| 归档任务 | `.agentstasks/archive/{runId}.json` | JSON | Tool handler | Agent + Tool |
| 事件文件 | `.agentsevents/{YYYY-MM-DD}/{runId}.md` | Markdown | Tool handler | Agent + Tool |
| 归档事件 | `.agentsevents/archive/{date}-{runId}.md` | Markdown | Tool handler | Agent + Tool |
| 任务模板 | `src/assets/task.json` | JSON | — | Tool handler |
| 事件模板 | `src/assets/event.md` | Markdown | — | Tool handler |

---

## 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **对象层** | `src/objects/task.js` | 5 个 task 裸函数：create/update/advance/get/archive |
| **对象层** | `src/objects/event.js` | 3 个 event 裸函数：report/query/archive |
| **工具层** | `src/tools/index.js` | 注册 8 个 tools 到 OpenClaw |
| **工具层** | `src/tools/schemas.js` | 8 个 tool 的 parameters schema |
| **工具层** | `src/tools/handlers.js` | 薄适配层：调用 objects 函数，包装返回值 |
| **Hook 层** | `src/hooks/condition.js` | 条件判断逻辑：M1-M4 触发匹配 |
| **基础设施** | `src/utils/io.js` | 原子文件操作：ensureDir, readJson, writeJson, writeMarkdown |
| **基础设施** | `src/utils/resolve.js` | 路径解析器：taskPath, archiveTaskPath, eventPath |
| **基础设施** | `src/utils/validate.js` | runId / status / 状态转换校验 |
| **基础设施** | `src/utils/helpers.js` | 生成器：getNow, generateRunId, generatePlan |
| **入口** | `src/index.js` | 插件入口：调用 registerTools(api, context) + registerHooks(api, context) |

---

*文档版本：v4.5.0*
*最后更新：2026-05-22*
*维护者：Developer*
