# PM → Architect：specs/ 文档与代码实现不同步

> **事件类型**：doc-sync
> **来源**：PM
> **目标角色**：Architect
> **日期**：2026-05-19
> **关联文档**：
> - `docs/specs/tool-registry-interface.md`
> - `docs/specs/event-object-interface.md`
> - `docs/specs/task-object-interface.md`
> - `src/tools/index.js`
> - `src/tools/schemas.js`

---

## 1. 问题（Issues）

Developer 已完成 M1/M2 代码实现，PM 同步更新了 `docs/reference/` 全部技术参考文档。在 cross-check 过程中发现 `docs/specs/` 下 3 份接口规范与代码实现存在不一致，需 Architect 更新。

| ID | 问题描述 | 严重度 | 位置 |
|----|---------|--------|------|
| I1 | tool-registry-interface.md 声明"6 个工具"，代码实际注册 8 个 | 🟡 中 | `docs/specs/tool-registry-interface.md` L16, L46 |
| I2 | event-object-interface.md 声明"1 个事件报告业务函数"，实际有 3 个 | 🟡 中 | `docs/specs/event-object-interface.md` L17, L38-40 |
| I3 | task-object-interface.md PhaseInput 含 tools/skills 字段，代码 schema 中不存在 | 🟢 低 | `docs/specs/task-object-interface.md` L74-75 |
| I4 | event-object-interface.md 归档路径写为 `tasks/archive/`，实际为 `archive/tasks/` | 🟢 低 | `docs/specs/event-object-interface.md` L74 |

---

## 2. 决策（Decisions）

**D1：以代码实现为准**
- 代码是已冻结的实现，specs 应向后对齐
- 8 个工具（task 5 + event 3）是 Developer 按扁平架构完成的标准交付

**D2：specs 更新范围**
- tool-registry-interface.md：更新工具数量为 8，补全 event.query / event.archive 定义
- event-object-interface.md：更新为 3 个函数，修正归档路径
- task-object-interface.md：移除 PhaseInput 中不存在的 tools/skills 字段（若代码 schema 为准）

---

## 3. 行动项（Action Items）

| ID | 任务 | 负责人 | 优先级 | 状态 |
|----|------|--------|--------|------|
| A1 | 更新 tool-registry-interface.md（8 工具 + event.query/archive） | Architect | P1 | ⏳ 待处理 |
| A2 | 更新 event-object-interface.md（3 函数 + 路径修正） | Architect | P1 | ⏳ 待处理 |
| A3 | 确认 task-object-interface.md PhaseInput 字段（tools/skills 保留或删除） | Architect | P2 | ⏳ 待处理 |

---

## 4. 附：代码与 specs 差异详情

### 工具数量差异

**specs 声明（tool-registry-interface.md L16）：**
> 本规范定义 6 个工具的注册方式和 handler 契约。

**代码实际（src/tools/index.js）：**
```javascript
const HANDLER_MAP = {
  'task.create': handlers.create,
  'task.update': handlers.update,
  'task.advance': handlers.advance,
  'task.get': handlers.get,
  'task.archive': handlers.archive,
  'event.report': handlers.report,
  'event.query': handlers.query,
  'event.archive': handlers.archiveEvent
};
```

### event 函数数量差异

**specs 声明（event-object-interface.md L17）：**
> 本规范定义 1 个事件报告业务函数的接口契约（`query` 和 `archive` 为辅助功能）。

**代码实际（src/objects/event.js）：**
```javascript
export async function report(params, context)
export async function query(params, context)
export async function archive(params, context)
```

### PhaseInput 字段差异

**specs 声明（task-object-interface.md L74-75）：**
```typescript
interface PhaseInput {
  // ...
  tools?: string[];
  skills?: string[];
}
```

**代码实际（src/tools/schemas.js task.create parameters）：**
```javascript
phases: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      goal: { type: 'string' },
      outputs: { type: 'array', items: { type: 'string' } },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }
    }
  }
}
```

代码 schema 中 `phases[].tools` 和 `phases[].skills` 不存在。

---

*PM 发送*
*2026-05-19 15:00:00*
