# Hook 接口规范

> **版本**：v4.5.0  
> **范围**：`src/hooks/condition.js`  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-26  
> **关联 ADR**：`docs/adr/adr-015.md`（Hook 注入时机精细化）

---

## 1. 概述

v4.5.0 引入条件触发的 Hook 机制，在 OpenClaw 框架的 `after_tool_call` 和 `before_prompt_build` 钩子点上，通过 `src/hooks/condition.js` 中的判断逻辑决定是否注入上下文提醒。

本规范定义两个导出函数的接口契约、返回值类型、幂等性保证和使用示例。

---

## 2. 模块导出

```javascript
// src/hooks/condition.js
export { evaluateAfterToolCall, evaluateBeforePromptBuild, REMINDERS };
```

---

## 3. REMINDERS 常量

### 3.1 类型

```typescript
type REMINDERS = {
  taskCreated: string;       // 任务创建后提醒
  deviationDetected: string; // 偏差记录后提醒
  eventGenerated: string;   // 事件生成后提醒
  noActiveTask: string;     // 无 active 任务提醒
};
```

### 3.2 值

| 键 | 内容概要 | 适用 Hook |
|---|---------|----------|
| `REMINDERS.taskCreated` | 制定计划 → 拆解 TODO → 执行监控 → 归因分析 → 事件记录 | M1（after_tool_call） |
| `REMINDERS.deviationDetected` | 偏差分类 → 归因分析 → 影响评估 → 调整策略 | M2（after_tool_call） |
| `REMINDERS.eventGenerated` | 六维度复盘：自我认知、风格判断、信念验证、身份一致性、技能评估、程序性记忆 | M3（after_tool_call） |
| `REMINDERS.noActiveTask` | 评估工作 → task_create → task_update → event.* | M4（before_prompt_build） |

---

## 4. evaluateAfterToolCall(event)

判断 `after_tool_call` Hook 是否需要触发注入。

### 4.1 函数签名

```typescript
function evaluateAfterToolCall(event: AfterToolCallEvent): InjectionDecision;
```

### 4.2 输入类型

```typescript
interface AfterToolCallEvent {
  toolName: string;    // 工具名称，如 'task_create'
  params: object;      // 调用参数（透传，不做解析）
  result: object;      // OpenClaw 返回对象，结构为 { content: [{ type: 'text', text: string }] }
}
```

### 4.3 输出类型

```typescript
interface InjectionDecision {
  shouldInject: boolean;      // 是否注入
  idempotencyKey: string;     // 幂等键（shouldInject=true 时必填）
  prependContext: string;     // 注入文本（shouldInject=true 时必填）
}
```

### 4.4 条件矩阵

| 条件 | toolName | result 解析后 | additional check | idempotencyKey |
|------|----------|--------------|-----------------|----------------|
| M1 | `task_create` | isSuccess=true | `parsedResult.runId` 存在 | `agent-self-development:task-created` |
| M2 | `task_update` | isSuccess=true | `parsedResult.deviationRecorded === true` | `agent-self-development:deviation-detected` |
| M3 | `event_report` | isSuccess=true | `parsedResult.eventFilePath` 存在 | `agent-self-development:event-generated` |
| — | 其他 | — | — | 不注入 |

### 4.5 内部逻辑

```javascript
export function evaluateAfterToolCall(event) {
  const { toolName, result } = event;

  // Step 1: 解析返回结果
  let parsedResult = result;
  if (result?.content?.[0]?.text) {
    try {
      parsedResult = JSON.parse(result.content[0].text);
    } catch {
      parsedResult = result;
    }
  }

  // Step 2: 判断成功
  const isSuccess = parsedResult && !parsedResult.error;

  // Step 3: 匹配条件
  if (toolName === 'task_create' && isSuccess && parsedResult.runId) {
    return { shouldInject: true, idempotencyKey: 'agent-self-development:task-created', prependContext: REMINDERS.taskCreated };
  }
  if (toolName === 'task_update' && isSuccess && parsedResult.deviationRecorded) {
    return { shouldInject: true, idempotencyKey: 'agent-self-development:deviation-detected', prependContext: REMINDERS.deviationDetected };
  }
  if (toolName === 'event_report' && isSuccess && parsedResult.eventFilePath) {
    return { shouldInject: true, idempotencyKey: 'agent-self-development:event-generated', prependContext: REMINDERS.eventGenerated };
  }

  return { shouldInject: false };
}
```

