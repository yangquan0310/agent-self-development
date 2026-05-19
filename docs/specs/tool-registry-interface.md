# Tool Registry 接口规范

> **版本**：v4.3.0  
> **范围**：`src/tools/` + `src/index.js`（registerTools）  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-19  
> **关联文档**：`docs/roadmap/v4.3.0.md`、`docs/architecture/adr-012.md`

---

## 1. 概述

Tool Registry 负责将 7 个 namespace 工具注册到 OpenClaw 运行时，并提供统一的返回值适配。

**工具清单**：

| 命名空间 | 工具名 | 目标对象 | 方法 |
|----------|--------|----------|------|
| `task` | `task.create` | TaskObject | `create()` |
| `task` | `task.update` | TaskObject | `update()` |
| `task` | `task.advance` | TaskObject | `advance()` |
| `task` | `task.query` | TaskObject | `get()` |
| `task` | `task.archive` | TaskObject | `archive()` |
| `event` | `event.record` | EventObject | `generate()` |
| `event` | `event.query` | EventObject | `query()` |

**v4.3.0 变更**：
- 从 13 个工具精简为 7 个
- 删除：metacognition、workingMemory、personality、heartbeat 相关工具
- 新增：task.archive、event.record、event.query
- 返回值统一适配（ADR-012）

---

## 2. 注册接口

### 2.1 registerTools

```typescript
function registerTools(api: OpenClawAPI, deps: RegistryDeps): void;

interface RegistryDeps {
  taskObject: TaskObject;        // 已实例化的 TaskObject
  eventObject: EventObject;      // 已实例化的 EventObject
  logger?: Logger;               // 可选
}

interface OpenClawAPI {
  registerTool(spec: ToolSpec): void;
  logger?: Logger;
}

interface ToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: any) => Promise<any>;
}
```

**注册逻辑**：
1. 遍历 7 个工具定义
2. 对每个工具调用 `api.registerTool({ name, description, parameters, execute })`
3. `execute` 函数内部调用 `adaptReturn()` 或 `adaptError()` 包装返回值

---

## 3. 工具详细定义

### 3.1 task.create

```json
{
  "name": "task.create",
  "description": "创建一个新的任务草案。根据用户输入生成任务计划和阶段。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "任务唯一标识，只允许字母、数字、下划线、连字符"
      },
      "prompt": {
        "type": "string",
        "description": "用户原始输入/需求描述"
      },
      "taskType": {
        "type": "string",
        "enum": ["coding", "research", "documentation"],
        "description": "任务类型（可选）"
      }
    },
    "required": ["runId", "prompt"]
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  const result = await taskObject.create(args);
  return adaptReturn(result);
}
```

**错误处理**：`adaptError(error)`

---

### 3.2 task.update

```json
{
  "name": "task.update",
  "description": "更新任务状态、记录偏差、归因、结果或关联 event.md 文件。至少提供一个可选字段。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "任务唯一标识"
      },
      "status": {
        "type": "string",
        "enum": ["draft", "pending_approval", "active", "revising", "completed"],
        "description": "新状态（可选）"
      },
      "reason": {
        "type": "string",
        "description": "状态变更原因（当 status 变更时建议提供）"
      },
      "deviation": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "description": "偏差类型" },
          "description": { "type": "string", "description": "偏差描述" },
          "impact": { "type": "string", "description": "影响评估" }
        },
        "required": ["type", "description"]
      },
      "attribution": {
        "type": "object",
        "properties": {
          "rootCause": { "type": "string", "description": "根本原因" },
          "strategy": { "type": "string", "description": "改进策略" },
          "impact": { "type": "string", "description": "影响范围" }
        },
        "required": ["rootCause", "strategy"]
      },
      "outcome": {
        "type": "object",
        "properties": {
          "summary": { "type": "string" },
          "deliverables": {
            "type": "array",
            "items": { "type": "string" }
          },
          "lessonsLearned": { "type": "string" }
        }
      },
      "eventFilePath": {
        "type": "string",
        "description": "关联的 event.md 文件路径"
      }
    },
    "required": ["runId"]
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  const result = await taskObject.update(args);
  return adaptReturn(result);
}
```

