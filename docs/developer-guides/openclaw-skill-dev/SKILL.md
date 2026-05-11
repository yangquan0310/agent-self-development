---
name: openclaw-skill-dev
description: >
  Guide for creating and reviewing OpenClaw plugin skills (SKILL.md files).
  Use when developing, updating, or auditing skills for the agent-self-development
  framework. Covers frontmatter standards, injection context formatting, agent
  responsibility definitions, hook compliance rules, and cross-skill relationship
  documentation.
---

# OpenClaw Skill Development

Create and review OpenClaw plugin skills following the v3.5.0+ architecture standards.

## Quick Start

To create a new skill:

1. Copy `references/SKILL_TEMPLATE.md` as the starting point
2. Fill in the frontmatter with the correct hook and module
3. Define injection context, agent responsibilities, decision checkpoints, state flow
4. Verify hook compliance using the checklist in `references/hook-compliance.md`
5. Update the "Related Skills" table to reflect actual injection timings

## Frontmatter Standards

OpenClaw skills use extended YAML frontmatter:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier, `snake_case` |
| `description` | Yes | One-sentence purpose + core principle |
| `version` | Yes | Match current codebase version (e.g., `3.5.0`) |
| `injected_at` | Yes | Standard hook name or `reference_only` |
| `module` | Yes | `metacognition`, `working-memory`, `personality`, or `common` |

**Critical**: The `injected_at` field must match the actual hook registration in `src/{module}/module.js`. Mismatches between frontmatter and code are the most common source of documentation bugs.

## Core Sections

Every OpenClaw SKILL.md must include these sections in order:

1. **Injection Context**: Describe the hook trigger condition and what the plugin has already done before injecting this skill. Include a timing table.
2. **Core Objects**: Document the data structures the plugin manages. Include JSON examples and field tables. Mark fields maintained by the plugin vs. the agent.
3. **Agent Responsibilities**: Separate decision-layer actions (what the agent must decide) from execution-layer actions (what the plugin has already done automatically).
4. **Decision Checkpoints**: Mandatory checklist the agent must verify before proceeding to the next step.
5. **State Flow**: ASCII diagram showing status transitions and who triggers each transition.
6. **Related Skills**: Cross-reference table with accurate injection timings for all linked skills. This table is the most frequent source of stale information — verify every entry.

## Hook Compliance Rules

See `references/hook-compliance.md` for the full hook type matrix.

**Red lines** — never violate:
- `llm_output` and `agent_end` are **pure observation** hooks. Never return `prependSystemContext` or `action` from them.
- `before_tool_call`, `after_tool_call`, and `subagent_*` hooks are also pure observation.
- Only `before_prompt_build`, `before_agent_finalize`, and `heartbeat_prompt_contribution` may return values that affect prompt building or agent flow.

## When to Update an Existing Skill

Update a skill when any of these change:
- Hook registration logic in `src/{module}/module.js`
- The skill's `injected_at` or trigger condition
- Data model (Task JSON structure, state keys, etc.)
- Cross-skill relationships (another skill corrected its injection timing)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Frontmatter `injected_at` says `llm_output` but code registers on `before_prompt_build` | Align frontmatter to actual code registration |
| "Related Skills" table lists outdated injection timings for other skills | Audit and update every cross-reference |
| JSON examples still use removed nested fields (e.g., `task.event`) | Migrate to current flat structure (`task.deviations`, etc.) |
| Agent responsibilities mix decision and execution layers | Clearly separate "you decide" vs. "plugin already did" |
| Missing `version` update after architecture change | Bump version when data model or hook registration changes |

## Resources

- **Template**: See `references/SKILL_TEMPLATE.md` for the complete starting template
- **Hook Compliance**: See `references/hook-compliance.md` for the full hook type matrix and red lines
