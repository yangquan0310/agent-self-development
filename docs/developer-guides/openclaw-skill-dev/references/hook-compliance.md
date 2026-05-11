# Hook Compliance Reference

Complete hook type matrix for OpenClaw v3.5.0+.

## Hook Type Matrix

| Type | Hook | Can Return `prependSystemContext` | Can Return `action` | Notes |
|------|------|-----------------------------------|---------------------|-------|
| Decision/Injection | `before_prompt_build` | Yes | — | Primary skill injection hook |
| Decision/Injection | `before_agent_finalize` | — | Yes `{action, reason, retry?}` | Used for status marker parsing |
| Decision/Injection | `heartbeat_prompt_contribution` | Yes (`prependContext`) | — | Background monitoring |
| Pure Observation | `llm_output` | **No** | **No** | Cache output only |
| Pure Observation | `agent_end` | **No** | **No** | Log and archive only |
| Pure Observation | `before_tool_call` | — | — | Track tool invocations |
| Pure Observation | `after_tool_call` | — | — | Track tool results |
| Pure Observation | `subagent_spawning` | **No** | — | Track subagent creation |
| Pure Observation | `subagent_spawned` | **No** | — | Track subagent creation |
| Pure Observation | `subagent_ended` | **No** | — | Track subagent completion |

## Red Lines

**Never** do the following:

1. **Return `prependSystemContext` from `llm_output` or `agent_end`**
   - If a skill needs to inject at the end of a run, refactor to use `before_prompt_build` on the next cycle
   - If a skill needs to inject after LLM output, use `before_prompt_build` with status conditions

2. **Return `action` from any pure observation hook**
   - `llm_output` and `agent_end` must not influence agent flow decisions
   - Flow control belongs in `before_agent_finalize`

3. **Register skill injection on `before_tool_call` or `after_tool_call`**
   - These hooks exist only for tracking and logging
   - Skill injection must go through `before_prompt_build`

## Skill Injection Mapping by Task Status

| Task Status | Skill Injected at `before_prompt_build` |
|-------------|----------------------------------------|
| No task | `planning` (assessment phase) |
| `draft` | `planning` (planning phase) |
| `pending_approval` | `planning` (reporting/feedback) |
| `revising` | `planning` + revision reason |
| `active` | `monitoring` + execution context |
| `completed` | `development` (personality review) + `project_doc` (project docs) |

## Status Marker Format

Agent outputs status markers in its response. `before_agent_finalize` parses these:

```
[STATUS: pending_approval]
[STATUS: active]
[STATUS: revising] [REASON: xxx]
[STATUS: completed]
```

Additional markers (v4.0.0+):
```
[DOC_UPDATE: README]
[DOC_UPDATE: SKILL]
[DOC_SKIP]
```

Plugin responsibility: parse markers → update task status → save via `state.saveTask()`.
Agent responsibility: output correct markers at the end of each response.
