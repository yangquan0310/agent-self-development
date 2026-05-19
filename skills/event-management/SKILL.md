---
name: event-management
description: >
  Guide Agent to use event.* namespace tools for event file lifecycle management.
  Use this skill when the Agent needs to: (1) generate an event summary report
  after a task is completed, (2) query historical event records,
  (3) archive an event file that is no longer frequently accessed.
  Do not use when creating or updating tasks (use task-management skill instead).
---

# Event Management

Manage event file lifecycle via `event.*` namespace tools.

## 3 Tools

| Tool | Purpose | Trigger |
|------|---------|---------|
| `event.report` | Generate event file | Task completed, need summary from task.json |
| `event.query` | Query events | Review historical deviations/attributions/summaries |
| `event.archive` | Archive event | Event file no longer needed in active directory |

## Core Workflows

### Generate Event Report

```
1. Task status is "completed"
2. Call event.report({ runId })
   - Reads task.json (active → archive fallback)
   - Renders event.md from template
   - Writes to `.agent/events/{YYYY-MM-DD}/{runId}.md`
   - Auto-updates task.json `eventFilePath`
3. Returns { eventFilePath }
```

Requirements:
- `task.status === "completed"` or rejected
- One-time generation, not incremental

### Query Events

```
event.query({ runId?, date?, type? })
```

- `runId`: exact match
- `date`: YYYY-MM-DD format
- `type`: `"deviation"` | `"attribution"` (optional filter)

### Archive Event

```
event.archive({ runId })
```

- Moves event.md to `.agent/events/archive/{date}-{runId}.md`

## Task-Event Collaboration

```
task.create → [execution: task.advance / task.update] → task.completed
  → event.report({ runId }) → [optional] event.archive({ runId })
  → task.archive({ runId })
```

**Timing**: Call `event.report` before `task.archive` so task.json is still in active directory.

## References

- **Detailed workflows**: See [references/workflow.md](references/workflow.md) for event report internals, query patterns, and archive rules
- **Event template**: See [references/template.md](references/template.md) for event.md structure and rendering rules

## Key Rules

- **One-time generation**: event.report renders complete event.md from current task.json state
- **No incremental append**: All data lives in task.json during execution; event.md generated once at completion
- **Auto-association**: event.report automatically writes eventFilePath back to task.json
- **Read-only query**: event.query does not modify any files
