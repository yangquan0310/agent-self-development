# 数据模型（v4.3.0）

> **版本**：v4.3.0
> **更新**：移除 `sessionIds` / `tools` / `revisionReason` 字段；状态转换改用 `task.update` 统一入口；事件文件改为延迟一次性生成

---

## 1. Task 对象（task.json）

**存储位置**：`.agent/tasks/{runId}.json`

```json
{
  "runId": "20260519-abc123",
  "status": "draft",
  "taskType": "task",
  "createdAt": "2026-05-19T10:00:00.000Z",
  "updatedAt": "2026-05-19T10:00:00.000Z",
  "plan": {
    "prompt": "用户原始输入（截断500字）",
    "context": {
      "goal": "任务目标",
      "constraints": ["约束条件"],
      "successCriteria": ["成功标准"]
    },
    "execution": {
      "phases": [
        {
          "id": "phase1",
          "name": "子任务名称",
          "goal": "子任务目标",
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
  "eventFilePath": ""
}
```

### 1.1 状态转换规则

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | Agent 调用 `task.create({ prompt })` | `draft` |
| `draft` | Agent 调用 `task.update({ status: "pending_approval" })` | `pending_approval` |
| `pending_approval` | 用户确认 → `task.update({ status: "active" })` | `active` |
| `pending_approval` | 用户要求修改 → `task.update({ status: "revising" })` | `revising` → 回到 `draft` |
| `pending_approval` | 用户取消 → `task.update({ status: "completed" })` | `completed` |
| `active` | 阶段正常推进 → `task.advance({ runId })` | `active`（currentPhase++） |
| `active` | 所有 phases 完成 → `task.advance()` 返回 `isComplete=true` | `completed` |
| `active` | 重大偏差需重规划 → `task.update({ status: "revising" })` | `revising` → 回到 `draft` |
| `completed` | Agent 调用 `task.archive({ runId })` | 移动到 `.agent/tasks/archive/` |

### 1.2 Tool 调用后的状态变更示例

**示例 1：task.create → draft**

```javascript
// Agent 调用
const result = await tools['task.create']({
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
  "runId": "20260519-xxx",
  "status": "draft",
  "createdAt": "2026-05-19T10:00:00.000Z",
  "updatedAt": "2026-05-19T10:00:00.000Z",
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
  "outcome": {}
}
```

**示例 2：task.update → 更新状态**

```javascript
// Agent 调用
const result = await tools['task.update']({
  runId: '20260519-xxx',
  status: 'active',
  reason: '用户确认'
});

// Task JSON 变化
{
  "runId": "20260519-xxx",
  "status": "active",          // ← 变更
  "updatedAt": "2026-05-19T10:05:00.000Z"  // ← 更新
}
```

**示例 3：task.advance → 推进阶段**

```javascript
// Agent 调用
const result = await tools['task.advance']({ runId: '20260519-xxx' });
// result: { success: true, data: { previousPhase: 0, nextPhase: 1, isComplete: false }}

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
  "updatedAt": "2026-05-19T10:10:00.000Z"
}
```

**示例 4：task.update → 记录偏差**

```javascript
// Agent 调用
const result = await tools['task.update']({
  runId: '20260519-xxx',
  deviation: {
    type: 'scope_creep',
    description: '用户要求增加认证模块',
    impact: '延期1天'
  }
});

// Task JSON 变化
{
  "deviations": [
    {
      "id": "dev-20260519-xxx",
      "type": "scope_creep",
      "description": "用户要求增加认证模块",
      "impact": "延期1天",
      "timestamp": "2026-05-19T10:15:00.000Z"
    }
  ],
  "updatedAt": "2026-05-19T10:15:00.000Z"
}
```

**示例 5：task.update → 记录归因**

```javascript
// Agent 调用
const result = await tools['task.update']({
  runId: '20260519-xxx',
  attribution: {
    rootCause: '需求评审不充分',
    impact: '返工',
    strategy: '增加需求评审环节'
  }
});

// Task JSON 变化
{
  "attributions": [
    {
      "id": "attr-20260519-xxx",
      "rootCause": "需求评审不充分",
      "impact": "返工",
      "strategy": "增加需求评审环节",
      "timestamp": "2026-05-19T10:20:00.000Z"
    }
  ],
  "updatedAt": "2026-05-19T10:20:00.000Z"
}
```

**示例 6：task.update → 记录结果**

```javascript
// Agent 调用
const result = await tools['task.update']({
  runId: '20260519-xxx',
  outcome: {
    summary: '完成 API 设计',
    artifacts: ['openapi.yaml', 'docs/api.md'],
    metrics: { phasesCompleted: 2 }
  }
});
```

---

## 2. Deviation 对象（偏差记录）

偏差通过 `task.update({ deviation })` 写入 `task.json` 的 `deviations` 数组。

**偏差类型规范**：

| 类型 | 定义 | 典型场景 |
|------|------|----------|
| `output_mismatch` | 实际输出与 Plan 预期不符 | 代码未按设计实现、文档遗漏关键章节 |
| `doc_lag` | 文档/代码不同步 | 代码已改但 README/SKILL.md 未更新 |
| `context_loss` | 文件系统上下文丢失 | Agent 未读取历史文件、重复劳动、遗漏前置文件 |
| `file_mismatch` | 文件路径或内容错误 | 写入错误路径、覆盖他人文件、文件格式不符规范 |
| `scope_creep` | 范围蔓延 | 用户临时增加需求、任务边界扩大 |
| `technical_debt` | 技术债务 | 临时方案未记录、代码质量下降 |
| `other` | 其他未分类偏差 | 外部依赖问题、环境变化 |

