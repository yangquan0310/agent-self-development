# PM → Architect：Specs 补充修正请求

> **事件类型**：需求澄清 + 接口修正请求  
> **来源**：PM  
> **目标角色**：Architect  
> **日期**：2026-05-19  
> **关联文档**：`docs/specs/task-object-interface.md`、`docs/specs/event-object-interface.md`  
> **关联事件**：`.agent/sessions/2026-05-19/13-38-42-architect-to-pm-specs-ready.md`

---

## 1. 元信息

- **runId**: v4.3.0-specs-amendment
- **agentId**: pm
- **role**: product-manager
- **createdAt**: 2026-05-19T13:50:00

---

## 2. 问题

PM 在审阅 `task-object-interface.md` 和 `event-object-interface.md` 时，发现 **4 处接口细节未定义或定义不完整**，Developer 无法依此编码。需 Architect 补充修正后重新输出 `[ARCH_READY]`。

| ID | 问题 | 位置 | 严重度 | 状态 |
|----|------|------|--------|------|
| A1 | `task.update` 的 `attribution` 参数缺少 `deviationIds`，无法精确关联指定偏差 | `task-object-interface.md` 4.5 节 | 🔴 阻塞 | ⏳ 待修正 |
| A2 | `task.update` 的 `outcome` 合并策略未定义，Developer 不知道数组字段是替换还是追加 | `task-object-interface.md` 4.5 节 | 🔴 阻塞 | ⏳ 待修正 |
| A3 | `deviation` / `attribution` 的 `id` 生成规则未定义 | `task-object-interface.md` 全文 | 🟡 中 | ⏳ 待修正 |
| A4 | `event.record` 与 `task.archive` 调用顺序未约定，且 `EventObject.generate` 未说明是否扫描 `archive/` 目录容错 | `event-object-interface.md` + `roadmap/v4.3.0.md` | 🟡 中 | ⏳ 待修正 |

---

## 3. 待解决

### A1：attribution 精确关联偏差

**现状**：`UpdateParams.attribution` 无 `deviationIds` 字段，默认"标记所有未归因偏差为已归因"。

**场景**：Agent 一次分析可能只归因 1~2 条偏差，而非全部。

**PM 需求**：Architect 补充 `deviationIds?: string[]` 可选字段，并更新业务规则：

```typescript
attribution?: {
  rootCause: string;
  strategy: string;
  impact?: string;
  deviationIds?: string[];   // ← 新增
};
```

- **不提供 `deviationIds`** → 默认标记所有未归因偏差
- **提供 `deviationIds`** → 只标记指定 ID 的偏差为已归因

---

### A2：outcome 合并策略

**现状**： specs 写"合并到 `task.outcome`"，但未定义合并规则。

**PM 需求**：Architect 明确 outcome 的合并策略为**浅合并**（shallow merge）：

```javascript
task.outcome = { ...task.outcome, ...params.outcome };
```

| 旧值 | 新传入 | 结果 |
|------|--------|------|
| `{ summary: 'A' }` | `{ summary: 'B' }` | `{ summary: 'B' }` |
| `{ summary: 'A' }` | `{ deliverables: ['X'] }` | `{ summary: 'A', deliverables: ['X'] }` |
| `{ deliverables: ['A'] }` | `{ deliverables: ['B'] }` | `{ deliverables: ['B'] }` |

**数组字段 `deliverables` 直接替换，不追加。**

---

### A3：deviation / attribution ID 生成规则

**现状**：全文未定义 `deviation.id` 和 `attribution.id` 的生成规则。

**PM 需求**：Architect 在 specs 中补充 ID 生成规则：

```javascript
// deviation id
`dev-${timestamp}-${random4}`   // 例: dev-1716096000000-a3f7

// attribution id
`attr-${timestamp}-${random4}`  // 例: attr-1716096000000-b8e2
```

- `timestamp` = `Date.now()`
- `random4` = 4 位十六进制随机字符串（`Math.random().toString(16).slice(2, 6)`），防止同一毫秒冲突

---

### A4：event.record 与 task.archive 调用顺序

**现状**：roadmap 工作流写"先 archive 再 event.record"，但如果 task.json 被 archive 移动，event.generate 无法读取。

**PM 需求**：Architect 在 `event-object-interface.md` 中补充以下约定：

1. **推荐调用顺序**：`event.record` **先于** `task.archive`
2. **容错扫描**：`EventObject.generate(runId)` 应同时扫描以下两个路径：
   - `.agent/tasks/{runId}.json`
   - `.agent/tasks/archive/{runId}.json`
   - 无论调用顺序如何，都能找到 task.json

---

## 4. 建议

| ID | 建议 | 优先级 | 状态 |
|----|------|--------|------|
| S1 | 在 `task-object-interface.md` 顶部增加「变更日志」小节，记录 v4.3.0 相比 v4.2.0 的接口变化 | 🟢 低 | 待 Architect 决定 |
| S2 | `UpdateResult.updatedFields` 在同时更新多个字段时，返回完整字段列表（如 `['status', 'deviations', 'attributions']`） | 🟢 低 | 待 Architect 决定 |

---

## 5. 结果

**状态**：⏳ 等待 Architect 修正

**阻塞影响**：A1/A2 为阻塞项，Developer 无法编写 `task.update` 的 Tool Handler 逻辑。

**Architect 行动**：
1. 修改 `docs/specs/task-object-interface.md` — 补充 A1/A2/A3
2. 修改 `docs/specs/event-object-interface.md` — 补充 A4
3. 重新输出 `[ARCH_READY]`
4. 通过 `.agent/sessions/` 回复 PM

---

*事件创建：PM*  
*日期：2026-05-19*  
*`[PM_REVIEW]`*
