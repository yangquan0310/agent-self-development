# PM → Architect：v4.3.0 架构方向变更通知

> **事件类型**：架构方向变更  
> **来源**：PM 审查响应  
> **目标角色**：Architect  
> **日期**：2026-05-19  
> **关联报告**：`docs/reports/review-v4.3.0-pm-decision-2026-05-19.md`  
> **关联审查**：`docs/reports/review-v4.3.0-blueprint-issues-2026-05-19-11-56-20.md`

---

## 背景

Reviewer 在审查中发现 `docs/roadmap/v4.3.0.md`（PM 新方向）与 `docs/architecture/v4.3.0-design.md`（Architect 旧方向）存在 10 项不一致，其中 3 项阻塞 M1 启动。PM 已做出明确裁决，现通知 Architect。

---

## 需要 Architect 知悉并执行的 6 项决策

### 1. design.md 作废，不再维护

**决策**：`docs/architecture/v4.3.0-design.md` 基于的「渐进式重构」方案已被用户方向变更否决。

**Architect 行动**：
- 接受该文档进入维护模式，**不再更新**
- 如需保留历史参考，可添加 `[DEPRECATED]` 标注（由 PM 建议，Architect 决定是否采纳）
- 后续架构设计以 `docs/roadmap/v4.3.0.md` 为准

### 2. 暴露工具从 13 个缩减为 7 个

**旧方案（design.md）**：task.* 7 + event.* 2 + guide.* 4 = 13 个  
**新方案（roadmap）**：task.* 5 + event.* 2 = 7 个

**废弃工具**：`guide.planning`、`guide.monitoring`、`guide.regulation`、`guide.development`、`task.files`、`task.diagnose`、`task.deviate`、`task.attribute`

**Architect 行动**：确认 specs/ 中相关接口定义同步作废，如有需要可协助迁移 useful logic 到 assets/templates/。

### 3. metacognition/ / working-memory/ / personality/ 彻底删除

**旧方案（design.md）**：保留为「薄包装」委托模式  
**新方案（roadmap）**：彻底删除，不在 src/ 中保留任何痕迹

**Architect 行动**：确认 ADR-009 中「Plan 类委托模式」「Event 类委托模式」等章节标记作废。

### 4. adapters/ 整体删除，IO 下沉到 utils/file.js

**旧方案（design.md）**：State adapter 降级为纯 IO，保留 state.js  
**新方案（roadmap）**：`src/common/adapters/` 整体删除，原子读写逻辑迁移到 `src/utils/file.js`

**Architect 行动**：确认 ADR-009 中「State Adapter 降级为纯 IO」章节仍有效（概念层面），但实现层面改为 utils/ 而非 adapters/。

### 5. event.md 从增量追加改为 task 完成后一次性凝练

**旧方案（design.md）**：EventObject 增量追加 event.md（createEvent + record + _appendToSection）  
**新方案（roadmap）**：EventObject.generate(runId, task) 一次性从 task.json 凝练生成

**event.md 规范**：
- 文件名：`{runId}.md`
- 路径：`./.agent/events/{YYYY-MM-DD}/{runId}.md`
- 触发：Agent 显式调用 `event.record`（task 完成后）

**Architect 行动**：确认 `docs/specs/event-object-interface.md` 中接口定义需更新（`generate()` 替代 `createEvent()` + `record()` 增量追加）。

### 6. M1~M4 时间延后 2 天

| 里程碑 | 旧时间 | 新时间 |
|--------|--------|--------|
| M1 | 05-20 | **05-22** |
| M2 | 05-22 | **05-25** |
| M3 | 05-25 | **05-28** |
| M4 | 05-28 | **05-30** |

**Architect 行动**：如需补充 ADR 或 specs，请在 M1（05-22）前完成。

---

## Architect 可继续有效的工作

以下产出在旧方案中仍有效，建议 Architect 评估后决定是否保留或更新：

| 产出 | 状态 | 建议 |
|------|------|------|
| `docs/adr/ADR-009-object-adapter-boundary.md` | ⚠️ 部分过时 | 更新或标注「State 降级」仍有效，「委托模式」作废 |
| `docs/specs/task-object-interface.md` | ⚠️ 需更新 | 新增 recordDeviation / recordAttribution / setOutcome / linkEventFile |
| `docs/specs/event-object-interface.md` | ⚠️ 需更新 | generate() 替代 createEvent()+record() |
| `docs/specs/tool-registry-interface.md` | ⚠️ 需更新 | 从 13 个工具改为 7 个 |

---

## 阻塞项

Reviewer 要求：Architect 确认以上 6 项决策无技术不可行项后，Developer 方可启动 M1。

请 Architect 回复本事件或更新 TODO.md 中角色状态。

---

*事件创建：PM*  
*日期：2026-05-19*  
*[PM_REVIEW]*
