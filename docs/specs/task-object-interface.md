# TaskObject 接口规范

> **版本**：v4.3.0  
> **范围**：`src/objects/TaskObject.js`  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-19  
> **关联文档**：`docs/roadmap/v4.3.0.md`、`docs/architecture/adr-010.md`

---

## 1. 概述

TaskObject 是项目级 `task.json` 的**唯一写入者**，负责任务全生命周期的业务规则、数据校验和状态机管理。

**职责边界**：
- TaskObject = 业务规则 + 生命周期编排 + 数据校验
- `utils/file.js` = 原始 JSON 原子读写（纯 IO）

---

## 2. 依赖注入

```typescript
interface TaskObjectDeps {
  projectRoot: string;           // 项目根目录绝对路径
  taskSchema?: object;           // 可选：assets/task.json 加载后的 schema
  logger?: Logger;               // 可选：OpenClaw api.logger
}
```

**注意**：v4.3.0 移除 `state` adapter 依赖，改为直接通过 `utils/file.js` 读写项目级文件。

---

## 3. 类定义

```typescript
class TaskObject {
  constructor(deps: TaskObjectDeps);

  // ── 核心生命周期 ──
  async create(params: CreateParams): Promise<CreateResult>;
  async get(runId: string): Promise<GetResult>;
  async update(params: UpdateParams): Promise<UpdateResult>;
  async advance(params: AdvanceParams): Promise<AdvanceResult>;
  async archive(runId: string): Promise<ArchiveResult>;

  // ── 偏差/归因/结果（v4.3.0 新增）──
  async recordDeviation(runId: string, data: DeviationData): Promise<RecordDeviationResult>;
  async recordAttribution(runId: string, data: AttributionData): Promise<RecordAttributionResult>;
  async setOutcome(runId: string, data: OutcomeData): Promise<SetOutcomeResult>;
  async linkEventFile(runId: string, eventFilePath: string): Promise<LinkEventFileResult>;

  // ── 校验 ──
  validate(task: Task): ValidationResult;
}
```

---

## 4. 核心生命周期方法

### 4.1 create

创建 draft task。

**输入**：

```typescript
interface CreateParams {
  runId: string;                 // 必填，任务唯一标识
  prompt: string;                // 必填，用户原始输入
  taskType?: 'coding' | 'research' | 'documentation'; // 可选，默认 undefined
  plan?: {
    goal?: string;
    constraints?: string[];
    successCriteria?: string[];
    phases?: PhaseInput[];       // 若提供，直接采用；否则自动生成
  };
}

interface PhaseInput {
  id?: string;                   // 可选，默认 "p{index+1}"
  name: string;
  goal?: string;
  outputs?: string[];
  status?: 'pending' | 'in_progress' | 'completed'; // 默认 'pending'
  tools?: string[];
  skills?: string[];
}
```

**输出**：

```typescript
interface CreateResult {
  task: Task;                    // 完整的 task 对象
}

// 错误时返回
interface CreateError {
  error: string;
  errors?: string[];             // 参数校验错误列表
}
```

**业务规则**：
- `runId` 只允许字母、数字、下划线、连字符（`^[a-zA-Z0-9_-]+$`）
- `prompt` 必填且非空
- 若 `runId` 已存在，返回错误 `task 已存在: {runId}`
- 若未提供 `plan.phases`，根据 `prompt` 关键词自动生成 6 阶段模板
- 写入路径：`{projectRoot}/.agent/tasks/{runId}.json`

---

### 4.2 get

查询 task 完整状态。

**输入**：`runId: string`

**输出**：

```typescript
interface GetResult {
  task: Task | null;             // null 表示 task 不存在
}
```

**读取路径**：`{projectRoot}/.agent/tasks/{runId}.json`  
**归档读取路径**：`{projectRoot}/.agent/tasks/archive/{runId}.json`（若活跃目录不存在）

---

### 4.3 update

通用更新接口。支持状态更新、偏差记录、归因记录、结果设置、event.md 路径关联的任意组合。

**输入**：

```typescript
interface UpdateParams {
  runId: string;                 // 必填

  // 状态更新（可选）
  status?: 'draft' | 'pending_approval' | 'active' | 'revising' | 'completed';
  reason?: string;               // 状态变更原因

  // 偏差记录（可选，v4.3.0 新增）
  deviation?: {
    type: string;
    description: string;
    impact?: string;
  };

  // 归因记录（可选，v4.3.0 新增）
  attribution?: {
    rootCause: string;
    strategy: string;
    impact?: string;
    deviationIds?: string[];       // 精确关联指定偏差；不提供则标记全部未归因偏差
  };

  // 结果设置（可选，v4.3.0 新增）
  outcome?: {
    summary?: string;
    deliverables?: string[];
    lessonsLearned?: string;
  };

  // event.md 路径关联（可选，v4.3.0 新增）
  eventFilePath?: string;
}
```

