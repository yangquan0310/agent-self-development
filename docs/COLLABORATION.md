---
name: collaboration-protocol
description: >
  Multi-agent collaboration protocol for agent-self-development.
  Use when you are acting as PM, Developer, or Reviewer and need to:
  (1) Coordinate work with other agents on this project,
  (2) Apply collaboration markers in your outputs,
  (3) Resolve role conflicts or scope disagreements,
  (4) Determine whether a change needs documentation updates.
---

# Multi-Agent Collaboration Protocol

Apply the correct role behavior and markers when working with other agents on this project.

## Role Selection

Determine your current role from the task assignment, then follow the corresponding rules below.

| Role | Authority | Decision Scope |
|------|-----------|----------------|
| **PM** | Architecture, requirements, release | Task priority, module division, version planning |
| **Developer** | Implementation, tooling, testing | Code approach, tech stack choices, implementation details |
| **Reviewer** | Approval, compliance, risk | Merge approval, compliance red lines (final say) |

---

## PM Rules

1. **Before any implementation starts**, output `[ARCH_APPROVED]` after your architecture design
2. **Maintain the task board**: Update `TODO.md` after each phase transition
3. **Define acceptance criteria** for every task before handing to Developer
4. **Resolve conflicts** between Developer and Reviewer when they disagree on feasibility vs. quality
5. **Output `[PM_REVIEW]`** when you finish requirement analysis and wait for feedback
6. **Output `[SCOPE_CHANGE]`** when requirements change after development starts

## Developer Rules

1. **Read `TODO.md` before starting any task** — confirm the task and its acceptance criteria
2. **Follow `skills/project-conventions/SKILL.md`** for coding standards and hook compliance
3. **After completing a task**, add one of these markers at the end of your final response:
   - `[DOC_UPDATE: README]` — if the change affects project overview, installation, or architecture
   - `[DOC_UPDATE: SKILL]` — if the change adds/modifies tools or workflows
   - `[DOC_UPDATE: TODO]` — if the task board needs sync
   - `[DOC_UPDATE: metadata]` — if module structure or dependencies changed
   - `[DOC_SKIP]` — if the change is purely internal and needs no doc update
4. **Output `[TEST_PASS]`** when all tests pass, or `[TEST_FAIL: reason]` when they fail
5. **Output `[FIXED: description]`** when you address a review comment
6. **Output `[DISCUSS: reason]`** when you disagree with a review comment and need escalation
7. **Output `[TECH_BLOCKER]`** when you discover the architecture is technically infeasible

## Reviewer Rules

1. **Run the review checklist** on every submission:
   - Functionality: Does the change do what the task requires?
   - Compliance: Does it follow hook rules and coding standards?
   - Documentation: Are `[DOC_UPDATE]` / `[DOC_SKIP]` markers present and correct?
   - Tests: Do tests pass? Are new tests added for new behavior?
2. **Output your verdict** at the end of the review:
   - `[APPROVED]` — merge allowed
   - `[CONDITIONAL_APPROVED: condition]` — merge allowed after fixing the specified issue
   - `[REJECTED: reason]` — must re-implement
3. **Classify findings**:
   - `[BLOCKER]` — severe issue, must fix
   - `[WARNING]` — potential issue, should fix
   - `[SUGGESTION]` — improvement idea, optional
   - `[DOC_MISSING]` — documentation out of sync with code

## Collaboration Markers Reference

| Marker | Meaning | Used By |
|--------|---------|---------|
| `[PM_REVIEW]` | PM finished requirement review, waiting feedback | PM |
| `[ARCH_APPROVED]` | Architecture confirmed, implementation may start | PM |
| `[TODO_UPDATED]` | Task board updated | PM |
| `[SCOPE_CHANGE]` | Requirements changed, re-evaluation needed | PM |
| `[RISK]` | Risk identified, needs attention | PM |
| `[TECH_BLOCKER]` | Technical infeasibility found | Developer |
| `[DOC_UPDATE: name]` | Code change requires doc sync | Developer |
| `[DOC_SKIP]` | No doc update needed for this change | Developer |
| `[FIXED: desc]` | Review issue fixed | Developer |
| `[DISCUSS: reason]` | Disagree with review, request escalation | Developer |
| `[TEST_PASS]` | All tests pass | Developer |
| `[TEST_FAIL: reason]` | Tests failed | Developer |
| `[APPROVED]` | Review passed | Reviewer |
| `[CONDITIONAL_APPROVED: cond]` | Passed with conditions | Reviewer |
| `[REJECTED: reason]` | Review failed | Reviewer |
| `[BLOCKER]` | Severe issue | Reviewer |
| `[WARNING]` | Potential issue | Reviewer |
| `[SUGGESTION]` | Optional improvement | Reviewer |
| `[DOC_MISSING]` | Doc out of sync | Reviewer |

## Conflict Resolution

When disagreements occur, apply this arbitration:

| Conflict | Arbiter | Rule |
|----------|---------|------|
| Developer disputes architecture | PM | Technical feasibility vs. requirement completeness |
| Developer disputes review | PM | Code quality vs. implementation efficiency |
| PM vs. Reviewer on compliance | Reviewer | Compliance red lines are non-negotiable |
| Multiple agents edit same file | PM | Plan isolation zones prevent this; if it happens, last-write-wins with manual merge |
| Docs out of sync with code | Reviewer | Code is source of truth; docs must catch up |

## Document Ownership

| Document | Creator | Maintainer | Reviewer |
|----------|---------|------------|----------|
| `README.md` | PM | PM + Developer | Reviewer |
| `metadata.json` | PM | Developer | Reviewer |
| `skills/project-context/SKILL.md` | PM | Developer | Reviewer |
| `TODO.md` | PM | All roles | — |
| Roadmap (`docs/roadmap/`) | PM | PM | — |
| `skills/project-conventions/SKILL.md` | PM + Developer | Developer | Reviewer |

## External References

- `../../docs/COLLABORATION.md` — root-level collaboration protocol summary
- `../../docs/reference/architecture.md` — four-layer architecture and authority boundaries
- `../../skills/project-context/SKILL.md` — project context and task board management
