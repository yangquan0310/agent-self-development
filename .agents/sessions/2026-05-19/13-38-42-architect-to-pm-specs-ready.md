# Architect → PM：Specs 重写完成汇报

> **事件类型**：架构交付物完成  
> **来源**：Architect  
> **目标角色**：PM  
> **日期**：2026-05-19  
> **关联文档**：`docs/specs/task-object-interface.md`、`docs/specs/event-object-interface.md`、`docs/specs/tool-registry-interface.md`  
> **关联 ADR**：`docs/adr/adr-010.md`、`docs/adr/adr-011.md`、`docs/adr/adr-012.md`、`docs/adr/adr-013.md`

---

## 1. 问题

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | `docs/specs/` 下三份接口文档仍标记 `[待更新]`，Developer 无法依据其启动 M1 | 🔴 阻塞 | Reviewer | ✅ 已解决 |
| I2 | ADR-009 文件名不统一（大写驼峰），与 ADR 命名规范冲突 | 🟡 低 | Architect | ✅ 已解决 |
| I3 | `docs/cases/` 下过时案例文档未清理，与 v4.3.0 精简方向不符 | 🟡 低 | Architect | ✅ 已解决 |

---

## 2. 已解决

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | I1 — Specs 过时 | 重写三份接口规范文档，对齐 v4.3.0 架构：TaskObject 新增 4 方法、EventObject 改为延迟凝练、Tool Registry 定义 7 工具 | Architect | 2026-05-19 |
| R2 | I2 — ADR-009 命名 | 重命名为 `adr-009.md`（小写连字符），内容标注「部分过时」 | Architect | 2026-05-19 |
| R3 | I3 — cases 过时 | 删除 `docs/cases/paper-revision-collaboration.md`（v4.0.0 案例，与当前架构无关） | Architect | 2026-05-19 |
| R4 | — | 新增 `.gitignore` 排除运行时数据目录 `.agentsevents/`、`.agentstasks/` | Architect | 2026-05-19 |

---

## 3. 待解决

| ID | 问题 | 阻塞原因 | 负责人 | 截止日期 |
|----|------|---------|--------|----------|
| P1 | M1 目录清理与代码迁移 | 需 Developer 启动；specs 现已 ready | Developer | 2026-05-23 |
| P2 | M2 tools 重写与注册适配 | 依赖 M1 完成后 objects 稳定 | Developer | 2026-05-26 |
| P3 | P1-4 零残留验证 | 依赖 M1 删除代码完成后执行 grep | Developer | 2026-05-23 |
| P4 | `docs/COLLABORATION.md` 通讯模板更新 | PM 需确认模板格式是否符合协作习惯 | PM | — |

---

## 4. 建议

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | Developer 启动 M1 前，先阅读最新 specs 三份文档，确认接口定义无歧义 | Architect | 🔴 高 | 待确认 |
| S2 | M1 执行时建议保留 `src/common/utils.js` 的 `safeReadJson` / `safeWriteJson` 函数迁移到 `src/utils/file.js`，而非重写 | Architect | 🟡 中 | 待确认 |
| S3 | `docs/COLLABORATION.md` 增加跨角色通讯协议章节（含本汇报的四段式模板），规范日常协作格式 | Architect | 🟡 中 | 待 PM 确认 |
| S4 | 建议每次角色间正式通讯（如 PM→Architect、Architect→Developer）均使用 `.agentssessions/{date}/` 目录归档，替代散落在 TODO 或聊天记录中的信息 | Architect | 🟢 低 | 待确认 |

---

## 5. 交付物清单

| 文档 | 路径 | 状态 |
|------|------|------|
| TaskObject 接口规范 | `docs/specs/task-object-interface.md` | `[ARCH_READY]` |
| EventObject 接口规范 | `docs/specs/event-object-interface.md` | `[ARCH_READY]` |
| Tool Registry 接口规范 | `docs/specs/tool-registry-interface.md` | `[ARCH_READY]` |
| 项目级文件系统 ADR | `docs/adr/adr-010.md` | `[ARCH_READY]` |
| 单次写入源 ADR | `docs/adr/adr-011.md` | `[ARCH_READY]` |
| 返回值适配 ADR | `docs/adr/adr-012.md` | `[ARCH_READY]` |
| Event.md 延迟凝练 ADR | `docs/adr/adr-013.md` | `[ARCH_READY]` |

---

*事件创建：Architect*  
*日期：2026-05-19*  
*`[ARCH_READY]`*
