# 项目文档索引（Project Document Index）

> **版本**：v1.0.0
> **用途**：新 Agent 进入项目时的「文档地图」，按角色和任务快速导航
> **更新频率**：每次新增/删除文档时同步更新

---

## 🔴 必读（进入项目时强制读取）

| 文档 | 路径 | 读完所需时间 | 读完能做什么 |
|------|------|------------|-------------|
| 项目总览 | `README.md` | 2 分钟 | 理解项目定位、技术栈、如何安装 |
| 文档索引 | `docs/INDEX.md`（本文件） | 1 分钟 | 知道所有文档的位置和用途 |
| 协作协议 | `docs/COLLABORATION.md` | 2 分钟 | 知道自己的角色边界和协作标记 |
| **设计哲学** | `docs/reference/design-philosophy.md` | 3 分钟 | 理解 v4.1.0 "从代劳到赋能"的核心思想 |
| **理论基础** | `docs/reference/theory.md` | 5 分钟 | 理解自传体记忆、工作自我、同化/顺应如何映射到架构 |

---

## 🟡 按需（执行任务时查阅）

### 按角色

| 我是... | 核心文档 | 辅助文档 |
|---------|---------|---------|
| **产品经理（PM）** | `agents/product-manager.md` | `docs/roadmap/v{x.y.z}.md`, `docs/changelog/INDEX.md`, `docs/reference/design-philosophy.md` |
| **程序员（Developer）** | `agents/developer.md` | `docs/CONVENTIONS.md`, `skills/project-context/SKILL.md`, `docs/reference/design-philosophy.md` |
| **审核（Reviewer）** | `agents/reviewer.md` | `docs/CONVENTIONS.md` 2.1 节, `test/reports/latest.md`, `docs/reference/design-philosophy.md` |

### 按任务

| 任务 | 先读 | 再读 |
|------|------|------|
| 新 Agent 接手项目 | `README.md` → `docs/INDEX.md` | `skills/project-context/SKILL.md` |
| 新增功能模块 | `docs/CONVENTIONS.md` 3.2 节 | `docs/roadmap/v{x.y.z}.md` |
| 新增技能（Skill） | `skills/openclaw-skill-dev/SKILL.md` | `skills/openclaw-skill-dev/references/SKILL_TEMPLATE.md` |
| 修复 Bug | `test/reports/latest.md` | `docs/CONVENTIONS.md` 3.3 节 |
| 代码审查 | `agents/reviewer.md` Checklist | `docs/CONVENTIONS.md` 2.1 节 |
| 版本发布 | `docs/changelog/INDEX.md` | `docs/roadmap/v{x.y.z}.md` |
| **多Agent协作实践** | `docs/cases/paper-revision-collaboration.md` | `docs/COLLABORATION.md` |

---

## 🔵 归档（通常不读，需要时查阅）

| 类型 | 位置 | 说明 |
|------|------|------|
| 历史版本计划 | `docs/roadmap/v3.5.0.md` 及之前 | 已完成的版本，仅追溯变更原因时查阅 |
| 历史测试报告 | `test/reports/review-YYYY-MM-DD-*.md` | 旧审查报告，已关闭的问题 |
| 历史变更日志 | `docs/changelog/v3.5.0.md` 及之前 | 旧版本的详细变更记录 |

---

## 文档责任矩阵

| 文档 | 创建者 | 维护者 | 审查者 | 位置 |
|------|--------|--------|--------|------|
| README.md | PM | PM + Developer | Reviewer | 根目录 |
| metadata.json | PM | Developer | Reviewer | 根目录 |
| CONVENTIONS.md | PM + Developer | Developer | Reviewer | `docs/` |
| COLLABORATION.md | PM | PM | Reviewer | `docs/` |
| INDEX.md（本文件） | PM | PM | Reviewer | `docs/` |
| **设计哲学** | PM | PM | Reviewer | `docs/reference/` |
| **理论基础** | PM | PM | Reviewer | `docs/reference/` |
| 角色定义（agents/） | PM | PM | Reviewer | `agents/` |
| 技能（skills/） | PM | Developer | Reviewer | `skills/` |
| 路线图（roadmap/） | PM | PM | — | `docs/roadmap/` |
| 变更日志（changelog/） | PM | PM | — | `docs/changelog/` |
| 技术参考（reference/） | Developer | Developer | Reviewer | `docs/reference/` |
| 测试报告（test/reports/） | Developer | Developer | Reviewer | `test/reports/` |

---

## 标记速查

| 标记 | 含义 | 谁输出 |
|------|------|--------|
| `[PM_REVIEW]` | PM 已完成评审 | PM |
| `[ARCH_APPROVED]` | 架构确认，可开发 | PM |
| `[TECH_BLOCKER]` | 技术不可行，需调整 | Developer |
| `[DOC_UPDATE: 文档名]` | 已更新文档 | Developer |
| `[DOC_SKIP]` | 本轮无需更新 | Developer |
| `[APPROVED]` | 审查通过 | Reviewer |
| `[REJECTED: 理由]` | 审查未通过 | Reviewer |
| `[BLOCKER]` | 严重问题，必须修复 | Reviewer |

---

*文档版本：v1.1.0*
*最后更新：2026-05-11*
*维护者：PM（产品经理）*