**Deviation 字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 自动生成，格式 `dev-{timestamp}` |
| `type` | string | ✅ | 偏差类型 |
| `description` | string | ✅ | 偏差描述 |
| `impact` | string | — | 影响评估 |
| `timestamp` | string | ✅ | ISO-8601 时间戳 |

---

## 3. Attribution 对象（归因记录）

归因通过 `task.update({ attribution })` 写入 `task.json` 的 `attributions` 数组。

**Attribution 字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 自动生成，格式 `attr-{timestamp}` |
| `rootCause` | string | ✅ | 根本原因 |
| `strategy` | string | ✅ | 改进策略 |
| `impact` | string | — | 影响范围 |
| `timestamp` | string | ✅ | ISO-8601 时间戳 |

> **v4.3.0 简化**：偏差与归因之间不再强制维护 `attributed` / `attributionId` 关联。Agent 通过 `deviationIds` 数组在归因中引用相关偏差（如需要）。

---

## 4. Outcome 对象（任务结果）

通过 `task.update({ outcome })` 写入。

```json
{
  "summary": "任务完成摘要",
  "artifacts": ["产出文件路径1", "产出文件路径2"],
  "metrics": {
    "phasesCompleted": 3,
    "deviationsCount": 1
  }
}
```

---

## 5. 事件文件（event.md）

**存储位置**：`.agent/events/{YYYY-MM-DD}/{runId}.md`

**生成时机**：任务完成后，Agent 调用 `event.report({ runId })` **一次性生成**。

**生成流程**：
1. `event.report` 读取对应 `task.json`（活跃或归档）
2. 使用 `src/assets/event.md` 模板渲染 Markdown
3. 写入 `.agent/events/{date}/{runId}.md`
4. `handlers.report` 自动调用 `task.update` 回写 `eventFilePath`

**事件文件包含内容**（由模板决定）：
1. **元信息（Metadata）**：runId、status、createdAt、completedAt
2. **计划（Plan）**：目标、约束、成功标准、阶段化执行
3. **执行（Execution）**：各阶段实际完成状态
4. **偏差（Deviation）**：偏差记录汇总
5. **归因（Attribution）**：归因记录汇总
6. **结果（Outcome）**：最终结果摘要

> **v4.3.0 变更**：事件文件不再增量追加。所有数据来自 task.json 的当前状态，一次性渲染。这避免了执行期间的频繁 IO 和并发问题。

---

## 6. 归档模型

**任务归档**：
- 源文件：`.agent/tasks/{runId}.json`
- 目标文件：`.agent/tasks/archive/{runId}.json`
- 触发：`task.archive({ runId })`

**事件归档**：
- 源文件：`.agent/events/{date}/{runId}.md`
- 目标文件：`.agent/events/archive/{date}-{runId}.md`
- 触发：`event.archive({ runId })`

**查询回退**：
- `task.get({ runId })` 先在 `.agent/tasks/` 查找，找不到则回退到 `.agent/tasks/archive/`

---

## 7. Task JSON 字段完整规范（v4.3.0）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `runId` | string | ✅ | 任务运行 ID |
| `status` | string | ✅ | `draft` / `pending_approval` / `active` / `revising` / `completed` |
| `taskType` | string | — | `task` / `coding` / `research` / `documentation`，默认 `task` |
| `createdAt` | string | ✅ | 创建时间戳（ISO-8601） |
| `updatedAt` | string | ✅ | 最后更新时间戳（ISO-8601） |
| `plan` | object | ✅ | Plan 对象（prompt / context / execution） |
| `deviations` | array | — | 偏差记录数组 |
| `attributions` | array | — | 归因记录数组 |
| `outcome` | object | — | 任务结果 |
| `eventFilePath` | string | — | 关联事件文件路径（由 `event.report` 自动回写） |

### v4.3.0 移除字段

| 字段 | 移除原因 |
|------|---------|
| `sessionIds` | Session 模块已移除，Agent 直接管理上下文 |
| `tools` | Tool 调用历史由 Agent 自行记录，不写入 task.json |
| `revisionReason` | 修订原因由 Agent 在偏差/归因中自由描述，不再强制字段 |

---

## 8. 状态机与工具映射

```
不存在 ──task.create──→ draft
  │
  ▼
draft ──task.update(status: pending_approval)──→ pending_approval
  │                                              │
  │                                              ├─task.update(status: active)──→ active
  │                                              │                           │
  │                                              │                           ├─task.advance()──→ active (currentPhase++)
  │                                              │                           │               │
  │                                              │                           │               └─isComplete?──→ completed
  │                                              │                           │
  │                                              │                           └─task.update(deviation)──→ (记录偏差)
  │                                              │
  │                                              ├─task.update(status: revising)──→ revising ──→ draft
  │                                              │
  │                                              └─task.update(status: completed)──→ completed
  │                                                                                  │
  │                                                                                  ├─event.report()──→ 生成 event.md
  │                                                                                  │
  │                                                                                  └─task.archive()──→ 归档
```

---

*文档版本：v4.3.0*
*最后更新：2026-05-19*
*维护者：Developer*
