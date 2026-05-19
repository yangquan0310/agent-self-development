# Task JSON Schema Reference

Complete field reference for `.agent/tasks/{runId}.json`.

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `runId` | string | Yes | Unique task ID (format: `{YYYYMMDD}-{suffix}`) |
| `status` | string | Yes | `draft` / `pending_approval` / `active` / `revising` / `completed` |
| `taskType` | string | No | `task` / `coding` / `research` / `documentation` (default: `"task"`) |
| `createdAt` | string (ISO-8601) | Yes | Creation timestamp |
| `updatedAt` | string (ISO-8601) | Yes | Last update timestamp |
| `plan` | object | Yes | Plan structure |
| `deviations` | array | No | Deviation records |
| `attributions` | array | No | Attribution records |
| `outcome` | object | No | Task outcome |
| `eventFilePath` | string | No | Associated event file path (auto-written by event.report) |

## Plan Object

```json
{
  "prompt": "user input (truncated to 500 chars)",
  "context": {
    "goal": "task goal",
    "constraints": ["constraint1"],
    "successCriteria": ["criterion1"]
  },
  "execution": {
    "phases": [
      {
        "id": "p1",
        "name": "phase name",
        "goal": "phase goal",
        "outputs": ["file1.md"],
        "status": "pending | in_progress | completed"
      }
    ],
    "currentPhase": 0
  }
}
```

## Deviation Entry

```json
{
  "id": "dev-{timestamp}",
  "type": "scope_creep | technical_debt | output_mismatch | doc_lag | context_loss | file_mismatch | other",
  "description": "deviation description",
  "impact": "impact assessment (optional)",
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

## Attribution Entry

```json
{
  "id": "attr-{timestamp}",
  "rootCause": "root cause",
  "strategy": "improvement strategy",
  "impact": "scope of impact (optional)",
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

## Outcome Object

```json
{
  "summary": "completion summary",
  "artifacts": ["output/file1.md"],
  "metrics": { "phasesCompleted": 3 }
}
```

## Removed Fields (v4.3.0)

| Field | Removal Reason |
|-------|---------------|
| `sessionIds` | Session module removed |
| `tools` | Tool call history managed by Agent |
| `revisionReason` | Free-text in deviation/attribution instead |

## File Paths

| Type | Active Path | Archive Path |
|------|-------------|--------------|
| Task | `.agent/tasks/{runId}.json` | `.agent/tasks/archive/{runId}.json` |
