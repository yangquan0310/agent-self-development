# Architect → PM：CONVENTIONS 对齐完成 + 代码重写授权请求

> **事件类型**：架构交付 + 授权请求  
> **来源**：Architect  
> **目标角色**：PM  
> **日期**：2026-05-19  
> **关联文档**：`docs/CONVENTIONS.md`、`docs/specs/task-object-interface.md`、`docs/specs/event-object-interface.md`  
> **关联会话**：`.agent/sessions/2026-05-19/pm-to-architect-specs-amendment-v4.3.0.md`

---

## 1. 问题

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | task.json 字段与方法不匹配：sessionIds/tools/revisionReason 无方法覆盖；outcome/eventFilePath 无写入方法 | 🔴 阻塞 | Architect | ✅ 已解决 |
| I2 | TaskObject.js 仍依赖旧模块（state adapter, caseIndex, cognitive-trace），与 v4.3.0 精简方向冲突 | 🔴 阻塞 | Architect | ⏳ 待 Developer 重写 |
| I3 | EventObject.js 仍为增量追加模式（createEvent/record/_appendToSection），与 v4.3.0 一次性凝练策略冲突 | 🔴 阻塞 | Architect | ⏳ 待 Developer 重写 |
| I4 | 方法命名不统一：代码中为 `deviate()/attribute()`，CONVENTIONS 中为 `recordDeviation()/recordAttribution()` | 🟡 中 | Architect | ✅ 已解决（CONVENTIONS 层统一为动名词短语） |

---

## 2. 已解决

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | I1 — 字段与方法不匹配 | CONVENTIONS.md 删除 `sessionIds`、`tools`、`revisionReason`；剩余 10 个字段全部映射到 9 个方法 | Architect | 2026-05-19 |
| R2 | I4 — 命名不统一 | CONVENTIONS.md 统一方法名：`recordDeviation`、`recordAttribution`、`setOutcome`、`linkEvent` | Architect | 2026-05-19 |
| R3 | PM A1 ~ A4 全部纳入规范 | `deviationIds` 精确关联、`outcome` 浅合并、ID `random4` 防冲突、`generate` 双路径扫描 | Architect | 2026-05-19 |
| R4 | 字段-方法对齐校验表 | CONVENTIONS.md 新增映射表，Developer 编码时可直接对照 | Architect | 2026-05-19 |

---

## 3. 待解决

| ID | 问题 | 阻塞原因 | 负责人 | 截止日期 |
|----|------|---------|--------|----------|
| P1 | TaskObject.js 代码重写 | 需 Developer 依据新 CONVENTIONS 删除旧依赖、实现 9 个方法 | Developer | M1: 2026-05-23 |
| P2 | EventObject.js 代码重写 | 需 Developer 删除增量追加逻辑、实现 `generate(runId)` 一次性凝练 | Developer | M1: 2026-05-23 |
| P3 | src/assets/task.json 模板清理 | 删除 `sessionIds`、`tools`、`revisionReason` | Developer | M1: 2026-05-23 |
| P4 | specs 同步更新 | `docs/specs/task-object-interface.md` 和 `event-object-interface.md` 需同步 PM A1~A4 修正 | Architect | 2026-05-20 |

---

## 4. 建议

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | **授权 Developer 立即启动 M1 代码重写** — CONVENTIONS.md 已稳定，字段-方法映射已明确，阻塞项已清除 | Architect | 🔴 高 | 待 PM 批准 |
| S2 | Architect 在 Developer 重写代码前，先完成 specs 同步（P4），避免 Developer 编码时参考的 specs 仍是旧版 | Architect | 🔴 高 | 待 PM 确认 |
| S3 | P1/P2 的代码重写可并行：TaskObject.js 和 EventObject.js 互不依赖（Tool Handler 层负责协调） | Architect | 🟡 中 | 待确认 |
| S4 | 建议 `src/utils/file.js` 在 M1 初期优先实现，作为 TaskObject/EventObject 的共同依赖 | Architect | 🟡 中 | 待确认 |

---

## 5. 对齐结果摘要

**TaskObject 方法集（9 个）**：
```
create / get / update / advance / archive / recordDeviation / recordAttribution / setOutcome / linkEvent
```

**task.json 字段（10 个）**：
```
runId / status / taskType / createdAt / updatedAt / plan / deviations / attributions / outcome / eventFilePath
```

**EventObject 方法集（3 个）**：
```
generate(runId) — 双路径扫描 task.json → 渲染 event.md
query(filters)  — 扫描 .agent/events/{date}/
archive(runId)  — 移动 event.md
```

---

*事件创建：Architect*  
*日期：2026-05-19*  
*`[ARCH_READY]`*
