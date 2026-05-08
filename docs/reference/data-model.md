# 数据模型

## Plan 对象

```json
{
  "runId": "uuid",
  "prompt": "用户原始输入",
  "status": "draft",
  "context": {
    "goal": "任务目标",
    "constraints": ["约束条件"],
    "successCriteria": ["成功标准：创建/修改哪些文档"]
  },
  "workspace": {
    "artifacts": ["预期产出文档"],
    "tools": ["所用工具"],
    "skills": ["所用技能"]
  },
  "execution": {
    "phases": [
      {
        "id": "phase1",
        "name": "子任务名称",
        "goal": "子任务目标",
        "tools": ["所需工具"],
        "skills": ["所需技能"],
        "outputs": ["产出文档"],
        "status": "pending"
      }
    ],
    "currentPhase": 0
  }
}
```

**Plan 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | 收到复杂任务 | `draft` |
| `draft` | Agent 制定完成并汇报 | `pending_approval` |
| `pending_approval` | 用户确认 | `active` |
| `pending_approval` | 用户要求修改 | `pending_approval`（重新汇报） |
| `pending_approval` | 用户取消 | `completed` |
| `active` | 阶段正常推进 | `active`（currentPhase++） |
| `active` | 所有 phases 完成 | `completed` |
| `active` | 重大偏差需重规划 | `revising` → 回到 `pending_approval` |
| `completed` | `agent_end` | 归档到 Memory |

---

## Deviation 对象（v4.0.0 偏差类型统一）

v4.0.0 中偏差记录已迁移到**事件文件**（`.openclaw/events/{YYYY-MM-DD}/{HH-MM-SS}.md`）的「偏差」章节。
系统级 `task.deviations` 字段保留但不再作为主要存储（向后兼容）。

**偏差类型规范（v4.0.0 统一）**：

| 类型 | 定义 | 典型场景 |
|------|------|----------|
| `output_mismatch` | 实际输出与 Plan 预期不符 | 代码未按设计实现、文档遗漏关键章节 |
| `doc_lag` | 文档/代码不同步 | 代码已改但 README/SKILL.md 未更新 |
| `context_loss` | 文件系统上下文丢失 | Agent 未读取历史文件、重复劳动、遗漏前置文件 |
| `file_mismatch` | 文件路径或内容错误 | 写入错误路径、覆盖他人文件、文件格式不符规范 |
| `other` | 其他未分类偏差 | 用户临时变更需求、外部依赖问题 |

---

## Attribution 对象

v4.0.0 中归因记录已迁移到**事件文件**的「归因」章节。
系统级 `task.attributions` 字段保留但不再作为主要存储（向后兼容）。

---

## 项目级 Task 索引（v4.0.0 新增）

**存储位置**：`.openclaw/tasks/{runId}.json`

```json
{
  "runId": "uuid",
  "status": "active",
  "agentId": "main",
  "role": "primary",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "files": [
    {"path": "manuscripts/plan.md", "agentId": "main", "role": "primary", "type": "draft"},
    {"path": "src/index.js", "agentId": "coder", "role": "subagent", "type": "artifact"}
  ]
}
```

| 字段 | 说明 |
|------|------|
| `agentId` / `role` | 负责该任务的主 Agent ID 及其角色（primary/subagent） |
| `files[].agentId` / `files[].role` | 产出该文件的 Agent 信息 |
| `files[].type` | `draft`（草稿）或 `artifact`（定稿） |

**索引文件**：`.openclaw/tasks/INDEX.md` 按日期分组列出所有任务摘要。

---

## 事件文件（v4.0.0 新增）

**存储位置**：`.openclaw/events/{YYYY-MM-DD}/{HH-MM-SS}.md`

事件文件包含 7 个必选部分：
1. **元信息（Metadata）**：runId、agentId、role、createdAt
2. **计划（Plan）**：执行计划、验收标准、预估时间
3. **执行（Execution）**：实际完成的工作、产出文件
4. **变更记录（ChangeLog）**：`- {HH:MM} {agent-id} {write|edit} {filePath} — {摘要}`
5. **偏差（Deviation）**：发现的偏差（类型、描述、影响范围）
6. **归因（Attribution）**：根本原因、影响评估、策略更新
7. **结果（Outcome）**：最终状态（完成/修正/放弃）

---

## Event 对象（系统级，[占位符]）

agent_end 时，插件将项目级事件文件和 task 索引归档到系统层 Memory：

```json
{
  "runId": "uuid",
  "timestamp": "ISO-8601 timestamp",
  "status": "completed",
  "eventContent": "事件文件内容摘要（限制 5000 字符）",
  "projectTaskIndex": { "files": [...] },
  "outcome": {
    "archivedAt": "ISO-8601 timestamp",
    "toolCount": 5
  }
}
```

**Event 生命周期**：
1. Agent 在任务期间写入项目级事件文件（`.openclaw/events/...`）
2. agent_end 时插件读取项目级事件文件和 task 索引
3. 插件将内容归档到系统层 Memory SQLite（`asd_eventlogs` 表）
4. 历史查询功能为 [占位符]，待后续按需实现

---

## Session 对象（[占位符]）

v4.0.0 中 Session 追踪保留但不再维护全局活跃索引。文件系统上下文替代 Session 内存复用。

```json
{
  "sessionId": "session:CODE:task-family",
  "taskFamily": "CODE",
  "status": "pending",
  "createdAt": "ISO-8601 timestamp",
  "activatedAt": "ISO-8601 timestamp|null",
  "completedAt": "ISO-8601 timestamp|null",
  "runIds": ["uuid"],
  "artifacts": ["产出文档路径"],
  "tools": ["使用过的工具"],
  "context": {
    "lastGoal": "最后执行的目标",
    "lastOutputs": ["最后产出"]
  }
}
```

---

## 同化 vs 顺应判定

- **同化**：原有内容的细化 → 调用子对象的 update 方法
- **顺应**：新结构的出现 → 调用子对象的 create 方法
