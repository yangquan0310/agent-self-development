# Task JSON 数据结构参考

`.agentstasks/{runId}.json` 的完整字段说明。

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `runId` | string | 是 | 任务唯一标识（格式：`{YYYYMMDD}-{后缀}`） |
| `status` | string | 是 | `draft` / `pending_approval` / `active` / `revising` / `completed` |
| `taskType` | string | 否 | `task` / `coding` / `research` / `documentation`（默认 `"task"`） |
| `createdAt` | string (ISO-8601) | 是 | 创建时间戳 |
| `updatedAt` | string (ISO-8601) | 是 | 最后更新时间戳 |
| `plan` | object | 是 | 计划结构 |
| `deviations` | array | 否 | 偏差记录数组 |
| `attributions` | array | 否 | 归因记录数组 |
| `outcome` | object | 否 | 任务结果 |
| `eventFilePath` | string | 否 | 关联事件文件路径（由 event.report 自动回写） |

## Plan 对象

```json
{
  "prompt": "用户输入（截断至 500 字符）",
  "context": {
    "goal": "任务目标",
    "constraints": ["约束条件1"],
    "successCriteria": ["验收标准1"]
  },
  "execution": {
    "phases": [
      {
        "id": "p1",
        "name": "阶段名称",
        "goal": "阶段目标",
        "outputs": ["文件1.md"],
        "status": "pending | in_progress | completed"
      }
    ],
    "currentPhase": 0
  }
}
```

## 偏差条目

```json
{
  "id": "dev-{时间戳}",
  "type": "scope_creep | technical_debt | output_mismatch | doc_lag | context_loss | file_mismatch | other",
  "description": "偏差描述",
  "impact": "影响评估（可选）",
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

## 归因条目

```json
{
  "id": "attr-{时间戳}",
  "rootCause": "根本原因",
  "strategy": "改进策略",
  "impact": "影响范围（可选）",
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

## 结果对象

```json
{
  "summary": "完成摘要",
  "artifacts": ["产出/文件1.md"],
  "metrics": { "phasesCompleted": 3 }
}
```

## 已移除字段（v4.3.0）

| 字段 | 移除原因 |
|------|---------|
| `sessionIds` | Session 模块已移除 |
| `tools` | 工具调用历史由 Agent 自行管理 |
| `revisionReason` | 由偏差/归因中的自由文本替代 |

## 文件路径

| 类型 | 活跃路径 | 归档路径 |
|------|---------|---------|
| 任务 | `.agentstasks/{runId}.json` | `.agentstasks/archive/{runId}.json` |
