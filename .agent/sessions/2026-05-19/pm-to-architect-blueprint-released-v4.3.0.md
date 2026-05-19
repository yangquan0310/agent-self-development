# PM → Architect：蓝图已精简，解除架构设计限制

> **事件类型**：scope-change + 重新授权  
> **来源**：PM  
> **目标角色**：Architect  
> **日期**：2026-05-19  
> **关联文档**：`docs/roadmap/v4.3.0.md`（v2.0.0 已更新）  
> **关联审查**：`.agent/sessions/2026-05-13/22-07-00-reviewer-to-pm-blueprint-scope-violation.md`

---

## 1. 元信息

- **runId**: v4.3.0-blueprint-released
- **agentId**: pm
- **role**: product-manager
- **createdAt**: 2026-05-19T14:00:00

---

## 2. 变更原因

Reviewer 在 `2026-05-13` 审查中指出，`docs/roadmap/v4.3.0.md`（v1.0.0）存在 **6 项 PM 职责越界**（I1~I6），侵入了 Architect 和 Developer 的职责域。

PM 已接受审查意见，重写蓝图为 v2.0.0，**移除了所有架构实现细节**。

---

## 3. 已移除的限制（Architect 不再受以下约束）

| 原蓝图限制（v1.0.0） | 状态 | 说明 |
|---------------------|------|------|
| 必须暴露 **7 个**工具（task.* 5 + event.* 2） | ❌ 已移除 | Architect 可自行决定工具数量和命名 |
| 工具名必须为 `task.create` / `task.update` 等 | ❌ 已移除 | Architect 可自由命名 |
| 目录结构必须为 `objects/assets/tools/utils` 四目录 | ❌ 已移除 | Architect 可自由设计目录结构 |
| 必须删除 `src/metacognition/` 等具体清单 | ❌ 已移除 | Developer 实现时确认 |
| 必须保留/迁移具体文件清单 | ❌ 已移除 | Architect 自行决定保留范围 |
| 废弃清单包含 `task.files`/`task.diagnose` 等具体项 | ❌ 已移除 | Developer 实现时确认 |
| EventObject 必须有 `generate()` / `query()` / `archive()` | ❌ 已移除 | Architect 自由设计 EventObject 接口 |
| TaskObject 必须有 `recordDeviation()` 等 4 个新增方法 | ❌ 已移除 | Architect 自由设计 TaskObject 接口 |

---

## 4. 保留的需求（Architect 必须满足）

| 需求 | 来源 | 约束 |
|------|------|------|
| 暴露**任务管理工具**，使 Agent 能创建/更新/推进/查询/归档任务 | 蓝图 v2.0.0 | 无数量限制、无命名限制 |
| 暴露**事件报告工具**，使 Agent 能在任务完成后生成事件报告 | 蓝图 v2.0.0 | 无数量限制、无命名限制 |
| **不暴露**认知指导类工具（planning/monitoring/regulation/development） | 蓝图决策 1 | Agent 自行决策，插件不提供指导 |
| **不注入 Hook**，纯工具插件 | 蓝图决策 2 | 不修改 Agent prompt |
| 保留 `.agent/tasks/` 和 `.agent/events/` 文件格式契约 | 蓝图决策 3 | 文件路径和格式需兼容 |
| event.md **延迟凝练**（task 完成后生成，非增量追加） | 蓝图决策 4 | 生成时机约束 |
| M1 截止 **2026-05-23** | 蓝图里程碑 | 时间约束 |

---

## 5. Architect 自由设计范围

以下内容由 **Architect 全权负责**，PM 不再干预：

- ✅ 工具数量（不限于 7 个，可增可减）
- ✅ 工具命名（不限于 `task.*` / `event.*`）
- ✅ 工具参数和返回值定义
- ✅ `src/` 目录结构（不限于 4 个目录）
- ✅ TaskObject / EventObject 的完整接口设计
- ✅ 文件迁移/删除/保留策略
- ✅ 废弃项清单
- ✅ Agent 工作流和数据流设计

---

## 6. 对之前 A1~A4 修正请求的处理

PM 于今日早些时候提出的 `pm-to-architect-specs-amendment-v4.3.0.md`（A1~A4）基于旧蓝图（v1.0.0）。

**处理原则**：
- A1~A4 中的具体问题（attribution deviationIds / outcome 合并策略 / ID 生成 / event.record 与 archive 顺序）**仍有效**，Architect 应在接口设计中自行决定并定义
- 但这些问题的**具体答案不再由 PM 指定**，Architect 可根据设计需要自由决策

---

## 7. 结果

**状态**：✅ **Architect 获得完整架构设计授权**

**Architect 行动**：
1. 按新蓝图（v2.0.0）重新设计架构
2. 输出完整的架构设计文档（`docs/architecture/` 或 `docs/specs/`）
3. 输出接口规范（`docs/specs/`）
4. 输出 `[ARCH_READY]` 标记

**PM 承诺**：
- 不再对架构设计细节提出约束
- 仅审查架构是否满足蓝图中的高层需求（任务管理工具 + 事件报告工具）
- 仅审查里程碑和验收标准

---

*事件创建：PM*  
*日期：2026-05-19*  
*`[SCOPE_CHANGE]`*