**输出**：

```typescript
interface UpdateResult {
  task: Task;
  updatedFields: string[];       // 实际更新的字段列表，如 ['status', 'deviations']
}

// 错误时返回
interface UpdateError {
  error: string;
}
```

**业务规则**：
- 至少提供一个可选字段（status / deviation / attribution / outcome / eventFilePath），否则返回错误
- `status` 变更需通过状态机校验（见 4.3.1）
- `deviation` 传入时：追加到 `task.deviations[]`，id 按 `dev-${timestamp}-${random4}` 生成，自动设置 `updatedAt`
- `attribution` 传入时：追加到 `task.attributions[]`，id 按 `attr-${timestamp}-${random4}` 生成
  - 提供 `deviationIds`：只标记指定 ID 且未归因的偏差
  - 未提供 `deviationIds`：标记所有 `attributed === false` 的偏差
  - 自动设置 `updatedAt`
- `outcome` 传入时：浅合并到 `task.outcome`（`{ ...task.outcome, ...params.outcome }`），`deliverables` 数组直接替换不追加，自动设置 `updatedAt`
- `eventFilePath` 传入时：写入 `task.eventFilePath`，自动设置 `updatedAt`

#### 4.3.1 状态机

```
draft ──────────→ pending_approval ───────→ active ─────────→ completed
     │                  │                    │
     │                  ↓ revising           ↓ revising
     └──────────────────┘                    │
                                              │
           revising ──────→ draft ────────────┘
```

| 当前状态 | 允许的新状态 |
|----------|-------------|
| `draft` | `pending_approval`, `completed` |
| `pending_approval` | `active`, `revising`, `completed` |
| `active` | `revising`, `completed` |
| `revising` | `draft` |
| `completed` | （无） |

非法状态转换返回错误：`不允许从 {current} 转换到 {target}`

---

### 4.4 advance

推进 task 阶段。

**输入**：

```typescript
interface AdvanceParams {
  runId: string;                 // 必填
  phaseId?: string;              // 可选，指定阶段 ID；默认推进到下一阶段
}
```

**输出**：

```typescript
interface AdvanceResult {
  task: Task;
  previousPhase: number;         // 推进前的阶段索引
  nextPhase: number;             // 推进后的阶段索引
  isComplete: boolean;           // 是否所有阶段已完成
}

// 错误时返回
interface AdvanceError {
  error: string;
}
```

**业务规则**：
- 若 `phaseId` 提供：找到对应索引，将该索引及之前所有阶段标记为 `completed`
- 若 `phaseId` 未提供：将当前阶段标记为 `completed`，`currentPhase++`
- 若 `nextPhase >= phases.length`：设置 `task.status = 'completed'`
- 写入路径：`{projectRoot}/.agent/tasks/{runId}.json`

---

### 4.5 archive

归档 completed task。

**输入**：`runId: string`

**输出**：

```typescript
interface ArchiveResult {
  archived: boolean;
  archivedAt: string;            // ISO-8601 时间戳
  archivedPath: string;          // 归档后的文件路径
}

// 错误时返回
interface ArchiveError {
  error: string;                 // "task 不存在" / "task 状态不是 completed" / "归档失败"
}
```

**业务规则**：
- 仅允许归档 `status === 'completed'` 的 task
- 原子操作：读取 → 移动到 archive/ → 删除原文件
- 源路径：`{projectRoot}/.agent/tasks/{runId}.json`
- 目标路径：`{projectRoot}/.agent/tasks/archive/{runId}.json`
- 若 archive/ 目录不存在，自动创建

---

## 5. 偏差/归因/结果方法（v4.3.0 新增）

以下方法为 `update()` 的内部路由方法，也可被 Tool Handler 直接调用。

### 5.1 recordDeviation

追加偏差记录到 `task.deviations[]`。

**输入**：

```typescript
interface DeviationData {
  type: string;                  // 偏差类型，如 "scope_creep", "technical_debt"
  description: string;           // 偏差描述
  impact?: string;               // 影响评估
}
```

**输出**：

```typescript
interface RecordDeviationResult {
  deviation: {
    id: string;                  // 自动生成：dev-{timestamp}
    type: string;
    description: string;
    impact: string;
    timestamp: number;           // Date.now()
    attributed: false;           // 初始为未归因
  };
  task: Task;
}
```

---

### 5.2 recordAttribution

追加归因记录到 `task.attributions[]`，并标记未归因偏差为已归因。

**输入**：

```typescript
interface AttributionData {
  rootCause: string;             // 根本原因
  strategy: string;              // 改进策略
  impact?: string;               // 影响范围
  deviationIds?: string[];       // 精确关联指定偏差 ID；不提供则默认标记全部未归因偏差
}
```

**输出**：

```typescript
interface RecordAttributionResult {
  attribution: {
    id: string;                  // 自动生成：attr-{timestamp}
    rootCause: string;
    strategy: string;
    impact: string;
    timestamp: number;
  };
  updatedDeviations: number;     // 被标记为已归因的偏差数量
  task: Task;
}
```

