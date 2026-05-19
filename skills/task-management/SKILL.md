---
name: task-management
description: >
  Guide Agent to use task.* namespace tools for full task lifecycle management.
  Use this skill when the Agent needs to: (1) create a new task from user requirements,
  (2) update task status or record deviations/attributions/outcomes,
  (3) advance to the next phase of a multi-phase task,
  (4) query task status or history,
  (5) archive a completed task.
  Do not use when only reading project files or when the task involves event reporting
  (use event-management skill instead).
---

# Task Management

Manage task full lifecycle via `task.*` namespace tools.

## 5 Tools

| Tool | Purpose | Trigger |
|------|---------|---------|
| `task.create` | Create draft task | New requirement received, need a plan |
| `task.update` | Universal update entry | Status change, deviation, attribution, outcome, eventFilePath |
| `task.advance` | Advance phase | Current phase completed |
| `task.get` | Query task | Need to check progress or history |
| `task.archive` | Archive task | Task completed, clean up active directory |

## Core Workflows

### Create Task

```
task.create({
  prompt: "user requirement",
  taskType?: "task | coding | research | documentation",
  planInput?: { goal, constraints, successCriteria, phases }
})
```

- `runId` auto-generated if omitted
- Returns task JSON; show plan to user for confirmation

### Advance Phase

```
task.advance({ runId, phaseId? })
```

- Check `isComplete` in response:
  - `true` → task done, proceed to outcome recording + event report + archive
  - `false` → continue next phase

### Record Deviation (via task.update)

```
task.update({
  runId,
  deviation: { type, description, impact? }
})
```

Types: `scope_creep`, `technical_debt`, `output_mismatch`, `doc_lag`, `context_loss`, `file_mismatch`, `other`

### Record Attribution (via task.update)

```
task.update({
  runId,
  attribution: { rootCause, strategy, impact? }
})
```

### Record Outcome (via task.update)

```
task.update({
  runId,
  outcome: { summary, artifacts?, metrics? }
})
```

### Status Transitions

```
draft → pending_approval → active → completed
              ↑_____________|
                    ↓ revising → draft
```

All status changes via `task.update({ status })`.

## References

- **Detailed workflows**: See [references/workflow.md](references/workflow.md) for step-by-step guides with full parameter examples
- **Data schema**: See [references/schema.md](references/schema.md) for complete Task JSON field reference

## Key Rules

- **task.update is the only update entry** — all changes (status/deviation/attribution/outcome/eventFilePath) go through it
- **Do not read/write task.json directly** — all operations via tool calls
- **Archive is irreversible** — task.json moves to `.agent/tasks/archive/`
- **task.get supports dual-path fallback** — checks active dir first, then archive dir
