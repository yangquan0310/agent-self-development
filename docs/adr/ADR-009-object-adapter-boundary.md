# ADR-009: Object-Adapter Boundary Clarification

> **ADR 编号**：009  
> **标题**：对象层与适配器层的职责边界  
> **状态**：⚠️ 部分过时（Partially Deprecated）  
> **日期**：2026-05-19  
> **作者**：Architect  
> **影响范围**：src/objects/, src/common/adapters/, src/metacognition/, src/working-memory/

> **⚠️ 状态说明**：
> - **仍有效**：「State 降级为纯 IO」概念（但实现从 adapters/ 改为 utils/file.js）
> - **已作废**：「Plan 类委托模式」「Event 类委托模式」「保留 adapter 层」等章节
> - **替代文档**：`docs/architecture/adr-010.md`（项目级文件系统优先）

---

## 1. 背景与动机

v4.1.0 ~ v4.2.0 架构评估识别出以下结构性问题：

- **RISK-4**：State.task 有 Tool Handler + Hook Parser 两个写入者，存在竞态条件
- **RISK-6**：Flow 数据库与 Task JSON 维护同构数据，职责模糊
- 代码走读发现：多个模块通过 `State` 实例隐式共享同一套 JSON 文件，形成「隐式共享内存」耦合

v4.3.0 引入 **TaskObject** 和 **EventObject** 两个核心对象后，必须明确：
1. Object 层与 Adapter 层的边界在哪里？
2. 现有 Plan / Event / Session 等类如何与 Object 层共存？
3. Flow 的职责是否需要重新定义？

---

## 2. 决策

### 2.1 核心决策：Object 层拥有业务规则，Adapter 层只负责原始 IO

| 层级 | 职责 | 示例 |
|------|------|------|
| **Object 层** | 业务规则、生命周期编排、数据校验、状态机 | TaskObject.validate(), TaskObject.archive()（含清理逻辑） |
| **Adapter 层** | 原始 JSON/SQLite 读写、路径解析、原子写 | State.readJson(), State.writeJsonAtomic() |

### 2.2 具体边界划分

#### State Adapter → 纯 IO

**移除的业务逻辑**：
- `saveTask(runId, task)` 中的 `updatedAt` 自动更新 → 由 TaskObject 负责
- `archiveTask(runId)` 中的「状态校验 + 文件移动 + 旧归档清理」 → 由 TaskObject 负责
- `saveTask()` 中的 API fallback (`this.api?.set`) → v4.3.0 移除，Object 层直接使用文件系统

**保留的能力**：
- `readJson(path)` / `writeJsonAtomic(path, data)` — 纯 IO
- `listJson(dir)` / `deleteJson(path)` / `exists(path)` — 纯 IO
- Session 相关方法（`saveSession`, `getSession` 等）— 暂不改动（RISK-5 在 P2 处理）

#### TaskObject → task.json 唯一写入者

TaskObject 通过组合 State adapter 实现业务逻辑：

```javascript
class TaskObject {
  constructor({ state, logger, log, caseIndex, taskSchema }) {
    this.state = state;        // IO 依赖
    this.taskSchema = taskSchema;  // 校验基准
  }

  async create(params) {
    const task = this._buildTask(params);
    const validation = this.validate(task);
    if (!validation.valid) throw new ValidationError(validation.errors);
    
    await this.state.writeJsonAtomic(
      this._taskFile(params.runId), 
      task
    );
    return { task };
  }
}
```

#### EventObject → event.md 唯一写入者

EventObject 直接操作文件系统（通过 `fs` 和 `project-context.js`），不经过 State adapter：
- `event.md` 是项目级文件（`.agent/events/...`），不是系统级 state
- EventObject 使用「章节切片」追加策略，需要原始 Markdown 操作能力

#### Flow Adapter → 职责冻结，v4.4.0 重新评估

**决策**：v4.3.0 中 Flow adapter **冻结变更**，保持现状，但所有 Plan/Heartbeat 等模块不再新增 Flow 写入。

**理由**：
- Flow 当前与 Task JSON 维护同构数据（`currentStep` vs `currentPhase`）
- 在 Flow 完成核心职责定义前，不做结构性改动
- v4.3.0 的重心是「对象边界清晰」，Flow 的重新定义留给后续版本（RISK-6 闭环）

**冻结期间规则**：
- 不允许新增模块写入 Flow
- 现有 Flow 写入代码保留但不扩展
- v4.4.0 必须召开 Flow 职责专题会议

#### Plan 类 → 委托给 TaskObject（薄包装），v4.4.0 移除

**v4.3.0**：Plan 类保留但改为委托模式，所有方法转发给 TaskObject。

```javascript
class Plan {
  constructor(state, flow, taskObject) {
    this.taskObject = taskObject;
  }
  async createPlan(prompt) {
    return this.taskObject.create({ runId: randomUUID(), prompt });
  }
  // ... 其他方法同理
}
```

**v4.4.0**：移除 Plan 类，调用方直接使用 TaskObject。

#### Event 类 → 拆分为 EventObject（项目级）+ MemoryArchive（系统级）