### 4.6 示例

```javascript
// M1: task_create 成功
evaluateAfterToolCall({
  toolName: 'task_create',
  params: { runId: 'abc123', ... },
  result: { content: [{ type: 'text', text: '{"runId":"abc123","task":{...}}' }] }
});
// → { shouldInject: true, idempotencyKey: 'agent-self-development:task-created', prependContext: REMINDERS.taskCreated }

// M2: task_update 含 deviation
evaluateAfterToolCall({
  toolName: 'task_update',
  params: { runId: 'abc123', deviation: { type: 'output', description: '...' } },
  result: { content: [{ type: 'text', text: '{"deviationRecorded":true}' }] }
});
// → { shouldInject: true, idempotencyKey: 'agent-self-development:deviation-detected', prependContext: REMINDERS.deviationDetected }

// 不注入：task_get
evaluateAfterToolCall({
  toolName: 'task_get',
  params: { runId: 'abc123' },
  result: { content: [{ type: 'text', text: '{"task":{...}}' }] }
});
// → { shouldInject: false }

// 不注入：task_update 但 error
evaluateAfterToolCall({
  toolName: 'task_update',
  params: { runId: 'not-exist' },
  result: { content: [{ type: 'text', text: '{"error":"task not found"}' }] }
});
// → { shouldInject: false }
```

---

## 5. evaluateBeforePromptBuild(context)

判断 `before_prompt_build` Hook 是否需要触发注入。

### 5.1 函数签名

```typescript
async function evaluateBeforePromptBuild(context: PluginContext): Promise<InjectionDecision>;
```

### 5.2 输入类型

```typescript
interface PluginContext {
  baseDir: string;     // 项目根目录绝对路径
  templates: object;    // 模板对象（可选）
  logger: Logger;       // 日志对象（可选）
}
```

### 5.3 输出类型

同 `InjectionDecision`。

### 5.4 内部逻辑

```javascript
export async function evaluateBeforePromptBuild(context) {
  try {
    const { readdir, readFile } = await import('fs').then(m => m.promises);
    const { join } = await import('path');
    const tasksDir = join(context.baseDir || process.cwd(), '.agents', 'tasks');

    let hasActive = false;
    try {
      const files = await readdir(tasksDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(tasksDir, file), 'utf-8');
          const task = JSON.parse(content);
          if (task.status === 'active' || task.status === 'pending_approval' || task.status === 'draft') {
            hasActive = true;
            break;
          }
        }
      }
    } catch {
      // 目录不存在或为空，无 active task
    }

    if (!hasActive) {
      return {
        shouldInject: true,
        idempotencyKey: 'agent-self-development:no-active-task',
        prependContext: REMINDERS.noActiveTask
      };
    }
  } catch {
    // 出错时跳过，不阻塞
  }

  return { shouldInject: false };
}
```

### 5.5 扫描范围

扫描 `.agents/tasks/` 目录下的所有 `.json` 文件，检查 `status` 字段。

**判定为有 active 任务的条件**（任一满足）：
- `status === 'active'`
- `status === 'pending_approval'`
- `status === 'draft'`

**判定为无 active 任务的条件**：
- 目录不存在
- 目录为空
- 所有任务 status 均为 `archived` 或其他非活跃状态

### 5.6 示例

```javascript
// 有 active 任务
await evaluateBeforePromptBuild({ baseDir: '/project' });
// → { shouldInject: false }

// 无 active 任务
await evaluateBeforePromptBuild({ baseDir: '/empty-project' });
// → { shouldInject: true, idempotencyKey: 'agent-self-development:no-active-task', prependContext: REMINDERS.noActiveTask }
```

---

## 6. 幂等性

### 6.1 幂等键列表