**业务规则**：
- 若传入 `deviationIds`：遍历 `task.deviations`，将 `id` 在列表中且 `attributed === false` 的条目标记为 `attributed = true`，并设置 `attributionId`
- 若未传入 `deviationIds`：遍历 `task.deviations`，将所有 `attributed === false` 的条目标记为 `attributed = true`，并设置 `attributionId`
- 返回实际被标记的偏差数量

---

### 5.3 setOutcome

设置任务最终结果。采用**浅合并**策略。

**输入**：

```typescript
interface OutcomeData {
  summary?: string;              // 任务总结
  deliverables?: string[];       // 产出物列表
  lessonsLearned?: string;       // 经验教训
}
```

**输出**：

```typescript
interface SetOutcomeResult {
  outcome: {
    summary?: string;
    deliverables?: string[];
    lessonsLearned?: string;
    setAt: number;               // Date.now()
  };
  task: Task;
}
```

---

### 5.4 linkEvent

关联 event.md 文件路径。

**输入**：`eventFilePath: string`

**输出**：

```typescript
interface LinkEventResult {
  eventFilePath: string;
  task: Task;
}
```

---

## 6. 校验方法

### 6.1 validate

校验 task 对象结构是否符合 schema。

**输入**：`task: Task`

**输出**：

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];              // 为空数组表示校验通过
}
```

**校验规则**：

| 字段 | 规则 |
|------|------|
| `runId` | 必填，字符串，匹配 `^[a-zA-Z0-9_-]+$` |
| `status` | 必填，枚举值：`draft`/`pending_approval`/`active`/`revising`/`completed` |
| `createdAt` | 必填，正整数时间戳 |
| `updatedAt` | 必填，整数，≥ `createdAt` |
| `plan.prompt` | 必填，非空字符串 |
| `plan.context` | 必填，对象 |
| `plan.workspace` | 必填，对象 |
| `plan.execution.phases` | 必填，非空数组 |
| `plan.execution.phases[i].id` | 必填，非空字符串 |
| `plan.execution.phases[i].name` | 必填，非空字符串 |
| `plan.execution.phases[i].status` | 必填，枚举：`pending`/`in_progress`/`completed` |
| `deviations` | 可选，若存在每项需含 `id`/`type`/`description`/`timestamp` |
| `attributions` | 可选，若存在每项需含 `id`/`rootCause`/`strategy`/`timestamp` |

---

## 7. Task 数据结构

```typescript
interface Task {
  runId: string;
  status: 'draft' | 'pending_approval' | 'active' | 'revising' | 'completed';
  taskType?: 'coding' | 'research' | 'documentation';
  createdAt: number;             // Date.now()
  updatedAt: number;             // Date.now()
  plan: {
    prompt: string;              // 前 500 字截断
    createdAt: number;
    context: {
      goal: string;
      constraints: string[];
      successCriteria: string[];
    };
    workspace: {
      artifacts: string[];
      tools: string[];
      skills: string[];
    };
    execution: {
      phases: Phase[];
      currentPhase: number;
    };
  };
  deviations: Deviation[];
  attributions: Attribution[];
  outcome: {
    summary?: string;
    deliverables?: string[];
    lessonsLearned?: string;
    setAt?: number;
  };
  eventFilePath: string;         // 关联的 event.md 路径
}

interface Phase {
  id: string;
  name: string;
  goal: string;
  outputs: string[];
  status: 'pending' | 'in_progress' | 'completed';
  tools: string[];
  skills: string[];
}

interface Deviation {
  id: string;
  type: string;
  description: string;
  impact: string;
  timestamp: number;
  attributed: boolean;
  attributionId?: string;
}

interface Attribution {
  id: string;
  rootCause: string;
  strategy: string;
  impact: string;
  timestamp: number;
}
```

---

## 8. 错误码

| 错误码 | 场景 | HTTP 类比 |
|--------|------|-----------|
| `task_not_found` | runId 不存在 | 404 |
| `task_already_exists` | create 时 runId 已存在 | 409 |
| `invalid_status_transition` | 状态机非法转换 | 400 |
| `invalid_params` | 参数校验失败 | 400 |
| `archive_failed` | 归档时 IO 错误 | 500 |
| `not_completed` | archive 时 status ≠ completed | 400 |

---

## 9. 文件路径映射

| 操作 | 活跃路径 | 归档路径 |
|------|---------|---------|
| create / get / update / advance | `{projectRoot}/.agent/tasks/{runId}.json` | — |
| archive | 从活跃路径移动 | `{projectRoot}/.agent/tasks/archive/{runId}.json` |

---

*文档版本：v2.0.0*  
*状态：[ARCH_READY]*  
*关联 ADR：ADR-010（项目级文件系统优先）*
