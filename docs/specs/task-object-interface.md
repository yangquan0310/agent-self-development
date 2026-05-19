# Task Handler 接口规范

> **版本**：v4.3.0  
> **范围**：`src/tools/handlers.js` 中任务管理相关函数  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-19  
> **关联 ADR**：`docs/adr/adr-014.md`（扁平化架构）  
> **关联文档**：`docs/roadmap/v4.3.0.md` v2.0.0

---

## 1. 概述

v4.3.0 采用扁平化架构：**Tool Handler 直接读写 `task.json`**，不引入 TaskObject 中间层。

本规范定义 5 个任务管理 Handler 的接口契约。

---

## 2. 依赖

```javascript
// Handler 通过 context 接收以下依赖
const context = {
  templates: { task: object },    // 加载后的 task.json 模板
  logger: Logger,                 // 可选：OpenClaw api.logger
  baseDir: string                 // 项目根目录绝对路径
};
```

Handler 内部通过 `utils/resolve.js` 解析路径，通过 `utils/io.js` 读写文件。

---

## 3. Handler 定义

```javascript
// 任务管理
export async function createTask(params, context)
export async function updateTask(params, context)
export async function advanceTask(params, context)
export async function getTask(params, context)
export async function archiveTask(params, context)
```

---

## 4. createTask

创建 draft task，写入 `.agent/tasks/{runId}.json`。

**输入**：

```typescript
interface CreateTaskParams {
  runId: string;                 // 必填，任务唯一标识（^[a-zA-Z0-9_-]+$）
  prompt: string;                // 必填，用户原始输入
  taskType?: 'coding' | 'research' | 'documentation';
  plan?: {
    goal?: string;
    constraints?: string[];
    successCriteria?: string[];
    phases?: PhaseInput[];       // 若提供直接采用，否则从模板生成
  };
}

interface PhaseInput {
  id?: string;                   // 默认 p{index+1}
  name: string;
  goal?: string;
  outputs?: string[];
  status?: 'pending' | 'in_progress' | 'completed';
  tools?: string[];
  skills?: string[];
}
```

**输出**：

```typescript
interface CreateTaskResult {
  task: Task;
}

interface CreateTaskError {
  error: string;
  errors?: string[];
}
```

**业务规则**：
- `runId` 只允许字母、数字、下划线、连字符
- `prompt` 必填且非空
- 若 `runId` 已存在，返回错误 `task 已存在: {runId}`
- 若未提供 `plan.phases`，从 `templates.task` 生成默认阶段
- 写入路径：`{baseDir}/.agent/tasks/{runId}.json`

---

## 5. updateTask

通用更新接口。支持状态更新、偏差记录、归因记录、结果设置、event.md 路径关联的任意组合。

**输入**：

```typescript
interface UpdateTaskParams {
  runId: string;                 // 必填

  // 状态更新
  status?: 'draft' | 'pending_approval' | 'active' | 'revising' | 'completed';
  reason?: string;               // 状态变更原因（日志用，不持久化到 task.json）

  // 偏差记录
  deviation?: {
    type: string;
    description: string;
    impact?: string;
  };

  // 归因记录
  attribution?: {
    rootCause: string;
    strategy: string;
    impact?: string;
    deviationIds?: string[];     // 精确关联指定偏差；不提供则标记全部未归因
  };

  // 结果设置
  outcome?: {
    summary?: string;
    deliverables?: string[];
    lessonsLearned?: string;
  };

  // event.md 关联
  eventFilePath?: string;
}
```

**输出**：

```typescript
interface UpdateTaskResult {
  task: Task;
  updatedFields: string[];       // 实际更新的字段列表
}

interface UpdateTaskError {
  error: string;
}
```

**业务规则**：
- 至少提供一个可选字段，否则返回错误
- `status` 变更需通过状态机校验（见 5.1）
- `deviation` 传入时：追加到 `task.deviations[]`，id 按 `dev-${timestamp}-${random4}` 生成
- `attribution` 传入时：
  - 追加到 `task.attributions[]`，id 按 `attr-${timestamp}-${random4}` 生成
  - 提供 `deviationIds`：只标记指定 ID 且未归因的偏差
  - 未提供 `deviationIds`：标记所有 `attributed === false` 的偏差