**特殊路由**：若同时传入多个可选字段（如 `status` + `deviation`），TaskObject.update() 内部按顺序处理：
1. `status` → 状态机校验
2. `deviation` → 追加偏差
3. `attribution` → 追加归因 + 标记偏差
4. `outcome` → 设置结果
5. `eventFilePath` → 关联事件文件

---

### 3.3 task.advance

```json
{
  "name": "task.advance",
  "description": "推进任务到下一阶段，或标记指定阶段为已完成。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "任务唯一标识"
      },
      "phaseId": {
        "type": "string",
        "description": "指定阶段 ID（可选，默认推进到下一阶段）"
      }
    },
    "required": ["runId"]
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  const result = await taskObject.advance(args);
  return adaptReturn(result);
}
```

---

### 3.4 task.query

```json
{
  "name": "task.query",
  "description": "查询任务完整状态。支持从活跃目录或归档目录读取。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "任务唯一标识"
      }
    },
    "required": ["runId"]
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  const result = await taskObject.get(args.runId);
  if (!result.task) {
    return adaptError(new Error(`task 不存在: ${args.runId}`));
  }
  return adaptReturn(result);
}
```

---

### 3.5 task.archive

```json
{
  "name": "task.archive",
  "description": "归档已完成的任务。仅允许归档 status=completed 的任务。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "任务唯一标识"
      }
    },
    "required": ["runId"]
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  const result = await taskObject.archive(args.runId);
  return adaptReturn(result);
}
```

---

### 3.6 event.record

```json
{
  "name": "event.record",
  "description": "为已完成的任务生成 event.md 报告。仅当 task.status=completed 时允许调用。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "任务唯一标识"
      }
    },
    "required": ["runId"]
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  // 1. 校验 task 存在且状态为 completed
  const taskResult = await taskObject.get(args.runId);
  if (!taskResult.task) {
    return adaptError(new Error(`task 不存在: ${args.runId}`));
  }
  if (taskResult.task.status !== 'completed') {
    return adaptError(new Error(`task 未处于 completed 状态，当前状态: ${taskResult.task.status}`));
  }

  // 2. 生成 event.md（generate 内部双路径扫描 task.json）
  const result = await eventObject.generate(args.runId);
  if (result.error) {
    return adaptError(new Error(result.error));
  }

  // 3. 关联 eventFilePath 到 task.json
  await taskObject.linkEvent(args.runId, result.eventFilePath);

  return adaptReturn(result);
}
```

**返回值示例**：
```json
{
  "content": [{
    "type": "text",
    "text": "{\"eventFilePath\":\"/path/to/.agent/events/2026-05-19/abc-123.md\",\"content\":\"# Event Report...\"}"
  }]
}
```

---

### 3.7 event.query

```json
{
  "name": "event.query",
  "description": "查询 event.md 文件列表。支持按 runId、日期、事件类型筛选。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "string",
        "description": "精确匹配 runId（可选）"
      },
      "date": {
        "type": "string",
        "description": "匹配 YYYY-MM-DD 格式日期（可选）"
      },
      "type": {
        "type": "string",
        "enum": ["deviation", "attribution"],
        "description": "筛选事件类型（可选，需解析内容后过滤）"
      }
    }
  }
}
```

**Handler 逻辑**：
```javascript
async (args) => {
  const result = await eventObject.query(args);
  return adaptReturn(result);
}
```

---

## 4. 返回值适配（ADR-012）

所有工具 handler 必须通过 `src/tools/return-adapter.js` 包装返回值。

### 4.1 成功返回

```javascript
import { adaptReturn, adaptError } from './return-adapter.js';

// 正常结果
return adaptReturn(result);       // { content: [{ type: 'text', text: JSON.stringify(result) }] }

// 格式化结果
return adaptReturn(result, { pretty: true });  // 缩进 2 空格
```

