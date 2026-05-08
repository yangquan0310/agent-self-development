---
name: collaboration-protocol
description: >
  Multi-Agent collaboration protocol for the agent-self-development project.
  Defines role boundaries (PM / Developer / Reviewer), collaboration workflows,
  and communication markers. Use this skill when multiple agents are working
  on the same project and need to coordinate tasks, reviews, and documentation.
---


# Multi-Agent Collaboration Protocol

> **版本**：v1.0.0
> **适用范围**：agent-self-development 插件项目
> **最后更新**：2026-05-08

---

## 1. 协作模式

本项目采用**多 Agent 分工协作**模式，三个角色各司其职：

| 角色 | 文件 | 职责 | 决策权限 |
|------|------|------|----------|
| **产品经理（PM）** | `agents/product-manager.md` | 需求分析、架构设计、进度把控、文档规划 | 需求优先级、模块划分、版本发布 |
| **程序员（Developer）** | `agents/developer.md` | 代码实现、工具调用、测试编写、技术决策 | 代码实现方式、实现层技术选型 |
| **审核（Reviewer）** | `agents/reviewer.md` | 代码审查、合规检查、文档审查、风险识别 | 代码合并批准、合规红线判定（最终批准权） |

**当前扮演者**：
- 产品经理：系统管理员（main）

---

## 2. 协作流程

```
产品经理（架构设计 + docs/roadmap/ + TODO.md）
    ↓
程序员（代码实现 + [DOC_UPDATE] / [DOC_SKIP]）
    ↓
审核（审查报告 + [APPROVED] / [REJECTED]）
    ↓
产品经理（更新 TODO.md + 版本归档）
```

### 阶段 1：需求澄清（PM 主导）
1. PM 读取用户输入，识别核心诉求
2. PM 输出「需求清单」+ 验收标准
3. PM 将任务写入 TODO.md

### 阶段 2：架构设计（PM 主导）
1. PM 设计模块划分和接口定义
2. PM 输出架构设计文档到 `docs/roadmap/v{x.y.z}.md`
3. PM 标注 `[ARCH_APPROVED]`，通知程序员进入实现

### 阶段 3：代码实现（Developer 主导）
1. Developer 读取 TODO.md，确认任务
2. Developer 按 `skills/project-context/SKILL.md` 的约定编写代码
3. Developer 完成任务后，标注 `[DOC_UPDATE: 文档名]` 或 `[DOC_SKIP]`
4. Developer 更新 TODO.md 任务状态

### 阶段 4：审查（Reviewer 主导）
1. Reviewer 读取变更摘要 + 代码 + 测试报告
2. Reviewer 运行审查 checklist（功能 / 合规 / 文档 / 测试）
3. Reviewer 输出裁决：`[APPROVED]` / `[CONDITIONAL_APPROVED]` / `[REJECTED]`
4. 若拒绝，Developer 修复后重新提交

### 阶段 5：版本归档（PM 主导）
1. PM 确认所有验收标准已满足
2. PM 更新 README.md（版本号、变更摘要）
3. PM 更新 metadata.json（版本号、模块列表）
4. PM 归档 TODO.md 已完成项到「历史版本」章节

---

## 3. 标记规范

| 标记 | 含义 | 使用者 |
|------|------|--------|
| `[PM_REVIEW]` | PM 已完成需求/架构评审，等待反馈 | PM |
| `[ARCH_APPROVED]` | 架构设计已确认，可以进入实现阶段 | PM |
| `[TODO_UPDATED]` | PM 已更新 TODO.md | PM |
| `[SCOPE_CHANGE]` | 需求范围发生变更，需要重新评估 | PM |
| `[RISK]` | 识别到风险，需要关注 | PM |
| `[TECH_BLOCKER]` | 发现技术不可行点，需要 PM 调整架构 | Developer |
| `[DOC_UPDATE: README\|SKILL\|TODO\|metadata]` | 代码变更需要同步更新文档 | Developer |
| `[DOC_SKIP]` | 本轮变更无需更新文档 | Developer |
| `[FIXED: 问题描述]` | 已修复审核提出的问题 | Developer |
| `[DISCUSS: 理由]` | 对审核意见有异议，请求讨论 | Developer |
| `[TEST_PASS]` | 测试全部通过 | Developer |
| `[TEST_FAIL: 原因]` | 测试失败，需要修复 | Developer |
| `[APPROVED]` | 审查通过，可以合并 | Reviewer |
| `[CONDITIONAL_APPROVED: 条件]` | 有条件通过，需在合并前修复指定问题 | Reviewer |
| `[REJECTED: 理由]` | 审查未通过，必须重新实现 | Reviewer |
| `[BLOCKER]` | 发现严重问题，必须修复 | Reviewer |
| `[WARNING]` | 发现潜在问题，建议修复 | Reviewer |
| `[SUGGESTION]` | 改进建议，非强制 | Reviewer |
| `[DOC_MISSING]` | 发现文档缺失或不同步 | Reviewer |

---

## 4. 项目文档责任矩阵

| 文档 | 创建者 | 维护者 | 审查者 | 位置 |
|------|--------|--------|--------|------|
| README.md | PM | PM + Developer | Reviewer | 项目根目录 |
| metadata.json | PM | Developer（代码变更时） | Reviewer | 项目根目录 |
| SKILL.md | PM | Developer | Reviewer | `skills/project-context/` |
| TODO.md | PM | 所有角色 | — | `skills/project-context/TODO_TEMPLATE.md` |
| 架构设计文档 | PM | PM | Reviewer | `docs/roadmap/v{x.y.z}.md` |
| 角色定义 | PM | PM | Reviewer | `agents/*.md` |
| 技术规范 | PM + Developer | Developer | Reviewer | `skills/project-conventions/SKILL.md` |

---

## 5. 冲突解决机制

| 冲突场景 | 仲裁者 | 决策依据 |
|----------|--------|----------|
| Developer 对架构有技术异议 | PM | 技术可行性 vs 需求完整性 |
| Developer 对审核意见有异议 | PM | 代码质量 vs 实现效率 |
| PM 与 Reviewer 对合规判定有分歧 | Reviewer（合规红线不可协商） | `skills/project-conventions/SKILL.md` 2.1 节 |
| 多个 Agent 并行修改同一文件 | PM | Plan 中的隔离区域划分 |
| 文档与代码不同步 | Reviewer（触发归档） | 以代码为准，文档必须追平 |

---

## 6. 文档索引

- `agents/product-manager.md` — 产品经理角色定义
- `agents/developer.md` — 程序员角色定义
- `agents/reviewer.md` — 审核角色定义
- `skills/project-conventions/SKILL.md` — 技术规范（钩子合规、数据模型、编码规范）
- `skills/project-context/SKILL.md` — 项目操作手册

---

*协议版本：v1.0.0*
*最后更新：2026-05-08*
*维护者：系统管理员（main）*
