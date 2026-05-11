# OpenClaw SKILL.md Template

Use this as the starting point for new OpenClaw plugin skills.

---

## Frontmatter

```yaml
---
name: {skill_name}
description: >
  {One-sentence description of what this skill does}
  Core principle: {key rule or warning}
version: {x.y.z}
injected_at: {hook_name}
module: {module_name}
---
```

### Field Reference

| Field | Format | Example |
|-------|--------|---------|
| `name` | `snake_case` | `planning`, `monitoring`, `project_doc` |
| `description` | One sentence + core principle | See existing skills for style |
| `version` | Match `package.json` major.minor | `3.5.0` |
| `injected_at` | Standard hook name or `reference_only` | `before_prompt_build`, `agent_end`, `reference_only` |
| `module` | Directory name under `src/` | `metacognition`, `working-memory`, `personality`, `common` |

---

## Section 1: Injection Context

Describe when this skill is injected and what the plugin has already done.

```markdown
## Injection Context

This skill injects at **`{hook_name}`** when `{condition}`.

| Timing | Plugin Action | Storage Location |
|--------|--------------|------------------|
| Before injection | {what the plugin did} | `{state_key}` |
| At injection | {current state verification} | `{task_field}` |
```

**Rules**:
- If `injected_at` is `reference_only`, state clearly that this skill does not auto-inject
- If injection depends on `task.status`, list all status values that trigger this skill
- If multiple hooks are involved, explain the collaboration sequence

---

## Section 2: Core Objects

Document data structures the plugin maintains. Agent needs this to understand current state.

```markdown
## Core Objects

### {Object Name}

**Storage**: `task:{runId}.{field}` (unified task JSON)

```json
{{
  "{field}": "{value}",
  "...": "..."
}}
```

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| `{field}` | `{type}` | {description} | {plugin fills at {hook} / agent decides} |
```

**Rules**:
- Mark each field as "plugin-maintained" or "agent-decided"
- Use the current flat task JSON structure (v3.5.0+): `deviations`, `attributions`, `outcome` are top-level fields
- Never use the deprecated nested `event` structure

---

## Section 3: Agent Responsibilities

Separate decision-layer from execution-layer actions.

```markdown
## Agent Responsibilities

### {Responsibility Category}

**Trigger**: {when this responsibility activates}

**Agent Actions** (decision layer):
1. {Read/assess/decide action}
2. {Create/update/notify action}
3. {Final confirmation step}

**Plugin Actions** (execution layer, already completed):
- {Plugin already saved X to Y}
- {Plugin already verified Z}

**Available Context** (appended below this skill at injection):
- {What extra context the plugin provides}
```

**Rules**:
- Use "You must" for mandatory actions
- Use "You may" for optional actions
- Always include the "violation consequences" if skipping a mandatory step breaks the system

---

## Section 4: Decision Checkpoints

```markdown
## Decision Checkpoints

Before proceeding, confirm:

- [ ] {Check item 1}
- [ ] {Check item 2}
- [ ] {Check item 3}
```

**Rules**:
- Every skill must have at least one checkpoint
- Checkpoints should be verifiable (yes/no, not subjective)
- Include consequences of skipping: "If skipped, {what breaks}"

---

## Section 5: State Flow

```markdown
## State Flow

```
{status A}
    ↓ {trigger condition}
    ├─ {branch 1} → {status B}
    └─ {branch 2} → {status C}
```

**Transition Rules**:
- `{status A}` → `{status B}`: triggered by {who} via {mechanism}
- Plugin executes actual storage via `state.saveTask()`
```

**Rules**:
- ASCII diagrams only, no external image references
- Clearly mark who triggers each transition (agent vs. plugin)

---

## Section 6: Related Skills

```markdown
## Related Skills

| Skill | Injection Timing | Responsibility Boundary |
|-------|-----------------|------------------------|
| `xxx` | `{hook}` ({condition}) | {what it does vs. what this skill does} |
```

**Rules**:
- This table is the #1 source of documentation rot
- After changing any skill's injection timing, audit ALL skills' "Related Skills" tables
- Include `reference_only` skills if they provide guidance relevant to this skill's domain
- Never copy-paste from other skills' tables — verify each entry independently

---

## Section 7: Version History

```markdown
## Version History

| Version | Date | Changes |
|---------|------|---------|
| v{x.y.z} | YYYY-MM-DD | {what changed and why} |
```

**Rules**:
- Add entry when `version` frontmatter changes
- Include architecture changes, hook registration changes, and data model changes
- Do not log typo fixes or formatting changes
