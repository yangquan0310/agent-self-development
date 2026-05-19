# Tool Registry 接口规范

> **版本**：v4.3.0  
> **范围**：`src/tools/index.js`, `src/tools/schemas.js`  
> **状态**：⚠️ 待更新（Pending Update）  
> **作者**：Architect

> **⚠️ 注意**：本文档基于旧方案（`v4.3.0-design.md`，已废弃），部分接口与新方向不一致：
> - 工具总数 13 个（task.* 7 + event.* 2 + guide.* 4）→ **应改为 7 个（task.* 5 + event.* 2）**
> - `guide.*` 命名空间工具 → **全部废弃**
> - `task.files` / `task.diagnose` → **废弃**
> - 准确工具清单以 `docs/roadmap/v4.3.0.md` 为准

---

## 1. 概述

Tool Registry 负责将插件的所有能力注册到 OpenClaw 核心，仅支持新注册方式：

- **新注册方式**（v4.3.0 唯一路径）：`api.registerTool({ name, description, parameters, execute })`

> ⚠️ **v4.3.0 不保留任何向后兼容层**。13 个旧工具名已废弃，Agent 必须直接使用新命名空间工具名。

---

## 2. 模块结构

```
src/tools/
├── index.js              # 统一注册入口 registerTools(api, deps)
├── schemas.js            # 所有工具的 JSON Schema 定义（parameters 格式）
├── return-adapter.js     # 返回值格式适配器
└── namespaced/           # 按命名空间组织的 tool handlers
    ├── task-tools.js     # task.* 命名空间（7 个工具）
    ├── event-tools.js    # event.* 命名空间（2 个工具）
    └── guide-tools.js    # guide.* 命名空间（4 个工具）
```

---

## 3. 注册入口

### 3.1 registerTools 函数

```typescript
function registerTools(
  api: OpenClawApi,
  deps: {
    state: State;
    skills: Skills;
    logger: Logger;
    log: Log;
    events: Event;           // v4.3.0: 可选，MemoryArchive 保留兼容
    caseIndex: CaseIndex;
    taskObject: TaskObject;   // v4.3.0 新增
    eventObject: EventObject; // v4.3.0 新增
  }
): void;
```

**注册顺序**：
1. 注册命名空间 tools（`task.*`, `event.*`, `guide.*`）— 使用新注册方式
2. 记录注册结果日志

---

## 4. 新注册方式契约

### 4.1 工具定义结构

```typescript
interface ToolDefinition {
  name: string;                    // 命名空间格式：'task.create', 'event.record'
  description: string;
  parameters: JSONSchema;          // 原 inputSchema，JSON Schema 格式
  execute: ExecuteFunction;
}

type ExecuteFunction = (
  _id: string,                    // tool call ID（OpenClaw 生成）
  params: Record<string, any>    // 用户传入的参数
) => Promise<ToolResult>;

interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;                // type='text' 时必填
    [key: string]: any;
  }>;
  isError?: boolean;
}
```

### 4.2 返回值适配

所有 `execute` 函数通过 `ReturnAdapter` 统一包装：

```typescript
// src/tools/return-adapter.js

function adaptReturn(
  result: object,
  options?: {
    pretty?: boolean;            // 是否格式化 JSON（默认 false）
  }
): ToolResult;

function adaptError(
  error: Error | string,
  options?: object
): ToolResult;
```

**使用示例**：

```typescript
// task-tools.js
async function executeCreate(_id, params) {
  try {
    const result = await taskObject.create(params);
    return adaptReturn(result);
  } catch (err) {
    return adaptError(err);
  }
}
```

### 4.3 参数结构变更对照

| 字段 | v4.2.0（旧，已废弃） | v4.3.0（新） | 说明 |
|------|-------------|-------------|------|
| 注册函数 | `api.registerTool(name, definition)` | `api.registerTool(definition)` | 第一个参数合并到 definition |
| 名称 | `definition.name` | `definition.name` | 格式变为 `task.create` |
| Schema | `definition.inputSchema` | `definition.parameters` | 字段名变更，结构不变 |
| 执行函数 | `definition.handler(params)` | `definition.execute(_id, params)` | 签名变更，增加 `_id` |
| 返回值 | `object`（任意） | `{ content: [{ type: 'text', text: string }] }` | 必须包装 |

---

## 5. 命名空间工具清单

### 5.1 task.* 命名空间

```javascript
// schemas.js 中的定义示例
export const TOOL_SCHEMAS = {
  'task.create': {
    name: 'task.create',
    description: '创建 draft task',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '任务运行 ID' },
        prompt: { type: 'string', description: '用户原始输入（前500字）' },
        taskType: {
          type: 'string',
          enum: ['coding', 'research', 'documentation'],
          description: '任务类型（可选）'
        },
        planInput: {
          type: 'object',
          properties: {
            goal: { type: 'string' },
            constraints: { type: 'array', items: { type: 'string' } },
            successCriteria: { type: 'array', items: { type: 'string' } },
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
          }
        }
      },
      required: ['runId', 'prompt']
    }
  },
  // ... 其他工具
};
```

| 工具名 | 参数 | 返回核心字段 |
|--------|------|-------------|
| `task.create` | `runId`, `prompt`, `taskType?`, `planInput?` | `{ task, similarCases? }` |
| `task.update` | `runId`, `status`, `reason?` | `{ task, previousStatus }` |
| `task.advance` | `runId`, `phaseId?` | `{ task, previousPhase, nextPhase, isComplete }` |
| `task.query` | `runId` | `{ task }` |
| `task.files` | `runId` | `{ files, count }` |
| `task.diagnose` | `runId?` | `{ diagnosis }` |
| `task.archive` | `runId` | `{ archived, archivedAt? }` |

