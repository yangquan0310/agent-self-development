# v4.3.0 蓝图与架构审查报告

> **审查者**：Developer（代码审查）
> **日期**：2026-05-19
> **审查范围**：`TODO.md` + `docs/roadmap/v4.3.0.md` + `docs/architecture/v4.3.0-design.md` + `docs/architecture/v4.3.0-architecture-review.md`
> **结论**：架构方向正确，但**文档之间存在 10 项不一致和模糊点**，必须在 M1 启动前由 PM 统一决策，否则 Developer 无法确定实现边界。

---

## 🔴 阻塞项（必须在编码前解决）

### B1：工具数量不一致——7 个还是 13 个？

| 文档 | 工具总数 | guide.* 状态 |
|------|---------|-------------|
| `roadmap/v4.3.0.md` | **7 个** | ❌ 废弃 |
| `architecture/v4.3.0-architecture-review.md` | **7 个** | ❌ 废弃 |
| `architecture/v4.3.0-design.md` 6.1 节 | **13 个** | ✅ 保留（新增 `guide-tools.js`） |
| `architecture/v4.3.0-design.md` 7.3 节 | **13 个** | ✅ 保留（4 个 guide.* 工具详细列出） |

**问题**：`design.md` 与 `roadmap`/`architecture-review` 存在根本性分歧。
- roadmap 废弃清单明确列出 `guide.planning/monitoring/regulation/development`
- design.md 目录结构保留 `src/tools/namespaced/guide-tools.js`，并详细定义了 4 个 guide.* 工具的参数和返回值

**影响**：如果按 roadmap 实现 7 个工具，则 design.md 中 guide.* 的设计全部作废；如果按 design.md 实现 13 个工具，则与 PM 的「极简工具插件」定位矛盾。

**建议决策**：请 PM 明确确认——
- [ ] **选项 A**：严格 7 个工具（task.* 5 + event.* 2），guide.* 完全废弃，design.md 需重写删除 guide.* 章节
- [ ] **选项 B**：保留 guide.*（共 13 个），roadmap 和 TODO 废弃清单需修正

---

### B2：目录清理范围不一致——删除还是保留？

| 目录/文件 | roadmap | architecture-review | design.md |
|-----------|---------|---------------------|-----------|
| `src/metacognition/` | ❌ 删除 | ❌ 删除 | ✅ 保留（UPDATED） |
| `src/working-memory/` | ❌ 删除 | ❌ 删除 | ✅ 保留（UPDATED） |
| `src/personality/` | ❌ 删除 | ❌ 删除 | ✅ 保留（UPDATED） |
| `src/common/adapters/` | ❌ 删除 | ⚠️ 降级为纯 IO | ✅ 保留（state.js 降级） |
| `src/common/hook.js` | ❌ 删除 | ❌ 删除 | ✅ 保留（无变化） |
| `src/common/heartbeat.js` | ❌ 删除 | ❌ 删除 | ✅ 保留（无变化） |
| `src/common/skills.js` | ❌ 删除 | ❌ 删除 | ✅ 保留（无变化） |
| `src/common/template-engine.js` | ❌ 删除 | ❌ 删除 | ✅ 保留（无变化） |
| `src/common/cognitive-trace.js` | ❌ 删除 | ❌ 删除 | ✅ 保留（无变化） |
| `src/common/case-index.js` | ❌ 删除 | ❌ 删除 | ✅ 保留（无变化） |
| `src/common/stream.js` | ❌ 删除 | ❌ 删除 | 未提及 |
| `src/common/project-context.js` | → `utils/path.js` | → `utils/path.js` | ✅ 保留（无变化） |

**问题**：roadmap 和 architecture-review 要求「删除」或「迁移」，但 design.md 的目录结构图中将这些标记为「保留（无变化）」或「UPDATED（薄包装）」。

**影响**：Developer 无法确定 M1 的删除边界。如果按 roadmap 删除，则 design.md 中保留 metacognition/ 等目录的设计全部作废；如果按 design.md 保留薄包装，则与「极简」定位矛盾。

**建议决策**：请 PM 明确——
- [ ] **选项 A**：roadmap 为准，M1 彻底删除上述目录（git 历史可回滚），index.js 仅保留对象初始化 + 工具注册
- [ ] **选项 B**：design.md 为准，metacognition/ 等保留为薄包装（委托模式），v4.4.0 再移除

---

### B3：State adapter 处置——删除还是降级保留？

| 文档 | 方案 |
|------|------|
| `roadmap/v4.3.0.md` | ❌ 删除 `src/common/adapters/`，IO 下沉到 `utils/file.js` |
| `architecture/v4.3.0-architecture-review.md` | ⚠️ 降级为纯 IO（readJson/writeJson/listJson/deleteJson/exists） |
| `architecture/v4.3.0-design.md` | ✅ 保留 `src/common/adapters/state.js`，降级为纯 IO |

**问题**：roadmap 说「删除 adapters/」，但 design.md 和 architecture-review 都保留了 state.js 的降级方案。如果删除 adapters/，则需要新建 `utils/file.js` 来替代；如果保留，则需要重构 state.js。

**建议决策**：
- [ ] **选项 A**：删除 adapters/，TaskObject/EventObject 直接通过 `utils/file.js` 读写 `./.agent/`（符合「极简」）
- [ ] **选项 B**：保留 `adapters/state.js` 为纯 IO 层，但删除其他 adapter（Flow/Memory/Log/Task）

---

## 🟡 严重不一致（影响验收标准）

### I4：测试用例目标不一致

