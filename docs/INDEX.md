# 项目文档索引（Project Document Index）

> **版本**：v1.3.0
> **用途**：新 Agent 进入项目时的「文档地图」，按角色和任务快速导航
> **更新频率**：每次新增/删除文档时同步更新

---

## 🔴 必读（进入项目时强制读取）

| 文档 | 路径 | 读完所需时间 | 读完能做什么 |
|------|------|------------|-------------|
| 项目总览 | `README.md` | 2 分钟 | 理解项目定位、技术栈、如何安装 |
| 文档索引 | `docs/INDEX.md`（本文件） | 1 分钟 | 知道所有文档的位置和用途 |
| 协作协议 | `docs/COLLABORATION.md` | 2 分钟 | 知道自己的角色边界和协作标记 |
| **设计哲学** | `docs/reference/design-philosophy.md` | 3 分钟 | 理解 v4.3.0 "从代劳到赋能" 的核心思想，纯 Tool 驱动 |
| **理论基础** | `docs/reference/theory.md` | 5 分钟 | 理解自传体记忆、工作自我、同化/顺应如何映射到 Agent 自主行为 |

---

## 🟡 按需（执行任务时查阅）

### 按角色

| 我是... | 核心文档 | 辅助文档 |
|---------|---------|---------|
| **产品经理（PM）** | `.agentsagents/product-manager.md` | `docs/roadmap/v{x.y.z}.md`, `docs/changelog/INDEX.md`, `docs/reference/design-philosophy.md` |
| **程序员（Developer）** | `.agentsagents/developer.md` | `docs/CONVENTIONS.md`, `docs/specs/*.md`, `docs/reference/design-philosophy.md` |
| **审核（Reviewer）** | `.agentsagents/reviewer.md` | `docs/CONVENTIONS.md`, `docs/reports/latest.md`, `docs/reference/design-philosophy.md` |
| **架构师（Architect）** | `.agentsagents/architect.md` | `docs/roadmap/v{x.y.z}.md`, `docs/adr/*.md`, `docs/specs/*.md` |

### 按任务

| 任务 | 先读 | 再读 |
|------|------|------|
| 新 Agent 接手项目 | `README.md` → `docs/INDEX.md` | `.agentsagents/{role}.md` |
| 新增工具或对象方法 | `docs/CONVENTIONS.md` 目录结构 + 命名规范 | `docs/specs/task-object-interface.md` / `docs/specs/event-object-interface.md` |
| 修复 Bug | `docs/reports/latest.md` | `docs/CONVENTIONS.md` 错误处理章节 |
| 代码审查 | `.agentsagents/reviewer.md` Checklist | `docs/CONVENTIONS.md` 工具注册规范 |
| 版本发布 | `docs/changelog/INDEX.md` | `docs/roadmap/v{x.y.z}.md` |
| 跨角色通讯 | `docs/COLLABORATION.md` 四段式模板 | `.agentssessions/{date}/` 历史事件 |

---

## 🔵 归档（通常不读，需要时查阅）

| 类型 | 位置 | 说明 |
|------|------|------|
| 历史版本计划 | `docs/roadmap/v3.5.0.md` 及之前 | 已完成的版本，仅追溯变更原因时查阅 |
| 架构设计（旧） | `docs/architecture/v4.3.0-design.md` | [DEPRECATED] 旧渐进式重构方案，保留历史参考 |
| 历史测试报告 | `docs/reports/review-YYYY-MM-DD-*.md` | 旧审查报告，已关闭的问题 |
| 历史变更日志 | `docs/changelog/v3.5.0.md` 及之前 | 旧版本的详细变更记录 |
| 历史 ADR | `docs/adr/adr-001.md` ~ `adr-009.md` | 部分过时的架构决策记录 |
| 废弃 Hook 参考 | `docs/reference/hook-reference.md` | v4.2.x Hook + Tool 混合架构，仅历史存档 |

---

## 文档责任矩阵

| 文档 | 创建者 | 维护者 | 审查者 | 位置 |
|------|--------|--------|--------|------|
| README.md | PM | PM + Developer | Reviewer | 根目录 |
| metadata.json | PM | Developer | Reviewer | 根目录 |
| CONVENTIONS.md | PM | PM | Reviewer | `docs/` |
| COLLABORATION.md | PM | PM | Reviewer | `docs/` |
| INDEX.md（本文件） | PM | PM | Reviewer | `docs/` |
| **设计哲学** | PM | PM | Reviewer | `docs/reference/` |
| **理论基础** | PM | PM | Reviewer | `docs/reference/` |
| 角色定义（.agents） | PM | PM | Reviewer | `.agentsagents/` |
| 蓝图（roadmap/） | PM | PM | — | `docs/roadmap/` |
| 变更日志（changelog/） | PM | PM | — | `docs/changelog/` |
| 接口规范（specs/） | Architect | Architect | Reviewer | `docs/specs/` |
| 架构决策（adr/） | Architect | Architect | Reviewer | `docs/adr/` |
| 技术参考（reference/） | Developer | Developer | Reviewer | `docs/reference/` |
| 测试报告（reports/） | Developer | Developer | Reviewer | `docs/reports/` |
| 跨角色事件（sessions/） | 所有角色 | 所有角色 | — | `.agentssessions/` |

---

## 标记速查

| 标记 | 含义 | 谁输出 |
|------|------|--------|
| `[PM_REVIEW]` | PM 已完成评审 | PM |
| `[ARCH_APPROVED]` | 架构确认，可开发 | PM |
| `[TODO_UPDATED]` | 任务看板已更新 | PM |
| `[SCOPE_CHANGE]` | 需求变更，需要重新评估 | PM |
| `[RISK]` | 识别到风险，需要关注 | PM |
| `[TECH_BLOCKER]` | 技术不可行，需调整 | Developer |
| `[DOC_UPDATE: 文档名]` | 已更新文档 | Developer |
| `[DOC_SKIP]` | 本轮无需更新 | Developer |
| `[FIXED: 描述]` | 审查问题已修复 | Developer |
| `[DISCUSS: 理由]` | 不同意审查意见，请求升级 | Developer |
| `[TEST_PASS]` | 全部测试通过 | Developer |
| `[TEST_FAIL: 理由]` | 测试失败 | Developer |
| `[APPROVED]` | 审查通过 | Reviewer |
| `[CONDITIONAL_APPROVED: 条件]` | 有条件通过 | Reviewer |
| `[REJECTED: 理由]` | 审查未通过 | Reviewer |
| `[BLOCKER]` | 严重问题，必须修复 | Reviewer |
| `[WARNING]` | 潜在问题 | Reviewer |
| `[SUGGESTION]` | 可选改进 | Reviewer |
| `[DOC_MISSING]` | 文档不同步 | Reviewer |

---

*文档版本：v1.3.0*  
*最后更新：2026-05-19*  
*维护者：PM（产品经理）*
