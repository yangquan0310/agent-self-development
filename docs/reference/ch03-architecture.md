# 扁平工具架构（v4.3.0）

> **设计哲学**：插件做"能力的提供者"，不做"决策的替代者"。详见 [`design-philosophy.md`](design-philosophy.md)。
>
> **架构决策**：ADR-014 移除所有类和 Hook 注入，采用纯函数 + 直接 IO 的扁平架构。

```
┌─────────────────────────────────────────────┐
│             Agent 层（自主决策）              │
│  · 接收用户任务，制定 Plan                    │
│  · 按需调用 Tools 推进状态                    │
│  · 直接读写项目文件（可选）                   │
└─────────────────────────────────────────────┘
              ↓ 显式 Tool 调用
┌─────────────────────────────────────────────┐
│              Tool 层（8 个 Tools）            │
│  · task.create / task.update / task.advance  │
│  · task.get / task.archive                   │
│  · event.report / event.query / event.archive│
│  · 纯函数 handler，无类、无状态、无 Hook      │
└─────────────────────────────────────────────┘
              ↓ 直接文件 IO
┌─────────────────────────────────────────────┐
│           文件系统（项目级持久化）              │
│  · .agentstasks/{runId}.json                 │
│  · .agentsevents/{YYYY-MM-DD}/{runId}.md     │
│  · .agentstasks/archive/{runId}.json         │
│  · .agentsevents/archive/{date}-{runId}.md   │
└─────────────────────────────────────────────┘
```

## v4.3.0 核心变更

### 从 Hook 驱动到 Tool 驱动

| 维度 | v4.2.0 及以前 | v4.3.0 |
|------|--------------|--------|
| 能力暴露 | `api.on()` Hook 注入 + `api.registerTool()` | **仅** `api.registerTool()` |
| 架构风格 | 四层架构（用户/代理/插件/系统）+ 类层次 | **扁平三层**（Agent/Tool/文件系统） |
| 状态管理 | 适配器类 + 管理器类 + 模块类 | **裸函数直接读写 JSON** |
| 业务模块 | Metacognition / WorkingMemory / Personality | **全部移除** |
| 代码组织 | `src/metacognition/`, `src/working-memory/`, `src/personality/`, `src/common/adapters/` | `src/objects/`, `src/tools/`, `src/utils/` |

### 从面向对象到纯函数

v4.3.0 移除了所有类和依赖注入：

- ❌ `TaskObject`、`EventObject` 类 → ✅ `src/objects/task.js` 裸函数
- ❌ `State` / `Memory` / `Flow` 适配器 → ✅ `src/utils/io.js` 原子文件操作
- ❌ `ToolRegistry` / `ToolHandler` 类 → ✅ `src/tools/index.js` 纯注册 + `src/tools/handlers.js` 薄适配层
- ❌ `HookRegistry` / `before_prompt_build` → ✅ **无 Hook，无注入**

## 三层职责

### Agent 层

- ✅ 接收用户任务，制定 Plan
- ✅ 判断何时调用 Tool（创建、更新、推进、归档）
- ✅ 直接读写项目文件（如 SKILL.md、TODO.md）
- ❌ 不依赖插件做业务决策

### Tool 层

- ✅ 通过 `api.registerTool()` 暴露 8 个命名空间工具
- ✅ 接收 Agent 显式调用，执行原子文件操作
- ✅ 返回结构化结果 `{ success, data }` 或 `{ error }`
- ❌ 不主动注入任何内容
- ❌ 不做业务决策
- ❌ 不维护运行时状态

### 文件系统层

- ✅ `.agentstasks/{runId}.json` — 任务状态持久化
- ✅ `.agentsevents/{YYYY-MM-DD}/{runId}.md` — 事件归档（延迟生成）
- ✅ `.agentstasks/archive/` + `.agentsevents/archive/` — 归档子目录
- ❌ 不做业务逻辑
- ❌ 不替 Agent 或插件决策

## 数据流向

```
Agent 调用 task.create({ prompt })
    └→ handlers.create() ──→ objects/task.create()
        └→ io.writeJson('.agentstasks/{runId}.json', taskJSON)

Agent 调用 task.update({ runId, status, deviation })
    └→ handlers.update() ──→ objects/task.update()
        └→ io.readJson() → 合并更新 → io.writeJson()

Agent 调用 event.report({ runId })
    └→ handlers.report() ──→ objects/event.report()
        ├─→ 读取 task.json
        ├─→ 渲染 templates/event.md
        ├─→ io.writeMarkdown('.agentsevents/{date}/{runId}.md')
        └─→ 自动回写 task.json eventFilePath（通过 task.update）
```

## 文件系统映射

| 存储类型 | 路径 | 格式 | 写入者 | 读取者 |
|----------|------|------|--------|--------|
| 活跃任务 | `.agentstasks/{runId}.json` | JSON | Tool handler | Agent + Tool |
| 归档任务 | `.agentstasks/archive/{runId}.json` | JSON | Tool handler | Agent + Tool |
| 事件文件 | `.agentsevents/{YYYY-MM-DD}/{runId}.md` | Markdown | Tool handler | Agent + Tool |
| 归档事件 | `.agentsevents/archive/{date}-{runId}.md` | Markdown | Tool handler | Agent + Tool |
| 任务模板 | `src/assets/task.json` | JSON | — | Tool handler |
| 事件模板 | `src/assets/event.md` | Markdown | — | Tool handler |

> **事件生成策略（v4.3.0）**：事件文件不增量追加，而是在任务完成后由 `event.report` **一次性生成**。这避免了执行期间频繁写事件文件的开销，也简化了并发控制。

## 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **对象层** | `src/objects/task.js` | 5 个 task 裸函数：create/update/advance/get/archive |
| **对象层** | `src/objects/event.js` | 3 个 event 裸函数：report/query/archive |
| **工具层** | `src/tools/index.js` | 注册 8 个 tools 到 OpenClaw |
| **工具层** | `src/tools/schemas.js` | 8 个 tool 的 parameters schema |
| **工具层** | `src/tools/handlers.js` | 薄适配层：调用 objects 函数，包装返回值 |
| **工具层** | `src/tools/return-adapter.js` | 统一返回格式 `adaptReturn` / `adaptError` |
| **基础设施** | `src/utils/io.js` | 原子文件操作：ensureDir, readJson, writeJson, writeMarkdown |
| **基础设施** | `src/utils/resolve.js` | 路径解析器：taskPath, archiveTaskPath, eventPath |
| **基础设施** | `src/utils/validate.js` | runId / status / 状态转换校验 |
| **基础设施** | `src/utils/helpers.js` | 生成器：getNow, generateRunId, generatePlan |
| **入口** | `src/index.js` | 插件入口：调用 registerTools(api, context) |

---

*文档版本：v4.3.0*
*最后更新：2026-05-19*
*维护者：Developer*
