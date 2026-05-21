---
name: update-todo
description: Update the project TODO.md progress board by synchronizing task statuses, milestones, version goals, and risk tracking. Use when the user asks to update TODO, mark tasks complete, upgrade TODO to a new version, sync roadmap changes into TODO.md, or refresh the progress board after architectural evaluations, planning shifts, or milestone completions.
---

# Update Todo

Synchronize project progress into `TODO.md` while preserving its canonical structure.

## Before Updating

1. Read the current `TODO.md` to understand its existing structure, active version, and current task states.
2. If the user references a roadmap, architecture evaluation, or plan document, read that document too.
3. Identify what changed: completed tasks, new tasks, shifted milestones, new risks, or version bumps.

## TODO.md Canonical Structure

Maintain these sections in order. Preserve markdown tables and checklists:

1. **Header** — project name, current version, update date, maintainer.
2. **版本目标** — active version goal, design philosophy, estimated completion.
3. **里程碑** — table with 里程碑/时间/交付物/状态 columns. Use `✅ 已完成` / `🚧 开发中` / `🔲 未开始`.
4. **任务树** — grouped by priority:
   - `P0：阻塞项` — must complete or version cannot ship
   - `P1：重要项` — affects experience or architecture consistency
   - `P2：优化项` — can be deferred
   Each task uses checklist syntax `- [ ]` / `- [x]` and includes: 负责人, 来源问题, 交付物, 验收标准, 里程碑, 依赖(optional).
5. **问题-解决对照表** — table mapping 问题 → 来源 → 解决方案 → 对应任务.
6. **角色分工** — table of roles and current status.
7. **阻塞与风险** — table with 风险/等级/缓解措施.
8. **历史版本** — table of past releases.
9. **最近更新** — reverse-chronological changelog of TODO edits and project events.

## Update Rules

- **Never drop completed work**: When upgrading to a new version (e.g., v4.1.0 → v4.2.0), move the old version’s tasks into **历史版本** and append a summary line; do not delete them.
- **Keep checkboxes consistent**: Use `- [x]` for completed tasks, `- [ ]` for pending. Partial work stays `- [ ]` with a note in 验收标准 or 最近更新.
- **Preserve task IDs implicitly**: If the existing TODO numbers tasks (e.g., P0-1, P1-3), keep the same numbering scheme or renumber sequentially after insertions.
- **Link problems to tasks**: Every entry in **问题-解决对照表** must map to at least one task in **任务树**. If a new problem has no task yet, create one.
- **Update dates and versions**: When the active version changes, update the header, 版本目标, and **历史版本** table.
- **Append to 最近更新**: Add a new bullet at the top with the current date and a one-line summary of what changed.
- **Milestone status flow**: `🔲 未开始` → `🚧 开发中` → `✅ 已完成`. Only mark completed when its deliverables and acceptance criteria are verified.

## Integration Patterns

### Syncing from a Roadmap Document

When the user provides a roadmap (e.g., `docs/roadmap/vX.Y.Z.md`):

1. Extract: problems, solutions, execution checklist, milestones, acceptance criteria.
2. Map roadmap solutions to **问题-解决对照表**.
3. Convert roadmap execution checklist into **任务树** tasks (P0/P1/P2), preserving milestones.
4. If the roadmap introduces a new version, archive the old version’s content into **历史版本** and rewrite **版本目标** / **里程碑** / **任务树** for the new version.

### Syncing from an Architecture Evaluation

When the user provides an architecture evaluation (e.g., `docs/architecture/vX.Y.Z-architecture-evaluation.md`):

1. Extract risks (RISK-N) and ADR recommendations.
2. For each risk, decide:
   - If it blocks release → create a P0 task
   - If it affects architecture consistency → create a P1 task
   - If it is cleanup/optional → create a P2 task
3. Add risks to **阻塞与风险** if they are active threats.
4. Add each risk to **问题-解决对照表** with source `vX.Y.Z 架构评估`.

### Marking Tasks Complete

When the user says a task is done:

1. Find the task in **任务树** and change `- [ ]` to `- [x]`.
2. Verify its 验收标准 are met; if unsure, ask the user for confirmation.
3. If the task is the last uncompleted item in a milestone, mark that milestone `✅ 已完成`.
4. Add a bullet to **最近更新**.

## Output

Write the updated `TODO.md` file directly. Do not output the full file in chat unless the user asks. Confirm the sections updated and any version changes.