| idempotencyKey | 触发场景 | 去重范围 |
|----------------|---------|---------|
| `agent-self-development:task-created` | M1 | 单次 task_create 调用 |
| `agent-self-development:deviation-detected` | M2 | 单次含 deviation 的 task_update |
| `agent-self-development:event-generated` | M3 | 单次 event_report 调用 |
| `agent-self-development:no-active-task` | M4 | before_prompt_build 触发周期 |

### 6.2 去重机制

依赖 OpenClaw 框架层 `enqueueNextTurnInjection` 的 `idempotencyKey` 参数。相同 key 的重复注入请求在框架层自动忽略。

### 6.3 防重复注入场景

| 场景 | 是否重复注入 |
|------|------------|
| Agent 连续两次调用 `task_create` | key 不同（按调用），不重复 |
| Agent 调用 `task_create` 后立即再次 before_prompt_build | key 不同，不重复 |
| 同一 deviation 被 `task_update` 两次 | key 相同（按调用），去重 |

---

## 7. 错误处理

| 场景 | 处理方式 |
|------|---------|
| `JSON.parse` 失败 | 使用原始 `result` 对象，isSuccess=false |
| `readdir` 目录不存在 | 视为无 active task，继续判断 |
| `readFile` 读取失败 | 跳过该文件，继续扫描 |
| `evaluateBeforePromptBuild` 抛出异常 | 吞掉异常，返回 `{ shouldInject: false }` |

---

## 8. OpenClaw 框架集成

### 8.1 注册方式

```javascript
// src/index.js
function registerSessionHooks(api, logger, context) {
  api.on('after_tool_call', async (event) => {
    if (!['task_create', 'task_update', 'event_report'].includes(event.toolName)) return;
    const { shouldInject, idempotencyKey, prependContext } = evaluateAfterToolCall(event);
    if (shouldInject) {
      await enqueueInjection(api, logger, idempotencyKey, prependContext);
    }
  }, { priority: 50 });

  api.on('before_prompt_build', async (event) => {
    const { shouldInject, idempotencyKey, prependContext } = await evaluateBeforePromptBuild(context);
    if (shouldInject) {
      await enqueueInjection(api, logger, idempotencyKey, prependContext);
    }
  }, { priority: 50 });
}
```

### 8.2 注入函数

```javascript
async function enqueueInjection(api, logger, idempotencyKey, prependContext) {
  try {
    await api.enqueueNextTurnInjection({ idempotencyKey, prependContext });
    logInfo(logger, `[agent-self-development] Injection queued: ${idempotencyKey}`);
  } catch (err) {
    logInfo(logger, `[agent-self-development] Injection failed: ${err.message}`);
  }
}
```

---

## 9. 测试用例

### 9.1 evaluateAfterToolCall 测试用例

| 用例 | 输入 | 期望 |
|------|------|------|
| task_create 成功 | toolName='task_create', result含runId | shouldInject=true, key='task-created' |
| task_create 失败 | toolName='task_create', result含error | shouldInject=false |
| task_update 含deviation | toolName='task_update', result含deviationRecorded=true | shouldInject=true, key='deviation-detected' |
| task_update 无deviation | toolName='task_update', result不含deviationRecorded | shouldInject=false |
| event_report 成功 | toolName='event_report', result含eventFilePath | shouldInject=true, key='event-generated' |
| event_report 失败 | toolName='event_report', result含error | shouldInject=false |
| task_get | toolName='task_get', 任意result | shouldInject=false |
| task_advance | toolName='task_advance', 任意result | shouldInject=false |

### 9.2 evaluateBeforePromptBuild 测试用例

| 用例 | mock 目录状态 | 期望 |
|------|-------------|------|
| 有 active 任务 | tasks/a.json status='active' | shouldInject=false |
| 有 draft 任务 | tasks/a.json status='draft' | shouldInject=false |
| 有 pending_approval | tasks/a.json status='pending_approval' | shouldInject=false |
| 全是 archived | tasks/a.json status='archived' | shouldInject=true, key='no-active-task' |
| 目录为空 | tasks/ 目录不存在 | shouldInject=true, key='no-active-task' |
| 目录不存在 | .agents/tasks/ 不存在 | shouldInject=true, key='no-active-task' |

---

*文档版本：v1.0.0*  
*状态：[ARCH_READY]*