### 5.2 event.* 命名空间

| 工具名 | 参数 | 返回核心字段 |
|--------|------|-------------|
| `event.record` | `runId`, `recordType`, `data` | `{ recorded, eventFilePath? }` |
| `event.query` | `runId?`, `date?`, `type?` | `{ events, count }` |

**`event.record` 参数详细结构**：

```json
{
  "runId": "task-001",
  "recordType": "deviation",
  "data": {
    "type": "scope_creep",
    "description": "用户要求增加认证模块",
    "impact": "延期1天"
  }
}
```

或：

```json
{
  "runId": "task-001",
  "recordType": "attribution",
  "data": {
    "rootCause": "需求评审不充分",
    "impact": "返工",
    "strategy": "增加需求评审环节"
  }
}
```

### 5.3 guide.* 命名空间

| 工具名 | 参数 | 返回核心字段 |
|--------|------|-------------|
| `guide.planning` | `phase`, `taskType?` | `{ guide, phase, taskType }` |
| `guide.monitoring` | `runId` | `{ guide, currentPhase, totalPhases, historyDeviations }` |
| `guide.regulation` | `runId` | `{ guide, available, deviationCount, unattributedCount }` |
| `guide.development` | `runId` | `{ guide, status, deviationCount, attributionCount }` |

---

## 6. 废弃声明

以下 13 个旧工具名在 v4.3.0 中**全部废弃**，不再保留任何映射、shim 或向后兼容层。Agent 必须直接使用新命名空间工具名调用。

| 序号 | 旧工具名 | 新命名空间工具名 | 所属命名空间 |
|------|----------|------------------|--------------|
| 1 | `create_plan` | `task.create` | task |
| 2 | `update_task_status` | `task.update` | task |
| 3 | `advance_phase` | `task.advance` | task |
| 4 | `get_task_status` | `task.query` | task |
| 5 | `get_task_files` | `task.files` | task |
| 6 | `self_diagnose` | `task.diagnose` | task |
| 7 | `archive_task` | `task.archive` | task |
| 8 | `record_deviation` | `event.record` | event |
| 9 | `record_attribution` | `event.record` | event |
| 10 | `get_planning_guide` | `guide.planning` | guide |
| 11 | `get_monitoring_guide` | `guide.monitoring` | guide |
| 12 | `get_regulation_guide` | `guide.regulation` | guide |
| 13 | `get_development_guide` | `guide.development` | guide |

> ⚠️ **重要**：v4.3.0 发布后，任何使用旧工具名的 Agent 配置、脚本、白名单将直接报错，不存在过渡期。所有 Agent 必须在 v4.3.0 发布前完成白名单更新。

---

## 7. 错误处理统一策略

### 7.1 错误返回格式

```json
{
  "content": [{
    "type": "text",
    "text": "{\"error\":\"task 不存在: task-001\"}"
  }],
  "isError": true
}
```

### 7.2 错误分类

| 错误类型 | 触发场景 | HTTP 语义映射 | Agent 行为建议 |
|----------|----------|--------------|---------------|
| 参数校验失败 | `runId` 缺失、`status` 无效 | 400 Bad Request | 检查参数并重试 |
| 资源不存在 | task 不存在、事件文件不存在 | 404 Not Found | 先创建资源 |
| 状态冲突 | 已完成 task 再次推进 | 409 Conflict | 检查任务状态 |
| 权限不足 | 归档非 completed task | 403 Forbidden | 先完成任务 |
| 内部错误 | 文件系统写入失败 | 500 Internal Error | 报告开发者 |

---

## 8. 测试要求

| 测试类别 | 数量 | 覆盖要求 |
|----------|------|----------|
| 命名空间工具正向调用 | ≥ 15 | 每个工具至少 1 个正向用例 |
| 命名空间工具错误路径 | ≥ 15 | 参数缺失、资源不存在、状态冲突 |
| 返回值格式校验 | ≥ 30 | 所有返回均为 `{ content: [...] }` 格式 |
| 参数转换校验 | 2 | `record_deviation` / `record_attribution` → `event.record` |
| 旧名零残留 | 1 | `grep` 全量旧工具名零匹配 |

---

## 9. 与 openclaw.plugin.json 的同步

### 9.1 需更新的字段

```json
{
  "version": "4.3.0",
  "minVersion": "2026.5.0",
  "configSchema": {
    "properties": {
      "injectionMode": { ... },
      "tools": {
        "type": "object",
        "description": "命名空间工具分组配置",
        "properties": {
          "task": { "type": "object", "description": "task.* 工具配置" },
          "event": { "type": "object", "description": "event.* 工具配置" },
          "guide": { "type": "object", "description": "guide.* 工具配置" }
        }
      }
    }
  }
}
```

### 9.2 metadata.json 同步

`metadata.json` 中 `tools` 字段需同步更新为命名空间格式，并标注分组：

```json
{
  "tools": {
    "task": ["create", "update", "advance", "query", "files", "diagnose", "archive"],
    "event": ["record", "query"],
    "guide": ["planning", "monitoring", "regulation", "development"]
  }
}
```

---

## 10. 废弃清单

以下文件/模块在 v4.3.0 中不再存在：

| 文件 | 说明 |
|------|------|
| `src/tools/compat-shim.js` | 向后兼容层已移除 |
| `src/tools/schemas.js`（旧版） | 旧 schema 定义已重写为 parameters 格式 |

---

*文档版本：v2.0.0（无向后兼容层）*  
*维护者：Architect*  
*最后更新：2026-05-19*  
*[ARCH_READY]*
