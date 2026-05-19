# 状态存储键空间（v4.3.0）

> **版本**：v4.3.0
> **更新**：移除系统级键（State/Memory/Flow/Log/Hook），仅保留项目级文件系统映射

v4.3.0 是纯粹的 **Tool Plugin**，无 Hook、无系统层 SQLite、无 `ctx.state` 注入。所有数据持久化通过项目级文件系统完成。

---

## 项目级文件（Agent + Tool 共享）

| 文件/目录 | 路径 | 格式 | 写入者 | 读取者 | 说明 |
|-----------|------|------|--------|--------|------|
| 活跃任务 | `.agent/tasks/{runId}.json` | JSON | Tool handler | Agent + Tool | 任务完整状态，包含 plan/deviations/attributions/outcome |
| 归档任务 | `.agent/tasks/archive/{runId}.json` | JSON | Tool handler | Agent + Tool | `task.archive()` 后移动至此 |
| 事件文件 | `.agent/events/{YYYY-MM-DD}/{runId}.md` | Markdown | Tool handler | Agent + Tool | `event.report()` 一次性生成 |
| 归档事件 | `.agent/events/archive/{date}-{runId}.md` | Markdown | Tool handler | Agent + Tool | `event.archive()` 后移动至此 |
| 文件锁 | `.agent/locks/{文件路径替换-为-}.json` | JSON | Agent | Agent + Tool | 并发控制，Agent 编辑前创建、编辑后删除 |
| 决策存档 | `.agent/decisions/{YYYYMMDD-HHMM}-标题.md` | Markdown | Agent | Agent + Tool | 重要决策记录 |

### 任务文件（task.json）键空间

| 字段 | 类型 | 生命周期 | 说明 |
|------|------|----------|------|
| `runId` | string | 永久 | 任务唯一标识 |
| `status` | string | 任务周期 | `draft` → `pending_approval` → `active` → `completed` / `revising` |
| `taskType` | string | 任务周期 | `task` / `coding` / `research` / `documentation` |
| `createdAt` | string (ISO) | 永久 | 创建时间 |
| `updatedAt` | string (ISO) | 任务周期 | 最后更新时间 |
| `plan` | object | 任务周期 | prompt / context / execution（phases + currentPhase） |
| `plan.prompt` | string | 任务周期 | 用户原始输入（截断500字） |
| `plan.context` | object | 任务周期 | goal / constraints / successCriteria |
| `plan.execution` | object | 任务周期 | phases[] / currentPhase |
| `deviations` | array | 任务周期 | 偏差记录列表 |
| `attributions` | array | 任务周期 | 归因记录列表 |
| `outcome` | object | 任务周期 | summary / artifacts / metrics |
| `eventFilePath` | string | 永久 | 关联事件文件路径（`event.report` 自动回写） |

### 事件文件（event.md）结构

事件文件由模板 `src/assets/event.md` 渲染生成，包含以下章节：

1. **Metadata**：runId、status、taskType、createdAt、completedAt
2. **Plan**：goal、constraints、successCriteria、phases
3. **Execution**：各 phase 实际完成状态
4. **Deviation**：偏差记录汇总
5. **Attribution**：归因记录汇总
6. **Outcome**：最终结果摘要

---

## 项目根目录文件

| 文件 | 职责 | 维护者 |
|------|------|--------|
| `README.md` | 项目总览（人类视角） | Agent / 用户 |
| `metadata.json` | 机器可读架构 | Agent |
| `SKILL.md` | 项目级操作手册 | Agent |
| `TODO.md` | 进度看板 | Agent / 用户 |
| `.agentignore` | Agent 可见性控制 | 用户 |

---

## 已移除的系统级键（v4.3.0）

v4.3.0 扁平化重构后，以下系统级存储不再存在：

| 键/存储 | v4.2.x 用途 | v4.3.0 状态 |
|---------|------------|------------|
| `task:{runId}`（State 插件） | 系统级 task JSON 存储 | **已移除**，数据直接存 `.agent/tasks/{runId}.json` |
| `session:{sessionId}`（State 插件） | Session 生命周期管理 | **已移除**，Session 模块整体删除 |
| `eventlog:{YYYY-MM-DD}`（Memory） | 按日聚合事件日志 | **已移除**，事件直接存 `.agent/events/` |
| `logs:{YYYY-MM-DD}`（Log） | 按日累积日志 | **已移除**，无系统级日志 |
| `prompt:${runId}`（State） | before_prompt_build prompt 缓存 | **已移除**，无 Hook 注入 |
| `flow:{flowId}`（Flow） | Flow 工作流实例 | **已移除**，Flow 模块整体删除 |
| `~/.agent/state/agent-self-development/` | 插件专属 State 目录 | **已移除** |
| `~/.agent/memory/{agentId}.sqlite` | 记忆归档 SQLite | **已移除** |
| `~/.agent/logs/{agentId}.log` | 代理独立日志 | **已移除** |
| `~/.agent/hooks/agent-self-development/` | Hook 声明文件 | **已移除**，无 Hook |

---

## 命名规则

### 文件路径命名

- 任务文件：`tasks/{runId}.json`
- 事件文件：`events/{YYYY-MM-DD}/{runId}.md`
- 归档任务：`tasks/archive/{runId}.json`
- 归档事件：`events/archive/{date}-{runId}.md`

### runId 生成规则

由 `helpers.generateRunId()` 生成，格式：`{YYYYMMDD}-{随机后缀}`，确保项目内唯一。

### 时间戳格式

所有时间戳使用 **ISO-8601** 字符串格式（如 `2026-05-19T10:00:00.000Z`），不再使用 Unix 毫秒时间戳。

---

*文档版本：v4.3.0*
*最后更新：2026-05-19*
*维护者：Developer*
