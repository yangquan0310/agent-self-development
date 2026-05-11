# 数据模型（v4.1.0）

> **版本**：v4.1.0
> **更新**：新增 Tool 调用后的状态变更示例、Task JSON 工具字段说明

---

## 1. Plan 对象

```json
{
  "runId": "uuid",
  "prompt": "用户原始输入",
  "status": "draft",
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000,
  "plan": {
    "prompt": "用户原始输入（截断500字）",
    "createdAt": 1234567890000,
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
  },
  "deviations": [],
  "attributions": [],
  "outcome": {},
  "sessionIds": [],
  "tools": [],
  "revisionReason": ""
}
```

**Plan 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | Agent 调用 `create_plan()` | `draft` |
| `draft` | Agent 调用 `update_task_status("pending_approval")` | `pending_approval` |
| `pending_approval` | 用户确认 → Agent 调用 `update_task_status("active")` | `active` |
| `pending_approval` | 用户要求修改 → Agent 调用 `update_task_status("revising")` | `revising` → 回到 `draft` |
| `pending_approval` | 用户取消 → Agent 调用 `update_task_status("completed")` | `completed` |
| `active` | 阶段正常推进 → Agent 调用 `advance_phase()` | `active`（currentPhase++） |
| `active` | 所有 phases 完成 → `advance_phase()` 返回 `isComplete=true` | `completed` |
| `active` | 重大偏差需重规划 → Agent 调用 `update_task_status("revising")` | `revising` → 回到 `draft` |
| `completed` | `agent_end` 或 Agent 调用 `archive_task()` | 归档到 Memory |

### 1.1 Tool 调用后的状态变更示例

**示例 1：create_plan → draft**

```javascript
// Agent 调用
const result = await tools.create_plan({
  runId: 'task-001',
  prompt: '帮我设计一个 API',
  planInput: {
    goal: '设计 REST API',
    phases: [
      { id: 'p1', name: '需求分析', goal: '明确接口需求', outputs: ['openapi.yaml'] }
    ]
  }
});

// Task JSON 变化
{
  "runId": "task-001",
  "status": "draft",
  "createdAt": 1715404800000,
  "updatedAt": 1715404800000,
  "plan": {
    "prompt": "帮我设计一个 API",
    "context": { "goal": "设计 REST API", "constraints": [], "successCriteria": [] },
    "execution": {
      "phases": [{ "id": "p1", "name": "需求分析", "goal": "明确接口需求", "outputs": ["openapi.yaml"], "status": "pending" }],
      "currentPhase": 0
    }
  },
  "deviations": [],
  "attributions": [],
  "tools": ["create_plan"]
}
```

**示例 2：update_task_status → active**

```javascript
// Agent 调用
const result = await tools.update_task_status({
  runId: 'task-001',
  status: 'active',
  reason: '用户确认'
});

// Task JSON 变化
{
  "runId": "task-001",
  "status": "active",        // ← 变更
  "updatedAt": 1715404900000, // ← 更新
  "revisionReason": "用户确认", // ← 新增
  "tools": ["create_plan", "update_task_status"]
}
```

**示例 3：advance_phase → 推进阶段**

```javascript
// Agent 调用
const result = await tools.advance_phase({ runId: 'task-001' });
// result: { success: true, previousPhase: 0, nextPhase: 1, isComplete: false }

// Task JSON 变化
{
  "plan": {
    "execution": {
      "phases": [
        { "id": "p1", "name": "需求分析", "status": "completed" }, // ← 变更
        { "id": "p2", "name": "接口实现", "status": "pending" }
      ],
      "currentPhase": 1 // ← 变更
    }
  },
  "updatedAt": 1715405000000,
  "tools": ["create_plan", "update_task_status", "advance_phase"]
}
```

**示例 4：record_deviation → 记录偏差**

```javascript
// Agent 调用
const result = await tools.record_deviation({
  runId: 'task-001',
  type: 'scope_creep',
  description: '用户要求增加认证模块',
  impact: '延期1天'
});

// Task JSON 变化
{
  "deviations": [
    {
      "id": "dev-1715405100000",
      "type": "scope_creep",
      "description": "用户要求增加认证模块",
      "impact": "延期1天",
      "timestamp": 1715405100000,
      "attributed": false
    }
  ],
  "updatedAt": 1715405100000,
  "tools": ["create_plan", "update_task_status", "advance_phase", "record_deviation"]
}
```

