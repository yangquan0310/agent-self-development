---
name: collaboration-protocol
description: >
  Multi-agent collaboration protocol for agent-self-development.
  Use when you are acting as PM, Developer, or Reviewer and need to:
  (1) Coordinate work with other agents on this project,
  (2) Apply collaboration markers in your outputs,
  (3) Resolve role conflicts or scope disagreements,
  (4) Determine whether a change needs documentation updates,
  (5) Format cross-role communications using the 4-section template.
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

---

## Cross-Role Communication Protocol

When one role needs to formally communicate status, blockers, or decisions to another role, use the **4-Section Template** below. This replaces informal chat-style updates and ensures all critical information is structured and actionable.

### When to Use

- Architect finishes a design deliverable and reports to PM
- Developer completes a milestone and reports to PM / Reviewer
- PM issues a scope change or decision to any role
- Reviewer publishes findings that require follow-up
- Any role discovers a blocker that requires escalation

### Where to Post

1. **Primary**: Create a file under `.agent/sessions/{YYYY-MM-DD}/` using the naming convention:
   ```
   {HH-MM-SS}-{source-role}-to-{target-role}-{topic}.md
     ```
   Example: `13-38-42-architect-to-pm-specs-ready.md`
2. **Secondary**: Reference the session file in `TODO.md` or chat to notify the target role.

### 4-Section Template

Copy this template for every formal cross-role communication:

```markdown
# {Source Role} → {Target Role}：{Topic}

> **事件类型**：{status-report | scope-change | blocker | decision | review}  
> **来源**：{Role}  
> **目标角色**：{Role}  
> **日期**：{YYYY-MM-DD}  
> **关联文档**：`path/to/doc.md`

---

## 1. 问题（Issues）

当前已识别的问题列表。每条问题需说明严重度和当前状态。

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | {一句话描述} | 🔴 阻塞 / 🟡 中 / 🟢 低 | {Role} | ✅ 已解决 / 🚧 进行中 / ⏳ 待处理 |

---

## 2. 已解决（Resolved）

本周期内已关闭的问题及其解决方案。

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | {引用问题 ID 或简述} | {具体做法} | {Role} | {YYYY-MM-DD} |

---

## 3. 待解决（Pending）

需要目标角色关注或决策的开放事项。

| ID | 问题 | 阻塞原因 | 负责人 | 截止日期 |
|----|------|---------|--------|----------|
| P1 | {简述} | {为什么还没做} | {Role} | {YYYY-MM-DD} |

---

## 4. 建议（Suggestions）

非阻塞性的改进建议，供目标角色参考。

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | {具体建议} | {Role} | 🔴 高 / 🟡 中 / 🟢 低 | 待确认 / 已采纳 / 已否决 |

---

*事件创建：{Role}*  
*日期：{YYYY-MM-DD}*  
*`{[MARKER]}`*
```

### Severity Legend

| 图标 | 含义 | 响应时限 |
|------|------|----------|
| 🔴 | 阻塞 — 当前工作无法继续 | 立即响应 |
| 🟡 | 中 — 影响进度或质量，但有绕行方案 | 24 小时内 |
| 🟢 | 低 — 建议或优化，不阻塞任何工作 | 下次同步时 |

### Status Legend

| 图标 | 含义 |
|------|------|
| ✅ | 已解决 / 已完成 / 已采纳 |
| 🚧 | 进行中 |
| ⏳ | 待处理 / 待确认 |
| ❌ | 已否决 / 已关闭但不解决 |

---

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
