# Task Management Workflows

Detailed step-by-step guides for each task operation.

## Create Task

```
1. Evaluate task complexity → decide if a Plan is needed
2. Call task.create({
     prompt: "user original input",
     taskType?: "task" | "coding" | "research" | "documentation",
     planInput?: {
       goal: "task goal",
       constraints?: ["constraint1", "constraint2"],
       successCriteria?: ["criterion1", "criterion2"],
       phases?: [
         { id: "p1", name: "phase name", goal: "phase goal", outputs?: ["file1.md"] }
       ]
     }
   })
3. Receive returned task JSON
4. Present plan to user for confirmation
```

- `runId` auto-generated (`{YYYYMMDD}-{suffix}`) if omitted
- If `planInput` provided, use directly; otherwise infer from `prompt`
- `taskType` defaults to `"task"`

## Update Status

```
task.update({ runId, status: "new_status", reason?: "optional reason" })
```

| Current | New | How |
|---------|-----|-----|
| draft | pending_approval | `task.update({ status: "pending_approval" })` |
| pending_approval | active | `task.update({ status: "active" })` |
| pending_approval | revising | `task.update({ status: "revising" })` → modify plan → `task.update({ status: "draft" })` |
| active | completed | `task.advance()` returns `isComplete: true`, or `task.update({ status: "completed" })` |
| revising | draft | `task.update({ status: "draft" })` |

## Record Deviation

```
1. Identify deviation (scope creep, technical debt, output mismatch, etc.)
2. Call task.update({
     runId,
     deviation: {
       type: "scope_creep | technical_debt | output_mismatch | doc_lag | context_loss | file_mismatch | other",
       description: "deviation description",
       impact?: "impact assessment (optional)"
     }
   })
3. Deviation appended to task.json `deviations[]`
```

## Record Attribution

```
1. Analyze root cause of deviation
2. Call task.update({
     runId,
     attribution: {
       rootCause: "root cause",
       strategy: "improvement strategy",
       impact?: "scope of impact (optional)"
     }
   })
3. Attribution appended to task.json `attributions[]`
```

## Record Outcome

```
1. Task fully completed
2. Call task.update({
     runId,
     outcome: {
       summary: "completion summary",
       artifacts?: ["output/file1.md", "output/file2.js"],
       metrics?: { phasesCompleted: 3, deviationsCount: 1 }
     }
   })
```

## Advance Phase

```
1. Complete current phase work
2. Call task.advance({ runId, phaseId?: "specific_phase_id" })
3. Check response:
   - isComplete: true → all phases done, proceed to outcome + event.report + archive
   - isComplete: false → continue to next phase
```

## Query Task

```
1. Call task.get({ runId })
2. System checks:
   - First: `.agent/tasks/{runId}.json`
   - Fallback: `.agent/tasks/archive/{runId}.json`
3. Returns full task.json or error if not found
```

## Archive Task

```
1. Task status is "completed"
2. Call task.archive({ runId })
3. task.json moved to `.agent/tasks/archive/{runId}.json`
```

## Combined Workflow Example

```
User: "Build a REST API"
  → task.create({ prompt: "Build a REST API", taskType: "coding" })
  → status: draft
  → task.update({ status: "pending_approval" })
  → [user approves]
  → task.update({ status: "active" })
  → [work phase 1]
  → task.advance({ runId })
  → [work phase 2]
  → task.advance({ runId }) → isComplete: true
  → task.update({ outcome: { summary: "API built", artifacts: ["src/api.js"] } })
  → event.report({ runId })  [see event-management skill]
  → task.archive({ runId })
```
