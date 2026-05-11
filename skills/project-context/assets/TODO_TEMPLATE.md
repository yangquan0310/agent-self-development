# Project v4.0 执行清单 — 增强上下文 & 多代理协作

> 基于 v4.0.0 架构治理计划，将「项目文档自维护」与「Session 复用增强」落地到本项目。
> 创建时间：2026-05-08
> 状态：进行中

---

## Phase 1: 项目文档骨架搭建（当前）

- [x] 1.1 读取 v4.0.0 架构计划，提取核心设计
- [x] 1.2 制定本清单（TODO.md）
- [ ] 1.3 创建项目级 SKILL.md（PROJECT_SKILL.md）— Agent 操作指南
- [ ] 1.4 更新 README.md — 添加「项目追踪」章节，链接到本清单
- [ ] 1.5 将文档路径写入 MEMORY.md（工作记忆）

## Phase 2: 上下文增强机制

- [ ] 2.1 Session 复用规则落地 — 在 planning skill 中明确「同 taskFamily 优先复用 idle Session」
- [ ] 2.2 全局 Session 索引可视化 — 新增 `sessions list` 到 working-memory 输出
- [ ] 2.3 跨 Session 上下文继承 — 子代理完成后，关键产出摘要回写父 Session
- [ ] 2.4 Agent 启动时自动加载项目级 SKILL.md — 在 before_prompt_build 中注入项目上下文

## Phase 3: 多代理协作增强

- [ ] 3.1 明确主-辅代理分工协议 — 主代理制定计划，子代理执行，主代理监控
- [ ] 3.2 子代理产出物标准化 — 统一输出格式：`[SUBAGENT_DONE]` + 产出摘要
- [ ] 3.3 代理间消息路由优化 — 利用 `sessions_send` + `sessions_list` 实现状态同步
- [ ] 3.4 冲突检测 — monitoring 增加「多代理并行修改同一文件」偏差类型

## Phase 4: 项目文档自维护（Project Documentation）

- [ ] 4.1 创建 `src/project-documentation/` 模块骨架
- [ ] 4.2 实现 `after_tool_call` 文件变更检测
- [ ] 4.3 实现 `before_prompt_build` 条件注入 PROJECT_DOC skill
- [ ] 4.4 定义 [DOC_UPDATE] / [DOC_SKIP] 标记规范
- [ ] 4.5 编写场景测试：文件变更 → 文档自动更新

## Phase 5: 验证与归档

- [ ] 5.1 全量测试通过（npm test）
- [ ] 5.2 更新 skills/project-conventions/SKILL.md — 添加 project-documentation 模块说明
- [ ] 5.3 更新 openclaw.plugin.json — 注册新模块
- [ ] 5.4 归档本清单到「docs/roadmap/v4.0.0-执行记录.md」
- [ ] 5.5 提交并推送 dev 分支

---

## 快速参考：项目文档路径

| 文档 | 路径 | 用途 |
|------|------|------|
| 执行清单 | `/root/实验室仓库/agent-self-development/TODO.md` | 本文件，任务追踪 |
| 项目指南 | `/root/实验室仓库/agent-self-development/PROJECT_SKILL.md` | Agent 操作手册 |
| 架构计划 | `/root/实验室仓库/agent-self-development/docs/roadmap/v4.0.0.md` | 设计蓝图 |
| 原README | `/root/实验室仓库/agent-self-development/README.md` | 对外说明 |

---

## 变更记录

| 日期 | 版本 | 变更内容 | 执行人 |
|------|------|----------|--------|
| 2026-05-08 | v4.0.0-draft | 创建清单与文档骨架 | 系统管理员 |

