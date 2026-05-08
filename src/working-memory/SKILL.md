---
name: working_memory
description: >
  工作记忆模块（参考文档，不再自动注入）。包含 Session 复用策略、任务空间管理规范。
  核心原则：completed 的任务空间标记为 idle 供复用，killed 的任务空间清理释放。
version: 3.6.0
injected_at: reference_only
module: working_memory
---

# Working Memory — 任务空间管理与复用

> 工作记忆模块 - 任务空间生命周期管理
> 在每次运行结束时检查任务空间状态，确保复用策略正确执行
> **completed → idle（可复用），killed → 清理（释放）**

---

## 文档状态

> **v3.5.0 变更**：`agent_end` 已纯观察化，不再注入任何 skill。本文件改为**参考文档**，Agent 在需要管理 Session 时可主动查阅。

插件在 `agent_end` 时已自动完成以下操作（无需 Agent 干预）：

| 时机 | 插件已完成的操作 | 存储位置 |
|------|-----------------|----------|
| 运行结束时 | 遍历本次 task 关联的所有 Session | `task:{runId}.sessionIds`（统一 task JSON） |
| completed Session | 归档到 Memory SQLite（`asd_archives` 表） | `~/.openclaw/memory/{agentId}.sqlite` |
| completed Session | 标记为 `idle`（全局活跃索引） | `state:working_memory:active_sessions` |
| killed Session | 从全局活跃索引移除 | 同上 |
| 清理 | 更新 task.status = 'completed' | `task:{runId}`（统一 task JSON） |

当前运行已结束，插件已完成所有存储层面的清理和归档。

---

## 核心对象（底层存储形态）

### 全局活跃任务空间索引（Global Active Sessions）

**存储位置**：`~/.openclaw/state/agent-self-development/sessions.json`  
**存储键**：`working_memory:active_sessions`

```json
[
  {
    "sessionId": "session:PROJECT:CODE",
    "taskFamily": "CODE",
    "status": "idle",
    "lastActive": "2026-04-29T10:00:00.000Z"
  },
  {
    "sessionId": "session:PROJECT:DESIGN",
    "taskFamily": "DESIGN",
    "status": "active",
    "lastActive": "2026-04-29T12:00:00.000Z"
  }
]
```

| 属性 | 类型 | 说明 | 维护者 |
|------|------|------|--------|
| `sessionId` | string | 任务空间标识（格式：`session:{TYPE}:{任务族}`） | 插件在创建/复用时维护 |
| `taskFamily` | string | 任务族：`CODE` / `RESEARCH` / `ANALYSIS` / `WRITING` / `TEST` / `DESIGN` / `TASK` | 插件通过 `inferTaskFamily()` 推断 |
| `status` | string | `active`（执行中）/ `idle`（空闲可复用）/ `paused`（暂停保留） | **插件自动维护，Agent 负责确认** |
| `lastActive` | string | 最后活跃时间（ISO 8601） | 插件在 session 活动时更新 |

### Session 归档记录

**存储位置**：`~/.openclaw/memory/{agentId}.sqlite`  
**表名**：`asd_archives`

| 字段 | 说明 |
|------|------|
| `id` | 归档记录唯一标识 |
| `type` | 固定为 `"session"` |
| `data` | Session 完整 JSON 数据 |
| `tags` | `[status, taskFamily]` |
| `archived_at` | 归档时间（ISO 8601） |

---

## Agent 职责

### 职责：检查任务空间看板与复用策略

**查阅时机**：制定 Plan 分配 Session 时，或需要了解任务空间管理规范时

**你可以参考的策略**（决策层）：

1. **检查活跃任务空间看板**
   - 全局活跃索引中当前有哪些 Session？
   - 各 Session 的 `status` 和 `lastActive` 是否合理？
   - 是否有长期未活跃的 `active` Session 应该标记为 `idle`？

2. **检查复用策略**
   - 同 `taskFamily` 的 Session 是否已正确复用？
   - 是否存在冗余的 Session（同一任务族多个 idle Session）？
   - 是否需要手动整理或合并某些 Session？

3. **确认归档完整性**
   - 本次运行中 `completed` 的 Session 是否已正确归档到 SQLite？
   - `killed` 的 Session 是否已从全局索引清理？

4. **记录本次运行摘要**（可选）
   - 如有需要，向用户汇报本次任务空间的使用情况

**插件已自动完成的**（执行层，无需你操作）：
- 已通过 `state.saveSession('working_memory:active_sessions', ...)` 更新全局索引
- 已通过 `memory.archiveSession()` 将 completed Session 写入 SQLite `asd_archives` 表
- 已从全局索引移除 killed Session
- 已更新 `task:{runId}` 中的 status、event.outcome、sessionIds

**你可以参考的上下文**（注入时附加在 skill 下方）：
- 本次运行中创建/复用/完成的 Session 列表
- completed / killed 的 Session 数量统计

---

## 决策检查点

运行结束时，请确认：

- [ ] 全局活跃索引中的 `idle` Session 是否可供同任务族后续复用？
- [ ] 是否有 `active` 状态的 Session 实际上已长期未活动（可考虑标记为 `idle`）？
- [ ] `killed` Session 是否已从全局索引移除，避免干扰后续任务？
- [ ] completed Session 的归档记录是否完整（可在 SQLite 中确认）？

---

## 状态流转（由插件维护）

```
Session 生命周期（插件自动管理）：

before_tool_call（sessions_spawn/agent/subagent）
    ↓
创建 Session → status = active
    ├─ 正常完成 → status = completed
    │   ↓ agent_end
    │   归档到 SQLite（asd_archives）
    │   标记为 idle（全局索引）
    │   可供同 taskFamily 复用
    ├─ 工具报错 → status = killed
    │   ↓ agent_end
    │   从全局索引移除
    │   不归档
    └─ 主动暂停 → status = paused
        ↓ agent_end
        保留在全局索引中
```

**复用规则**（插件自动执行）：
- 同一 `taskFamily` 优先复用 `idle` Session
- 不同 `taskFamily` 必须创建独立 Session
- Session 标识格式：`session:{TYPE}:{任务族}`

---

## 与其他 Skill 的关系

| Skill | 注入时机 | 职责边界 |
|-------|---------|---------|
| `planning` | `before_prompt_build` | 在制定 Plan 时为阶段分配任务空间（`sessionId`） |
| `monitoring` | `before_prompt_build`（task=active）| 在执行中检查任务空间是否正常推进 |
| `regulation` | Deviation 创建后 | 在偏差涉及 Session 调整时操作任务空间状态 |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v3.3.0 | 2026-04-29 | 适配统一 task JSON：session 列表从 task.sessionIds 读取；移除 `wm:{runId}:tools` 和 `session_list:{runId}` 引用 |
| v3.0.0 | 2026-04-29 | v3 重构：对象操作移交插件层，skill 变为纯 Agent 指导文档 |
