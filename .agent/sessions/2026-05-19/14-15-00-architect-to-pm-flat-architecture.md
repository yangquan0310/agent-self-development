# Architect → PM：扁平化架构设计完成

> **事件类型**：架构交付 + `[ARCH_READY]`  
> **来源**：Architect  
> **目标角色**：PM  
> **日期**：2026-05-19  
> **关联文档**：`docs/adr/adr-014.md`、`docs/CONVENTIONS.md`、`docs/specs/*.md`  
> **关联事件**：`.agent/sessions/2026-05-19/pm-to-architect-blueprint-released-v4.3.0.md`

---

## 1. 问题

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | 旧架构（对象层）受 v4.2.0 重框架影响，TaskObject/EventObject 类过度抽象 | 🔴 阻塞 | Architect | ✅ 已解决 |
| I2 | 旧 specs 定义 9+3 个方法，接口臃肿，Developer 实现成本高 | 🔴 阻塞 | Architect | ✅ 已解决 |
| I3 | CONVENTIONS.md 与 PM 蓝图 v2.0.0 存在越界（PM 定义了具体目录结构和方法名） | 🔴 阻塞 | Reviewer | ✅ 已解决 |
| I4 | task.json 字段与方法不匹配（sessionIds/tools/revisionReason 孤儿字段） | 🔴 阻塞 | Architect | ✅ 已解决 |

---

## 2. 已解决

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | I1 — 对象层过度抽象 | 输出 ADR-014：彻底删除 TaskObject/EventObject 类，Handler 直接读写文件 | Architect | 2026-05-19 |
| R2 | I2 — 接口臃肿 | 扁平化为 5+1=6 个 Handler：`createTask/updateTask/advanceTask/getTask/archiveTask/reportEvent` | Architect | 2026-05-19 |
| R3 | I3 — CONVENTIONS 越界 | 重写 CONVENTIONS.md：移除 PM 蓝图中不应出现的目录结构/方法名限制，改为 Architect 定义的扁平化规范 | Architect | 2026-05-19 |
| R4 | I4 — 字段不匹配 | 删除 `sessionIds`/`tools`/`revisionReason`；剩余 10 个字段全部映射到 6 个 Handler | Architect | 2026-05-19 |
| R5 | 旧 specs 基于对象层 | 重写三份 specs 为 Handler 层规范，版本升至 v3.0.0 | Architect | 2026-05-19 |

---

## 3. 待解决

| ID | 问题 | 阻塞原因 | 负责人 | 截止日期 |
|----|------|---------|--------|----------|
| P1 | `src/tools/handlers.js` 实现 | 需 Developer 依据新 specs 编码 | Developer | M1: 2026-05-23 |
| P2 | `src/tools/schemas.js` 实现 | 需 Developer 依据新 specs 编码 | Developer | M1: 2026-05-23 |
| P3 | `src/utils/io.js` + `resolve.js` 实现 | 需 Developer 提供文件 IO 原子操作 | Developer | M1: 2026-05-23 |
| P4 | `src/index.js` 入口重写 | 需 Developer 适配扁平化注册 | Developer | M1: 2026-05-23 |

---

## 4. 建议

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | **批准 Developer 启动 M1 代码实现** — ADR-014 + CONVENTIONS + specs 已全部 `[ARCH_READY]`，接口冻结 | Architect | 🔴 高 | 待 PM `[ARCH_APPROVED]` |
| S2 | P1~P4 可并行开发：`io.js` 和 `resolve.js` 是基础依赖，建议优先实现 | Architect | 🟡 中 | 待确认 |
| S3 | 旧架构文档 `v4.3.0-architecture-design-deprecated.md` 已废弃，无需额外处理 | Architect | 🟢 低 | 已确认 |

---

## 5. 新架构摘要

### 5.1 核心决策（ADR-014）

**放弃对象层，Handler 直接 IO。**

```
Agent → Tool Handler → utils/io.js → task.json / event.md
```

没有 TaskObject，没有 EventObject，没有依赖注入。

### 5.2 目录结构

```
src/
├── index.js              # 入口
├── tools/
│   ├── index.js          # 注册
│   ├── schemas.js        # 6 个 schema
│   ├── handlers.js       # 6 个 handler（直接文件 IO）
│   └── adapter.js        # 返回值适配
├── templates/
│   ├── task.json
│   └── event.md
└── utils/
    ├── io.js             # readJson / writeJson / ensureDir / moveFile
    └── resolve.js        # 路径解析
```

### 5.3 6 个工具

| 工具 | Handler | 操作 |
|------|---------|------|
| `task.create` | `createTask` | 写 `.agent/tasks/{runId}.json` |
| `task.update` | `updateTask` | 读 → 改 → 写 task.json（万能更新入口） |
| `task.advance` | `advanceTask` | 推进 phase |
| `task.get` | `getTask` | 读 task.json（活跃+归档双路径） |
| `task.archive` | `archiveTask` | 移动 task.json → archive/ |
| `event.report` | `reportEvent` | 读 task.json → 渲染 → 写 event.md |

### 5.4 PM 需求验证

| PM 需求（蓝图 v2.0.0） | 验证 |
|------------------------|------|
| 任务管理工具 | ✅ `task.create/update/advance/get/archive` |
| 事件报告工具 | ✅ `event.report` |
| 不暴露认知指导 | ✅ 无 planning/monitoring/regulation/development |
| 不注入 Hook | ✅ 纯 `api.registerTool` |
| 保留文件格式契约 | ✅ `.agent/tasks/` + `.agent/events/{date}/` |
| event.md 延迟凝练 | ✅ `event.report` 仅在 completed 时调用，一次性渲染 |

---

## 6. 交付物清单

| 文档 | 路径 | 状态 |
|------|------|------|
| 扁平化架构 ADR | `docs/adr/adr-014.md` | `[ARCH_READY]` |
| 项目规范 | `docs/CONVENTIONS.md` | `[ARCH_READY]` |
| Task Handler 规范 | `docs/specs/task-object-interface.md` v3.0.0 | `[ARCH_READY]` |
| Event Handler 规范 | `docs/specs/event-object-interface.md` v3.0.0 | `[ARCH_READY]` |
| Tool Registry 规范 | `docs/specs/tool-registry-interface.md` v3.0.0 | `[ARCH_READY]` |

---

*事件创建：Architect*  
*日期：2026-05-19*  
*`[ARCH_READY]`*