**示例 5：record_attribution → 记录归因**

```javascript
// Agent 调用
const result = await tools.record_attribution({
  runId: 'task-001',
  rootCause: '需求评审不充分',
  impact: '返工',
  strategy: '增加需求评审环节'
});

// Task JSON 变化
{
  "attributions": [
    {
      "id": "attr-1715405200000",
      "rootCause": "需求评审不充分",
      "impact": "返工",
      "strategy": "增加需求评审环节",
      "timestamp": 1715405200000
    }
  ],
  "deviations": [
    {
      "id": "dev-1715405100000",
      "type": "scope_creep",
      "attributed": true,        // ← 变更
      "attributionId": "attr-1715405200000" // ← 新增
    }
  ],
  "updatedAt": 1715405200000
}
```

---

## 2. Deviation 对象（v4.0.0 偏差类型统一）

v4.0.0 中偏差记录已迁移到**事件文件**（`.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md`）的「偏差」章节。
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

## 3. Attribution 对象

v4.0.0 中归因记录已迁移到**事件文件**的「归因」章节。
系统级 `task.attributions` 字段保留但不再作为主要存储（向后兼容）。

---

## 4. 项目级 Task 索引（v4.0.0 新增）

**存储位置**：`.agent/tasks/{runId}.json`

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

**索引文件**：`.agent/tasks/INDEX.md` 按日期分组列出所有任务摘要。

---

## 5. 事件文件（v4.0.0 新增）

**存储位置**：`.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md`

事件文件包含 7 个必选部分：
1. **元信息（Metadata）**：runId、agentId、role、createdAt
2. **计划（Plan）**：执行计划、验收标准、预估时间
3. **执行（Execution）**：实际完成的工作、产出文件
4. **变更记录（ChangeLog）**：`- {HH:MM} {agent-id} {write|edit} {filePath} — {摘要}`
5. **偏差（Deviation）**：发现的偏差（类型、描述、影响范围）
6. **归因（Attribution）**：根本原因、影响评估、策略更新
7. **结果（Outcome）**：最终状态（完成/修正/放弃）

**Tool 调用后的事件文件追加**：
- `record_deviation()` → 追加到「偏差」章节
- `record_attribution()` → 追加到「归因」章节

---

## 6. Event 对象（系统级）

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
1. Agent 在任务期间写入项目级事件文件（`.agent/events/...`）
2. agent_end 时插件读取项目级事件文件和 task 索引
3. 插件将内容归档到系统层 Memory SQLite（`asd_eventlogs` 表）
4. 历史查询功能为 [占位符]，待后续按需实现

---

## 7. Session 对象

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

## 8. 同化 vs 顺应判定

- **同化**：原有内容的细化 → 调用子对象的 update 方法
- **顺应**：新结构的出现 → 调用子对象的 create 方法

---

## 9. Task JSON 字段完整规范（v4.1.0）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `runId` | string | ✅ | 任务运行 ID |
| `status` | string | ✅ | `draft` / `pending_approval` / `active` / `revising` / `completed` |
| `createdAt` | number | ✅ | 创建时间戳 |
| `updatedAt` | number | ✅ | 最后更新时间戳 |
| `plan` | object | ✅ | Plan 对象（prompt / context / workspace / execution） |
| `deviations` | array | — | 偏差记录数组 |
| `attributions` | array | — | 归因记录数组 |
| `outcome` | object | — | 最终结果 |
| `sessionIds` | array | — | 关联的 session ID 列表 |
| `tools` | array | — | 本次任务使用过的 tool 名称列表（v4.1.0 新增） |
| `revisionReason` | string | — | 修订原因（v4.1.0 新增） |
| `eventFilePath` | string | — | 关联的事件文件路径 |

---

*文档版本：v4.1.0*
*最后更新：2026-05-11*
*维护者：Developer*