| 类 | 职责 | 存储位置 |
|----|------|----------|
| **EventObject** | 项目级 `event.md` 的创建、追加、查询、归档 | `.agent/events/*.md` |
| **MemoryArchive**（原 Event 类改名） | 系统级 EventLog 的归档和查询 | `~/.agent/memory/{agentId}.sqlite` |

---

## 3. 影响分析

### 3.1 正面影响

| 影响 | 说明 |
|------|------|
| 根治 RISK-4 | TaskObject 为 task.json 唯一写入者，Hook 层只读观察，消除竞态 |
| 根治「隐式共享内存」 | 不再有多模块通过 State 实例间接竞争同一文件 |
| 测试隔离性提升 | Object 层可 mock State adapter，单元测试无需文件系统 |
| 代码内聚性提升 | 业务规则集中在 Object 层，IO 细节集中在 Adapter 层 |

### 3.2 负面影响与成本

| 影响 | 缓解措施 |
|------|----------|
| Plan 类委托引入一层间接调用 | Plan 类在 v4.3.0 为薄包装（< 20 行），性能影响可忽略；v4.4.0 移除 |
| State 降级需要修改所有调用方 | 集中在 M1 完成，通过编译时/测试时检查确保无遗漏 |
| EventObject 直接操作 fs（不经过 State） | EventObject 使用 project-context.js 统一路径解析，路径变更仍只需改一处 |

### 3.3 兼容性影响

| 模块 | 影响 | 处理方案 |
|------|------|----------|
| `src/tools/metacognition-tools.js` | 不再直接调用 `state.saveTask()` | 改为调用 `taskObject.update()` |
| `src/tools/working-memory-tools.js` | 不再直接调用 `state.getTask()` | 改为调用 `taskObject.get()` |
| `src/metacognition/module.js` | `_parseToolCallResult` 不再写入 State | 改为只读校验，或移除 |
| `src/working-memory/module.js` | 不再直接写入 State | 改为只读观察 |

---

## 4. 替代方案

### 替代方案 A：保留 State 业务逻辑，增加读写锁

- **描述**：State adapter 保留 `archiveTask` 等业务方法，增加文件级读写锁
- **拒绝理由**：没有根治「多写入者」问题，只是降低了竞态概率；增加了锁管理的复杂度；不符合单一职责原则

### 替代方案 B：State 升级为 Repository 模式

- **描述**：State 改名为 TaskRepository，封装所有 CRUD + 查询 + 归档
- **拒绝理由**：与 TaskObject 职责重叠，会形成「两个业务层」的混乱；Repository 更适合关系型数据，不适合 JSON 文件模型

### 替代方案 C：Object 层直接操作 fs，不经过 State

- **描述**：TaskObject 自己调用 `fs.writeFile()`
- **拒绝理由**：失去 IO 抽象，测试困难；路径管理分散，违背 DRY

---

## 5. 实施计划

| 阶段 | 任务 | 验收标准 |
|------|------|----------|
| 1 | State 降级为纯 IO | `saveTask`/`getTask`/`archiveTask` 移除；新增 `readJson`/`writeJsonAtomic`/`listJson`/`deleteJson`；grep 无残留 |
| 2 | TaskObject 实现 | 6 个方法 + validate；单元测试 ≥ 12 用例通过 |
| 3 | EventObject 实现 | 4 个方法；单元测试 ≥ 10 用例通过；章节追加策略验证 |
| 4 | Plan 类委托改造 | Plan 类 < 50 行，全部方法转发给 TaskObject；v4.2.0 测试基线通过 |
| 5 | Event 类拆分为 MemoryArchive | 系统级 EventLog 功能保留；项目级 event.md 操作迁移到 EventObject |
| 6 | Tool Handler 委托重构 | 不再直接操作 adapters；通过 TaskObject / EventObject 委托；代码量减少 ≥ 30% |

---

## 6. 相关 ADR

| ADR | 关系 | 说明 |
|-----|------|------|
| ADR-004 | 前置 | Tool Handler 为状态更新唯一写入者（Hook 只读）— v4.2.0 已实施，本 ADR 将其固化到 Object 层 |
| ADR-006 | 后置 | Flow 职责重新定义 — v4.3.0 冻结 Flow，v4.4.0 依据本 ADR 的边界划分重新定义 Flow |
| ADR-007 | 协同 | ProjectContext 路径常量模块 — EventObject 直接操作 fs 时使用 ProjectContext 统一路径 |

---

## 7. 结论

本 ADR 确立了 v4.3.0 的核心边界原则：

> **Object 层拥有业务规则和数据所有权，Adapter 层只负责原始 IO。**

这一边界确保：
- TaskObject 是 task.json 的唯一写入者
- EventObject 是 event.md 的唯一写入者
- State adapter 是纯粹的 IO 抽象，不参与业务决策
- Flow 在 v4.3.0 冻结，等待 v4.4.0 的专项重新定义

---

*文档版本：v1.0.0*  
*维护者：Architect*  
*最后更新：2026-05-19*  
*[ADR]*
