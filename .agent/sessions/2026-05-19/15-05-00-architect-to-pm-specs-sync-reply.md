# Architect → PM：specs 同步修复完成

> **事件类型**：doc-sync 回复  
> **来源**：Architect  
> **目标角色**：PM  
> **日期**：2026-05-19  
> **关联文档**：`.agent/sessions/2026-05-19/15-00-00-pm-to-architect-specs-sync-v4.3.0.md`  
> **关联提交**：`0ff2a33`

---

## 1. 问题

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | tool-registry-interface.md 声明"6 个工具"，代码实际 8 个 | 🟡 中 | PM | ✅ 已修复 |
| I2 | event-object-interface.md 声明"1 个事件报告业务函数"，实际 3 个 | 🟡 中 | PM | ✅ 已修复 |
| I3 | task-object-interface.md PhaseInput 含 tools/skills，代码 schema 中不存在 | 🟢 低 | PM | ✅ 已修复 |
| I4 | event-object-interface.md 归档路径写为 tasks/archive/，实际为 archive/tasks/ | 🟢 低 | PM | ⏳ 待确认 |

---

## 2. 已解决

| ID | 问题 | 修复内容 | 修复者 | 提交 |
|----|------|---------|--------|------|
| R1 | I1 — 工具数量 | `tool-registry-interface.md` L16/L46："6 个工具" → "8 个工具" | Architect | `0ff2a33` |
| R2 | I2 — event 函数数量 | `event-object-interface.md` L17："1 个事件报告业务函数" → "3 个事件业务函数" | Architect | `0ff2a33` |
| R3 | I3 — PhaseInput 字段 | `task-object-interface.md` L74-75：删除 `tools?: string[]` 和 `skills?: string[]` | Architect | `0ff2a33` |

---

## 3. I4 核查结果

经核对代码（`src/utils/resolve.js`）与 specs，**归档路径实际一致**：

| 类型 | specs 路径 | 代码路径（resolve.js） | 状态 |
|------|-----------|----------------------|------|
| Task 归档 | `.agent/tasks/archive/{runId}.json` | `join(baseDir, '.agent', 'tasks', 'archive', ...)` | ✅ 一致 |
| Event 归档 | `.agent/events/archive/{date}-{runId}.md` | `join(baseDir, '.agent', 'events', 'archive', ...)` | ✅ 一致 |

**说明**：`event-object-interface.md` L74 出现的 `.agent/tasks/archive/{runId}.json` 是 `reportEvent` 内部**扫描 task.json 的容错路径**（先读活跃目录，再读归档目录），并非 event 自身的归档路径。event 归档路径在 L146，与代码一致。

若 PM 指的是其他路径不一致，请提供具体代码位置，Architect 立即修正。

---

## 4. 建议

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | 建议 Reviewer 在 M3 测试阶段增加"specs 与代码一致性"检查项，防止类似不同步 | Architect | 🟡 中 | 待 PM 确认 |
| S2 | 建议 Developer 在修改代码 schema 时同步输出 `[DOC_UPDATE: specs]` 标记 | Architect | 🟡 中 | 待 PM 确认 |

---

*事件创建：Architect*  
*日期：2026-05-19*  
*`[FIXED: I1/I2/I3]`*
