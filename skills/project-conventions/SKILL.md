---
name: project-conventions
description: >
  Coding conventions, hook compliance rules, and data model standards
  for the agent-self-development plugin project.
  Use when: (1) Writing or reviewing JavaScript code for this project,
  (2) Adding new hooks, modules, or skills,
  (3) Refactoring existing hook registration logic,
  (4) Updating SKILL.md frontmatter or data model documentation.
---

# Project Conventions

Apply these standards when writing code for agent-self-development.

## Hook Compliance — Red Lines

**Never** return `prependSystemContext` or `action` from pure observation hooks.

| Hook Type | Hooks | Can Inject | Can Return Action |
|-----------|-------|------------|-------------------|
| Decision/Injection | `before_prompt_build` | Yes | No |
| Decision/Injection | `before_agent_finalize` | No | Yes `{action, reason, retry?}` |
| Decision/Injection | `heartbeat_prompt_contribution` | Yes (`prependContext`) | No |
| Pure Observation | `llm_output` | **No** | **No** |
| Pure Observation | `agent_end` | **No** | **No** |
| Pure Observation | `before_tool_call` / `after_tool_call` | No | No |
| Pure Observation | `subagent_spawning` / `subagent_spawned` / `subagent_ended` | **No** | No |

**Violation fix**: If a skill currently injects at `llm_output` or `agent_end`, refactor it to `before_prompt_build` with a status condition.

## Skill Injection Mapping

Register skills in `src/{module}/module.js` according to this mapping:

| Task Status | Skill to Inject at `before_prompt_build` |
|-------------|------------------------------------------|
| No task | `planning` (assessment phase) |
| `draft` | `planning` (planning phase) |
| `pending_approval` | `planning` (reporting/handling feedback) |
| `revising` | `planning` + revision context |
| `active` | `monitoring` + execution context |
| `completed` | `development` (personality review) |

**Keep frontmatter aligned**: The `injected_at` field in every SKILL.md must match the actual hook registration in code. After changing hook registration, update the skill's frontmatter and its "Related Skills" cross-reference table.

## Naming Conventions

| Element | Rule | Example |
|---------|------|---------|
| Class name | Single noun, PascalCase | `Metacognition`, `WorkingMemory` |
| Method name | Verb prefix, camelCase | `createPlan()`, `onBeforePromptBuild()` |
| File name | Lowercase, match class | `module.js`, `plan.js` |
| Module entry | Always `module.js` | `metacognition/module.js` |
| Skill name | snake_case in frontmatter | `planning`, `monitoring` |

## Module Structure

Every new business module must follow this exact structure:

```javascript
export class ModuleName {
  constructor({ api, config, state, skills, logger, log, ...deps }) {
    // Dependency injection
  }

  register() {
    // Register all hooks here
  }

  // Unified cleanup interface (v3.5.0+)
  stop() {
    // Release resources when Gateway stops
  }
}
```

## Error Handling

- Wrap adapter methods in try-catch. Log failures but do not block the flow.
- Protect hook handlers so internal errors do not crash OpenClaw.
- Close database connections in `gateway_stop` or `stop()`.

## Data Model

### Task JSON (v3.5.0+)

Use flat top-level fields. Never nest under `event`.

```json
{
  "runId": "uuid",
  "status": "draft | pending_approval | active | revising | completed",
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000,
  "plan": { "prompt", "context", "workspace", "execution" },
  "deviations": [],
  "attributions": [],
  "outcome": {},
  "sessionIds": [],
  "tools": []
}
```

### Status Markers

Agent outputs these markers at the end of responses. `before_agent_finalize` parses them:

```
[STATUS: pending_approval]
[STATUS: active]
[STATUS: revising] [REASON: xxx]
[STATUS: completed]
```

## Development Principles

- **Minimal changes**: Only modify what is necessary. Do not refactor unrelated code.
- **Backward compatibility**: Adapters must fall back to file system when `api === null`.
- **Defensive programming**: Wrap optional hooks in try-catch or flag checks — they may not exist.
- **Logging**: Use `[Module] message` prefix. Levels: `logger.debug/info/warn/error`.
- **Version comments**: Add `// v3.x.y: description` for significant changes.

## State Keys

| Key | Domain | Type | Lifecycle | Storage |
|-----|--------|------|-----------|---------|
| `task:{runId}` | State | Task JSON | runId | `state/tasks/{runId}.json` |
| `session:{sessionId}` | State | Session | Long-term | `state/sessions.json` |
| `working_memory:active_sessions` | State | Session[] | Global | `state/sessions.json` |
| `prompt:${runId}` | State | String | runId | Cached by `before_prompt_build` |

## File Map

| Path | Responsibility | Change Frequency |
|------|---------------|------------------|
| `src/index.js` | Plugin entry, dependency injection | Low |
| `src/metacognition/module.js` | Hook registration and dispatch | Medium |
| `src/metacognition/plan.js` | Plan business logic | Low |
| `src/metacognition/deviation.js` | Deviation business logic | Low |
| `src/metacognition/attribution.js` | Attribution business logic | Low |
| `src/working-memory/module.js` | Session lifecycle hooks | Medium |
| `src/working-memory/session.js` | Session business logic | Low |
| `src/personality/module.js` | Personality hook registration | Medium |
| `src/common/heartbeat.js` | Background monitoring | Low |
| `src/common/adapters/*.js` | Adapter layer | Low |

## External References

For detailed technical documentation beyond this skill, see:

- `../../docs/reference/data-model.md` — complete JSON schemas and state transition rules for all data objects
- `../../docs/reference/hook-reference.md` — full hook type matrix and injection mapping by task status
- `../../docs/reference/state-keys.md` — complete `ctx.state` key space reference
- `../../docs/reference/object-model.md` — adapter layer, manager layer, and module class design

