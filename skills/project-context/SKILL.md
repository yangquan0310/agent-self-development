---
name: project-context
description: >
  Project context management skill. Provides standardized project documentation
  protocol (README/metadata/SKILL/TODO), collaboration markers, and task board
  templates. Use this skill when joining a new project, synchronizing task status,
  or updating project documentation. Supports multi-agent collaboration by
  providing shared context across PM, Developer, and Reviewer roles.
---

# Project Context Skill

> **版本**：v1.0.0
> **所属插件**：agent-self-development v4.0.0

---

## 技能概述

本技能提供一套标准化的「项目上下文协议」，包含四个核心文件，让 Agent 能快速理解项目、同步进度、协作开发。

| 文件 | 路径 | 用途 |
|------|------|------|
| 项目总览 | `README.md` | 人类可读，Agent 快速理解项目定位 |
| 机器架构 | `metadata.json` | Agent 解析项目结构、依赖、入口 |
| 操作手册 | `SKILL.md`（本技能参考文档） | Agent 调用项目工具、脚本的指南 |
| 进度看板 | `TODO.md` | 所有 Agent 同步任务状态 |

### 配套资源

| 资源 | 位置 | 用途 |
|------|------|------|
| 项目指南 | `references/project-guide.md` | 本项目特定的操作规范（技术栈、代码约定、工具命令） |
| 看板模板 | `assets/TODO_TEMPLATE.md` | 任务看板 Markdown 模板，新项目复制为 `TODO.md` |

---

## 使用场景

### 场景 1：首次接手项目

```
1. 读取 README.md → 理解项目定位和技术栈
2. 读取 metadata.json → 了解模块结构和依赖
3. 读取本技能 references/project-guide.md → 掌握代码约定和常用工具
4. 读取 TODO.md → 确认当前任务优先级
```

### 场景 2：执行业务任务

```
1. 读取 TODO.md，认领任务
2. 按 references/project-guide.md 的约定编写代码
3. 任务完成后，标注 [DOC_UPDATE] 或 [DOC_SKIP]
4. 更新 TODO.md 任务状态
```

### 场景 3：维护项目文档（归档 Agent）

```
1. 检测到 [DOC_PENDING] 或 [DOC_UPDATE] 标记
2. 根据变更类型更新对应文档：
   - 新增模块 → 更新 README.md + metadata.json
   - 新增工具 → 更新 references/project-guide.md
   - 任务完成 → 更新 TODO.md
3. 输出 [DOC_UPDATED: 文档名] 标记
```

---

## 标记规范

| 标记 | 含义 | 使用者 |
|------|------|--------|
| `[DOC_UPDATE: README]` | 已更新 README.md | Developer |
| `[DOC_UPDATE: SKILL]` | 已更新项目操作指南 | Developer |
| `[DOC_UPDATE: TODO]` | 已更新 TODO.md | Developer |
| `[DOC_UPDATE: metadata]` | 已更新 metadata.json | Developer |
| `[DOC_SKIP]` | 本轮变更无需更新文档 | Developer |
| `[DOC_PENDING]` | 检测到需要更新但未执行 | Monitor |
| `[DOC_UPDATED: 文档名]` | 归档 Agent 确认已更新 | Archiver |

---

## 项目级 SKILL.md 与插件 SKILL.md 的区别

| 维度 | 插件 SKILL.md | 项目级 SKILL.md（本技能参考文档） |
|------|--------------|---------------|
| 位置 | `src/{module}/SKILL.md` | `skills/project-context/references/` |
| 内容 | 插件钩子机制、Agent 行为规范 | 项目工具调用、代码约定、工作流 |
| 更新者 | 插件开发者 | 业务 Agent + 归档 Agent |
| 读者 | 所有使用插件的 Agent | 操作本项目的 Agent |

---

## 文档更新责任矩阵

| 文档 | 创建者 | 维护者 | 审查者 |
|------|--------|--------|--------|
| README.md | PM | PM + Developer | Reviewer |
| metadata.json | PM | Developer | Reviewer |
| references/project-guide.md | PM | Developer | Reviewer |
| TODO.md | PM | 所有角色 | — |
| 路线图（roadmap/） | PM | PM | — |

---

## 快速参考

- [项目指南](references/project-guide.md) — 本项目操作规范
- [看板模板](assets/TODO_TEMPLATE.md) — 任务看板模板
- [协作协议](../../collaboration-protocol/SKILL.md) — 多 Agent 协作协议
- [技术规范](../../project-conventions/SKILL.md) — 编码规范与钩子合规

---

*技能版本：v1.0.0*
*所属插件：agent-self-development v4.0.0*
*维护者：系统管理员（main）*
