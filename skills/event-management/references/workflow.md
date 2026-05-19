# Event Management Workflows

Detailed guides for event report generation, querying, and archiving.

## Generate Event Report

```
1. Ensure task.status === "completed"
   - If not completed, event.report will reject
2. Call event.report({ runId })
3. Internal process:
   a. Read task.json from `.agent/tasks/{runId}.json`
   b. If not found in active dir, fallback to `.agent/tasks/archive/{runId}.json`
   c. Validate task.status === "completed"
   d. Load event.md template from `src/assets/event.md`
   e. Render markdown with task data:
      - Metadata: runId, status, taskType, createdAt, completedAt
      - Plan: goal, constraints, successCriteria, phases
      - Execution: phase completion status
      - Deviation: all deviation records
      - Attribution: all attribution records
      - Outcome: summary, artifacts, metrics
   f. Determine date from `task.createdAt` → `YYYY-MM-DD`
   g. Write to `.agent/events/{YYYY-MM-DD}/{runId}.md`
   h. Call task.update({ runId, eventFilePath }) to associate
4. Returns { eventFilePath }
```

## Query Events

```
event.query({ runId?, date?, type? })
```

### By runId

```
event.query({ runId: "20260519-abc123" })
→ Returns events matching exact runId
```

### By Date

```
event.query({ date: "2026-05-19" })
→ Returns all events from that date
```

### By Type

```
event.query({ type: "deviation" })
→ Returns events filtered to deviation records
```

### Combined

```
event.query({ runId: "20260519-abc123", type: "attribution" })
→ Returns attribution records for specific task
```

## Archive Event

```
1. Event file exists and no longer frequently accessed
2. Call event.archive({ runId })
3. System:
   a. Locate event.md in `.agent/events/{date}/{runId}.md`
   b. Move to `.agent/events/archive/{date}-{runId}.md`
4. Returns { success, archivePath }
```

## Full Lifecycle Example

```
[Task execution complete]
  → task.update({ runId, status: "completed" })
  → task.update({ runId, outcome: { summary: "...", artifacts: [...] } })
  → event.report({ runId })
      → generates .agent/events/2026-05-19/20260519-abc123.md
      → auto-updates task.json eventFilePath
  → [days later, no longer needed]
  → event.archive({ runId })
      → moves to .agent/events/archive/2026-05-19-20260519-abc123.md
  → task.archive({ runId })
      → moves to .agent/tasks/archive/20260519-abc123.json
```

## File Paths

| Type | Active Path | Archive Path |
|------|-------------|--------------|
| Event | `.agent/events/{YYYY-MM-DD}/{runId}.md` | `.agent/events/archive/{date}-{runId}.md` |
| Task | `.agent/tasks/{runId}.json` | `.agent/tasks/archive/{runId}.json` |
