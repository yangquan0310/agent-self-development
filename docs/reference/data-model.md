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
    "sessions": [],
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
        "sessionId": "session:CODE:task-family",
        "taskFamily": "CODE",
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

## Deviation 对象

```json
{
  "deviationId": "uuid",
  "runId": "uuid",
  "phaseId": "phase1",
  "status": "detected",
  "detectedAt": "ISO-8601 timestamp",
  "type": "scope_creep|tool_failure|logic_error|user_intervention|other",
  "expected": {
    "description": "预期行为/输出",
    "criteria": "引用的 Plan.successCriteria"
  },
  "actual": {
    "description": "实际行为/输出",
    "evidence": "截图/日志/输出片段"
  },
  "gap": {
    "description": "差距描述",
    "severity": "low|medium|high|critical"
  },
  "acknowledgedAt": "ISO-8601 timestamp|null",
  "resolvedAt": "ISO-8601 timestamp|null",
  "resolution": "解决方式描述|null"
}
```

**Deviation 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | LLM 输出与 Plan 偏离 | `detected` |
| `detected` | Agent 确认偏差 | `acknowledged` |
| `acknowledged` | 执行 Attribution 调节方案 | `resolved` |

---

## Attribution 对象

```json
{
  "attributionId": "uuid",
  "runId": "uuid",
  "deviationId": "uuid",
  "status": "analyzing",
  "createdAt": "ISO-8601 timestamp",
  "rootCause": {
    "category": "planning|execution|tool|skill|knowledge|other",
    "description": "根因分析",
    "evidence": "支持证据"
  },
  "adjustment": {
    "type": "modify_plan|skip_phase|create_session|update_criteria|other",
    "description": "调节方案描述",
    "targetId": "Plan.runId 或 Session.sessionId",
    "changes": {
      "phases": [],
      "artifacts": [],
      "tools": [],
      "skills": []
    }
  },
  "executedAt": "ISO-8601 timestamp|null",
  "result": "执行结果描述|null"
}
```

**Attribution 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | Deviation 已确认 | `analyzing` |
| `analyzing` | 根因分析和调节方案完成 | `completed` |
| `completed` | 调节方案已执行 | `executed` |

---

## Session 对象

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

**Session 状态转换规则**：

| 当前状态 | 触发条件 | 新状态 |
|----------|----------|--------|
| 不存在 | 需要新任务空间 | `pending` |
| `pending` | 开始执行 | `active` |
| `active` | 阶段完成 | `completed` |
| `completed` | agent_end | `idle`（可复用） |
| `active` | 工具报错 | `killed`（销毁） |
| `active` | 主动暂停 | `paused` |
| `paused` | 恢复执行 | `active` |

---

## Event 对象

agent_end 时，Event 类将 task JSON 打包成以下结构存入 Memory：

```json
{
  "runId": "uuid",
  "timestamp": "ISO-8601 timestamp",
  "status": "completed",
  "taskSnapshot": {
    "plan": { "prompt", "context", "workspace", "execution" },
    "sessionIds": ["session:CODE:xxx"],
    "tools": [ { "toolName", "type", "summary" } ]
  },
  "outcome": {
    "archivedAt": "ISO-8601 timestamp",
    "completedSessions": ["session-id-1"],
    "killedSessions": [],
    "toolCount": 5
  }
}
```

**Event 生命周期**：agent_end 时由 Event 类读取 task JSON → 打包成事件 → 写入 Memory EventLog。

**同化 vs 顺应判定**：
- **同化**：原有内容的细化 → 调用子对象的 update 方法
- **顺应**：新结构的出现 → 调用子对象的 create 方法
