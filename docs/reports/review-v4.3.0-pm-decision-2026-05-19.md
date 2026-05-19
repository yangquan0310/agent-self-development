# PM 审查响应：v4.3.0 蓝图分歧裁决

> **日期**：2026-05-19  
> **审查来源**：Reviewer 报告 `review-v4.3.0-blueprint-issues-2026-05-19-11-56-20.md`  
> **裁决者**：PM  
> **状态**：[DECISION_MADE] — Developer 可依此启动 M1

---

## 🔴 B1/B2/B3 核心决策

### B1：暴露几个工具？→ 7 个

**裁决**：以 `docs/roadmap/v4.3.0.md` 为准，暴露 **7 个命名空间工具**（task.* 5 + event.* 2）。`docs/architecture/v4.3.0-design.md` 中保留 guide.* 的方案已被用户方向变更否决。

**依据**：用户在 2026-05-19 明确指示——"这一版要实现的是工具插件"、"只保留 objects/assets/tools/utils"。guide.* 是「插件替 Agent 决策」的残留，不符合工具插件哲学。

**行动**：
- `docs/architecture/v4.3.0-design.md` 顶部标注 `[DEPRECATED]`
- `src/tools/schemas.js` 和 `src/tools/index.js` 中移除 `guide.*`、`task.deviate`、`task.attribute`、`task.files`、`task.diagnose`

### B2：metacognition/ 等目录删不删？→ 删除

**裁决**：以 `docs/roadmap/v4.3.0.md` 为准，**彻底删除** `src/metacognition/`、`src/working-memory/`、`src/personality/`。

**依据**：用户明确指令 "src只保留几个文件夹objects、assets、tools、utils"。不存在"保留为薄包装"的选项。

**行动**：
- M1 直接删除上述目录
- `src/index.js` 中移除所有相关 import 和初始化
- `docs/architecture/v4.3.0-design.md` 中"Plan 类委托模式"章节标记作废

### B3：State adapter 怎么处理？→ 删除 adapters/，IO 下沉到 utils/file.js

**裁决**：以 `docs/roadmap/v4.3.0.md` 为准，`src/common/adapters/` **整体删除**，原始 IO 逻辑迁移到 `src/utils/file.js`。

**依据**：工具插件不需要 adapter 继承体系。TaskObject/EventObject 直接调用 `utils/file.js` 中的 `readJson()` / `writeJson()` / `readMarkdown()` / `writeMarkdown()`。

**行动**：
- 提取 `state.js` 中的原子读写逻辑 → `src/utils/file.js`
- 删除 `src/common/adapters/state.js`、`flow.js`、`memory.js`、`log.js`、`task.js`、`hook.js`
- TaskObject 不再注入 `deps.state`，改为注入 `deps.baseDir` + `deps.utils`

---

## 🟡 7 项不一致裁决

| 编号 | 问题 | 裁决 |
|------|------|------|
| I4 | 测试目标 12 vs 50 vs 180 | **统一为 M3 ≥ 50 用例**。精简架构（7 工具 + 2 对象）不需要 180 个。TaskObject 新方法单独 8 个 + EventObject.generate 单独 4 个 = 12 个对象单测，其余 38 个为工具集成测试。 |
| I5 | event.md 自动触发还是显式调用？ | **Agent 显式调用 `event.record`**。task.archive 只移动 task.json，不自动触发生成 event.md。Agent 自行决定何时生成事件报告。 |
| I6 | Flow/Memory/Log 是否废弃？ | **全部废弃**。工具插件不需要系统级 adapters。如有日志需求，使用 `console.log` 或 `api.logger`。 |
| I7 | M1 截止 05-20（明天） | **延后至 2026-05-22**。给足审查和启动时间。对应 M2→05-25、M3→05-28、M4→05-30。 |
| I8 | M1 删代码，M3 才验证 | **M1 增加检查点**：每删除一个目录后运行 `node --test` 确认编译通过；M1 验收增加"npm test 能运行（允许测试为空）"。 |
| I9 | 版本号仍停留在 4.2.0 | **README.md 版本更新纳入 M2 验收标准**（P1-1 / P2-1 已覆盖）。 |
| I10 | deviate() vs recordDeviation() | **统一为 `recordDeviation()` 和 `recordAttribution()`**。`deviate()` / `attribute()` 废弃，与 v4.2.0 旧方法名彻底切割。 |

---

## 📋 统一后的文档状态

| 文档 | 状态 | 说明 |
|------|------|------|
| `docs/roadmap/v4.3.0.md` | ✅ 有效 | 以本文档为准 |
| `docs/architecture/v4.3.0-design.md` | ⚠️ [DEPRECATED] | 旧渐进式重构方案，已作废。保留历史参考，顶部已加标注。 |
| `TODO.md` | ✅ 有效 | 已同步更新 |
| `docs/adr/ADR-009-object-adapter-boundary.md` | ⚠️ 部分过时 | ADR-009 中"State 降级为纯 IO"仍有效，但"Plan 委托模式"等章节作废。 |

---

## 🚀 Developer 可启动 M1 的前提

Reviewer 确认以下 3 项后，Developer 即可启动 M1：

1. [ ] Reviewer 确认本裁决无遗漏阻塞项
2. [ ] PM 在 `docs/architecture/v4.3.0-design.md` 顶部添加 `[DEPRECATED]` 标注
3. [ ] PM 更新 `TODO.md` 中 M1~M4 时间（延后 2 天）

以上 3 项由 PM 在本文档提交时一并完成。

---

*裁决版本：v1.0.0*  
*日期：2026-05-19*  
*[DECISION_MADE]*