| 文档 | 测试目标 |
|------|---------|
| `TODO.md` P0-2 | TaskObject 新增方法 ≥8 个用例 + EventObject.generate ≥4 个用例 |
| `TODO.md` P2-3 | ≥50 个用例（7 工具 × 正常/异常/边界） |
| `design.md` 8.2 节 | ≥180 个用例 |

**问题**：三个文档给出三个完全不同的测试目标（12 vs 50 vs 180）。M3 验收时以哪个为准？

**建议**：统一为 ≥50 个用例（覆盖 7 工具 + 对象方法 + 边界条件），180 个过于激进且不必要。

---

### I5：event.md 生成触发机制模糊

| 文档 | 触发机制 |
|------|---------|
| `roadmap/v4.3.0.md` | 「Agent 调用 event.record」→ EventObject 从已归档 task.json 凝练生成 |
| `architecture/v4.3.0-architecture-review.md` | 「Agent 显式调用 event.record 触发」，同时又说「task.archive() 或 task.advance() 检测到 isComplete=true 时调用 EventObject.render」 |
| `design.md` 5.3 节 | 归档数据流包含「触发系统级归档」，但未明确 event.md 触发 |

**问题**：event.md 是「自动触发」还是「Agent 显式调用」？如果是自动触发，event.record 工具还有什么意义？如果是显式调用，为什么 task.archive 的注释里提到自动触发？

**建议决策**：
- [ ] **选项 A**：纯显式——Agent 必须手动调用 `event.record`，task.archive 不自动触发 event.md 生成
- [ ] **选项 B**：半自动——task.archive 自动调用 EventObject.generate，event.record 仅用于查询场景（或其他用途）
- [ ] **选项 C**：event.record 更名为 event.generate，语义更清晰

---

### I6：项目级路径 vs 系统级路径——是否完全废弃系统级？

`architecture-review.md` ADR-010 说「所有 Agent 可见的 task/event 数据均写入项目级 `./.agent/`」，State adapter / Memory adapter / Flow adapter 不再被使用。

但 `design.md` 保留了 `src/common/adapters/` 中的 Flow/Memory/Log/Task adapter（标记为「暂不改动」）。

**问题**：如果系统级 adapters 完全废弃，则 `src/index.js` 中的 `new Flow()`、`new Memory()`、`new Log()` 初始化代码也需删除。但 design.md 未提及这些。

**建议**：明确系统级 adapters 的处置——是全部删除，还是仅 TaskObject/EventObject 不再使用它们？

---

## 🟠 中等问题（影响实现效率）

### I7：M1 里程碑时间已过期

- M1 截止时间：2026-05-20
- 当前日期：2026-05-19
- M1 尚未启动

**问题**：M1 包含目录清理 + utils 提取 + objects 精简 + assets 模板确认，工作量巨大，明天不可能完成。

**建议**：立即调整里程碑时间表——M1 延至 2026-05-23，M2 延至 2026-05-26，M3 延至 2026-05-29，M4 延至 2026-06-02。

---

### I8：删除与验证的时间差风险

- P0-1（M1）：删除大量代码
- P1-4（M3）：grep 全量验证旧模块/旧工具名零残留

**问题**：中间间隔约 5 天。如果 M1 误删了仍然需要的代码（如被 design.md 标记为「保留」的 metacognition/ 薄包装），要到 M3 才发现。

**建议**：P1-4 的 grep 验证应提前到 M1 完成后立即执行，而非等到 M3。

---

### I9：版本号未更新

- `package.json`：4.2.0（v4.2.0 发布时的版本）
- `src/index.js`：4.2.0
- `TODO.md`：4.3.0
- `design.md` 示例代码：`version: '4.2.0'`

**建议**：M1 启动时应同步更新 package.json 和 index.js 至 4.3.0。

---

### I10：方法命名不一致

| 文档命名 | 代码实际命名 |
|----------|-------------|
| `recordDeviation()` | `deviate()` |
| `recordAttribution()` | `attribute()` |

**建议**：统一采用 `recordDeviation()` / `recordAttribution()`（语义更明确），同步更新代码和文档。

---

## 总结与行动建议

| 优先级 | 问题 | 决策方 | 阻塞 M1？ |
|--------|------|--------|----------|
| P0 | B1：工具数量（7 vs 13） | PM | ✅ 是 |
| P0 | B2：目录清理范围 | PM | ✅ 是 |
| P0 | B3：State adapter 处置 | PM | ✅ 是 |
| P1 | I5：event.md 触发机制 | PM + Architect | ⚠️ 影响 P0-2/P0-3 实现 |
| P1 | I4：测试用例目标 | PM | ❌ 可延后 |
| P1 | I6：系统级 adapters 处置 | PM | ⚠️ 影响 index.js 重写 |
| P2 | I7：M1 时间过期 | PM | ❌ 可调整 |
| P2 | I8：删除与验证时间差 | PM | ❌ 可调整 |
| P2 | I9：版本号 | Developer | ❌ 5 分钟搞定 |
| P2 | I10：方法命名 | Developer | ❌ 10 分钟搞定 |

**对 PM 的请求**：请在开始任何编码前，对 B1/B2/B3 做出明确决策。Developer 当前因「不知道哪些代码要删、哪些要保留、哪些工具要实现」而无法启动 M1。

---

*审查完成时间：2026-05-19 11:56*  
*关联文档：docs/roadmap/v4.3.0.md、docs/architecture/v4.3.0-design.md、docs/architecture/v4.3.0-architecture-review.md*
