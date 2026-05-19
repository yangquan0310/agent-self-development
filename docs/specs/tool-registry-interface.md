# Tool Registry 接口规范

> **版本**：v4.3.0  
> **范围**：`src/tools/`（注册层 + handler 层 + adapter 层）  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-19  
> **关联 ADR**：`docs/adr/adr-014.md`（扁平化架构）

---

## 1. 概述

v4.3.0 采用扁平化架构：Tool Handler 直接读写文件，不引入对象层。

本规范定义 6 个工具的注册方式和 handler 契约。

---

## 2. 注册接口

### 2.1 registerTools

```typescript
function registerTools(api: OpenClawAPI, context: ToolContext): void;

interface ToolContext {
  templates: { task: object, event: string };  // 加载后的模板
  baseDir: string;                              // 项目根目录
  logger?: Logger;
}

interface OpenClawAPI {
  registerTool(spec: ToolSpec): void;
}

interface ToolSpec {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (id: string, args: any) => Promise<any>;
}
```

**注册逻辑**：
1. 从 `schemas.js` 导入 6 个工具的定义（name, description, parameters）
2. 从 `handlers.js` 导入对应的 handler 函数
3. 对每个工具调用 `api.registerTool({ name, description, parameters, execute })`
4. `execute` 内部调用 `adaptReturn()` 或 `adaptError()` 包装返回值

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
      "runId": { "type": "string", "description": "任务唯一标识" },
      "prompt": { "type": "string", "description": "用户原始输入" },
      "taskType": { "type": "string", "enum": ["coding", "research", "documentation"] }
    },
    "required": ["runId", "prompt"]
  }
}
```

**Handler**：`handlers.createTask(params, context)` → `{ task }`

---

### 3.2 task.update

```json
{
  "name": "task.update",
  "description": "更新任务状态、记录偏差、归因、结果或关联 event.md。至少提供一个可选字段。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": { "type": "string" },
      "status": { "type": "string", "enum": ["draft", "pending_approval", "active", "revising", "completed"] },
      "reason": { "type": "string", "description": "状态变更原因" },
      "deviation": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "description": { "type": "string" },
          "impact": { "type": "string" }
        },
        "required": ["type", "description"]
      },
      "attribution": {
        "type": "object",
        "properties": {
          "rootCause": { "type": "string" },
          "strategy": { "type": "string" },
          "impact": { "type": "string" },
          "deviationIds": { "type": "array", "items": { "type": "string" }, "description": "精确关联指定偏差 ID" }
        },
        "required": ["rootCause", "strategy"]
      },
      "outcome": {
        "type": "object",
        "properties": {
          "summary": { "type": "string" },
          "deliverables": { "type": "array", "items": { "type": "string" } },
          "lessonsLearned": { "type": "string" }
        }
      },
      "eventFilePath": { "type": "string" }
    },
    "required": ["runId"]
  }
}
```

**Handler**：`handlers.updateTask(params, context)` → `{ task, updatedFields }`

**特殊说明**：`task.update` 是 task.json 的**唯一更新入口**。内部按顺序处理：
1. `status` → 状态机校验
2. `deviation` → 追加偏差
3. `attribution` → 追加归因 + 标记偏差
4. `outcome` → 浅合并
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
      "runId": { "type": "string" },
      "phaseId": { "type": "string", "description": "指定阶段 ID（可选）" }
    },
    "required": ["runId"]
  }
}
```

**Handler**：`handlers.advanceTask(params, context)` → `{ task, previousPhase, nextPhase, isComplete }`

---

### 3.4 task.get

```json
{
  "name": "task.get",
  "description": "查询任务完整状态。支持从活跃目录或归档目录读取。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": { "type": "string" }
    },
    "required": ["runId"]
  }
}
```

**Handler**：`handlers.getTask(params, context)` → `{ task }`

**注意**：若 task 不存在返回 `{ task: null }`，不返回错误。

---

### 3.5 task.archive

```json
{
  "name": "task.archive",
  "description": "归档已完成的任务。仅允许归档 status=completed 的任务。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": { "type": "string" }
    },
    "required": ["runId"]
  }
}
```

**Handler**：`handlers.archiveTask(params, context)` → `{ archived, archivedAt, archivedPath }`

---

### 3.6 event.report

```json
{
  "name": "event.report",
  "description": "为已完成的任务生成 event.md 报告。仅当 task.status=completed 时允许调用。",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": { "type": "string" }
    },
    "required": ["runId"]
  }
}
```

**Handler**：`handlers.reportEvent(params, context)` → `{ eventFilePath, content }`

**Handler 内部逻辑**：
1. 双路径扫描读取 task.json（活跃 → 归档）
2. 校验 `task.status === 'completed'`
3. 渲染模板，写入 `.agent/events/{date}/{runId}.md`
4. 返回 `eventFilePath`

**Tool Handler 层协调**（在 `tools/index.js` 中）：
```javascript
async execute(_id, args) {
  const result = await handlers.reportEvent(args, context);
  if (result.error) return adaptError(new Error(result.error));
  
  // 关联 eventFilePath 到 task.json
  await handlers.updateTask(
    { runId: args.runId, eventFilePath: result.eventFilePath },
    context
  );
  
  return adaptReturn(result);
}
```

---

## 4. 返回值适配

所有工具 execute 函数通过 `src/tools/adapter.js` 包装返回值。

```javascript
// adapter.js
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

## 5. 插件入口示例

```javascript
// src/index.js（目标：<50 行）
import { readFileSync } from 'fs';
import { registerTools } from './tools/index.js';

export async function initialize(api, config) {
  const baseDir = config.projectRoot || process.cwd();
  
  const templates = {
    task: JSON.parse(readFileSync(`${baseDir}/src/templates/task.json`, 'utf-8')),
    event: readFileSync(`${baseDir}/src/templates/event.md`, 'utf-8')
  };
  
  const context = { templates, baseDir, logger: api.logger };
  registerTools(api, context);
}
```

---

## 6. 权限与校验

| 工具 | 前置校验 |
|------|----------|
| `task.create` | runId 格式、prompt 非空、runId 不存在 |
| `task.update` | runId 存在、状态机合法、至少一个可选字段 |
| `task.advance` | runId 存在 |
| `task.get` | runId 存在（不存在返回 null，不报错） |
| `task.archive` | runId 存在、status === completed |
| `event.report` | runId 存在、status === completed |

---

*文档版本：v3.0.0*  
*状态：[ARCH_READY]*  
*关联 ADR：ADR-014（扁平化架构）*
