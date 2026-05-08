---
name: project-context
description: >
  Project context management for agent-self-development.
  Use when: (1) Joining this project for the first time,
  (2) Starting a new task and need to understand current progress,
  (3) Updating project documentation (README / metadata / TODO),
  (4) Synchronizing task status with other agents.
---

# Project Context

Manage project-level context and documentation for agent-self-development.

## First-Time Setup

When you first work on this project, read files in this exact order:

1. `README.md` — project overview and installation
2. `metadata.json` — module structure and dependencies (if it exists)
3. `references/project-guide.md` — project-specific conventions, tools, and commands
4. `assets/TODO_TEMPLATE.md` — copy this to `TODO.md` if no task board exists yet
5. `TODO.md` — current task priorities and status

## Starting a New Task

1. Read `TODO.md` and identify the highest-priority open task
2. Read `references/project-guide.md` for relevant conventions (naming, directory structure, commit format)
3. Claim the task by updating `TODO.md` with your role and status
4. Execute the task following the conventions

## Updating Project Documents

After completing work, determine if documentation needs updating:

| Change Type | Action |
|-------------|--------|
| New module or directory | Update `README.md` structure section + `metadata.json` modules list |
| New tool or script | Update `references/project-guide.md` tools table |
| API or interface change | Update `references/project-guide.md` submodule docs |
| Code convention change | Update `references/project-guide.md` conventions section |
| Task completed | Update `TODO.md` status + archive if all subtasks done |
| Pure internal refactor | Add `[DOC_SKIP]` — no doc update needed |

Always end your response with one marker:
- `[DOC_UPDATE: README|SKILL|TODO|metadata]` — specify which doc you updated
- `[DOC_SKIP]` — no update needed

## Project Document Types

| Document | Location | Purpose | Audience |
|----------|----------|---------|----------|
| Project overview | `README.md` | Human-readable project introduction | Users + new agents |
| Machine metadata | `metadata.json` | Parseable project structure | Agents |
| Operation guide | `references/project-guide.md` | Project-specific tools and conventions | Working agents |
| Task board | `TODO.md` | Current tasks and priorities | All roles |
| Roadmap | `docs/roadmap/v*.md` | Version planning and architecture decisions | PM + architects |

## Quick Reference

- **Tech stack**: Node.js 22+, OpenClaw Extension API, built-in test suite (31 tests)
- **Main branch**: `dev`
- **Remote**: `github.com:yangquan0310/agent-self-development`
- **Test command**: `npm test`
- **Project conventions**: See `../project-conventions/SKILL.md`
- **Collaboration protocol**: See `../collaboration-protocol/SKILL.md`

## Resources

- `references/project-guide.md` — full project guide with directory structure, code conventions, tool commands, submodule details, and known pitfalls
- `assets/TODO_TEMPLATE.md` — template for creating a new task board