### 4.2 错误返回

```javascript
// 错误结果
return adaptError(error);         // { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }
```

### 4.3 适配器源码

```javascript
// src/tools/return-adapter.js
export function adaptReturn(result, options = {}) {
  const { pretty = false } = options;
  const text = pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  return { content: [{ type: 'text', text }] };
}

export function adaptError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
}
```

---

## 5. 工具注册代码示例

```javascript
// src/index.js（目标：<50 行）
import { TaskObject } from './objects/TaskObject.js';
import { EventObject } from './objects/EventObject.js';
import { adaptReturn, adaptError } from './tools/return-adapter.js';

export async function initialize(api, config) {
  const { projectRoot, assets } = config;

  // 初始化对象
  const taskObject = new TaskObject({ projectRoot, taskSchema: assets.taskSchema });
  const eventObject = new EventObject({ projectRoot, eventTemplate: assets.eventTemplate });

  // 注册工具
  const tools = [
    {
      name: 'task.create',
      description: '创建一个新的任务草案...',
      parameters: { /* ... */ },
      execute: async (args) => adaptReturn(await taskObject.create(args))
    },
    {
      name: 'task.update',
      description: '更新任务状态、记录偏差...',
      parameters: { /* ... */ },
      execute: async (args) => adaptReturn(await taskObject.update(args))
    },
    {
      name: 'task.advance',
      description: '推进任务到下一阶段...',
      parameters: { /* ... */ },
      execute: async (args) => adaptReturn(await taskObject.advance(args))
    },
    {
      name: 'task.query',
      description: '查询任务完整状态...',
      parameters: { /* ... */ },
      execute: async (args) => {
        const result = await taskObject.get(args.runId);
        return result.task ? adaptReturn(result) : adaptError(new Error(`task 不存在: ${args.runId}`));
      }
    },
    {
      name: 'task.archive',
      description: '归档已完成的任务...',
      parameters: { /* ... */ },
      execute: async (args) => adaptReturn(await taskObject.archive(args.runId))
    },
    {
      name: 'event.record',
      description: '为已完成的任务生成 event.md 报告...',
      parameters: { /* ... */ },
      execute: async (args) => {
        const taskResult = await taskObject.get(args.runId);
        if (!taskResult.task) return adaptError(new Error(`task 不存在: ${args.runId}`));
        if (taskResult.task.status !== 'completed') {
          return adaptError(new Error(`task 未处于 completed 状态`));
        }
        const result = await eventObject.generate(args.runId);
        await taskObject.linkEvent(args.runId, result.eventFilePath);
        return adaptReturn(result);
      }
    },
    {
      name: 'event.query',
      description: '查询 event.md 文件列表...',
      parameters: { /* ... */ },
      execute: async (args) => adaptReturn(await eventObject.query(args))
    }
  ];

  for (const tool of tools) {
    api.registerTool(tool);
  }
}
```

---

## 6. 工具命名空间规范

| 命名空间 | 前缀 | 职责 | 数量 |
|----------|------|------|------|
| `task` | `task.*` | 任务生命周期管理 | 5 |
| `event` | `event.*` | event.md 生成与查询 | 2 |

**命名规则**：
- 格式：`{namespace}.{action}`
- namespace 只允许小写字母
- action 使用 snake_case 或 camelCase（与 OpenClaw 注册名保持一致）
- v4.3.0 不再使用 `create_plan`、`update_task_status` 等旧命名

---

## 7. 权限与校验

| 工具 | 前置校验 |
|------|----------|
| `task.create` | runId 格式、prompt 非空 |
| `task.update` | runId 存在、状态机合法、至少一个可选字段 |
| `task.advance` | runId 存在 |
| `task.query` | runId 存在 |
| `task.archive` | runId 存在、status === completed |
| `event.record` | runId 存在、status === completed |
| `event.query` | 无（返回空列表也是有效结果） |

---

*文档版本：v2.0.0*  
*状态：[ARCH_READY]*  
*关联 ADR：ADR-012（返回值适配）*