- `outcome` 传入时：浅合并 `task.outcome = { ...task.outcome, ...params.outcome }`，`deliverables` 替换不追加
- `eventFilePath` 传入时：写入 `task.eventFilePath`
- 任何写入自动刷新 `task.updatedAt = Date.now()`

### 5.1 状态机

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

---

## 6. advanceTask

推进 task 阶段。

**输入**：

```typescript
interface AdvanceTaskParams {
  runId: string;                 // 必填
  phaseId?: string;              // 可选，指定阶段 ID；默认推进到下一阶段
}
```

**输出**：

```typescript
interface AdvanceTaskResult {
  task: Task;
  previousPhase: number;
  nextPhase: number;
  isComplete: boolean;
}

interface AdvanceTaskError {
  error: string;
}
```

**业务规则**：
- 若 `phaseId` 提供：标记目标阶段及之前所有阶段为 `completed`
- 若 `phaseId` 未提供：标记当前阶段为 `completed`，`currentPhase++`
- 若 `nextPhase >= phases.length`：设置 `task.status = 'completed'`
- 写入原路径：`{baseDir}/.agent/tasks/{runId}.json`

---

## 7. getTask

查询 task 完整状态。

**输入**：`{ runId: string }`

**输出**：

```typescript
interface GetTaskResult {
  task: Task | null;             // null 表示 task 不存在
}
```

**读取路径**：
1. `{baseDir}/.agent/tasks/{runId}.json`
2. `{baseDir}/.agent/tasks/archive/{runId}.json`（若活跃目录不存在）

---

## 8. archiveTask

归档 completed task。

**输入**：`{ runId: string }`

**输出**：

```typescript
interface ArchiveTaskResult {
  archived: boolean;
  archivedAt: string;            // ISO-8601
  archivedPath: string;
}

interface ArchiveTaskError {
  error: string;
}
```

**业务规则**：
- 仅允许归档 `status === 'completed'` 的 task
- 源路径：`{baseDir}/.agent/tasks/{runId}.json`
- 目标路径：`{baseDir}/.agent/tasks/archive/{runId}.json`
- 若 archive/ 目录不存在，自动创建

---

## 9. Task 数据结构

```typescript
interface Task {
  runId: string;
  status: 'draft' | 'pending_approval' | 'active' | 'revising' | 'completed';
  taskType?: 'coding' | 'research' | 'documentation';
  createdAt: number;
  updatedAt: number;
  plan: {
    prompt: string;
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
  };
  eventFilePath: string;
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
  id: string;                    // dev-${timestamp}-${random4}
  type: string;
  description: string;
  impact: string;
  timestamp: number;
  attributed: boolean;
  attributionId?: string;
}

interface Attribution {
  id: string;                    // attr-${timestamp}-${random4}
  rootCause: string;
  strategy: string;
  impact: string;
  timestamp: number;
}
```

---

## 10. 错误码

| 错误码 | 场景 |
|--------|------|
| `task_not_found` | runId 不存在 |
| `task_already_exists` | create 时 runId 已存在 |
| `invalid_status_transition` | 状态机非法转换 |
| `invalid_params` | 参数校验失败 |
| `archive_failed` | 归档时 IO 错误 |
| `not_completed` | archive 时 status ≠ completed |

---

## 11. 文件路径映射

| 操作 | 活跃路径 | 归档路径 |
|------|---------|---------|
| create / get / update / advance | `{baseDir}/.agent/tasks/{runId}.json` | — |
| archive | 从活跃路径移动 | `{baseDir}/.agent/tasks/archive/{runId}.json` |

---

*文档版本：v3.0.0*  
*状态：[ARCH_READY]*  
*关联 ADR：ADR-014（扁平化架构）*
