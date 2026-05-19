---
name: project-conventions
description: >
  agent-self-development 插件项目的编码规范、目录结构标准与数据模型约定。
  适用场景：(1) 为项目编写或审查 JavaScript 代码，
  (2) 新增工具或 handler，
  (3) 更新 SKILL.md 前言或数据模型文档。
---

# 项目规范

为 agent-self-development 编写代码时遵循以下标准。

## 目录结构（v4.3.0+）

v4.3.0 采用**扁平化工具插件架构**：Tool Handler 直接读写文件，不引入对象层封装。

```
src/
├── index.js              # 插件入口：加载模板，注册工具
├── tools/
│   ├── index.js          # 注册入口：遍历 schemas + handlers 注册
│   ├── schemas.js        # 工具参数 JSON Schema
│   ├── handlers.js       # 工具 handler 实现（直接操作文件）
│   └── adapter.js        # 返回值统一适配
├── templates/
│   ├── task.json         # Task 数据结构模板
│   ├── event.md          # Event Markdown 模板
│   └── templates/        # 可选 Skill 模板
└── utils/
    ├── io.js             # 文件 IO 原子操作（readJson / writeJson / ensureDir / moveFile）
    └── resolve.js        # 路径解析（taskPath / eventPath / archivePath）
```

**红线**：
- `src/` 下不得出现 `metacognition/`、`working-memory/`、`personality/`、`common/adapters/` 等旧目录
- **不得引入 `objects/` 目录** — v4.3.0 放弃对象层封装，Handler 直接操作文件

---

## 命名规范

| 元素 | 规则 | 示例 |
|------|------|------|
| 函数名 | 动词前缀，camelCase | `createTask()`, `updateTask()`, `generateReport()` |
| 文件名 | 小写，语义化 | `handlers.js`, `schemas.js`, `adapter.js` |
| 工具名 | 命名空间 + 动词，snake_case | `task.create`, `event.report` |
| 常量 | 全大写 SNAKE_CASE | `VALID_STATUSES`, `STATE_MACHINE` |

---

## Handler 层规范

### 设计原则

- **直接 IO**：Handler 直接调用 `utils/io.js` 读写文件，不通过中间对象
- **纯函数倾向**：Handler 接收 `(params, context)`，返回结果对象，副作用仅限于文件 IO
- **校验双重化**：JSON Schema（Tool 层）+ 运行时校验（Handler 层）
- **错误返回**：所有错误返回 `{ error: '...' }`，不抛出异常

### Handler 签名

```javascript
// handlers.js
export async function createTask(params, context) {
  // params: 经 JSON Schema 校验后的工具参数
  // context: { templates, logger, baseDir }
  // 返回: { task } 或 { error: '...' }
}
```

### 6 个工具 Handler

```javascript
// 任务管理
export async function createTask(params, context)     // 写 .agent/tasks/{runId}.json
export async function updateTask(params, context)     // 读 → 改 → 写 task.json
export async function advanceTask(params, context)    // 读 → 推进 phase → 写
export async function getTask(params, context)        // 读 task.json（活跃+归档双路径）
export async function archiveTask(params, context)    // 移动 task.json → archive/

// 事件报告
export async function reportEvent(params, context)    // 读 task.json → 渲染 → 写 event.md
```

### updateTask 参数（万能更新）

```javascript
{
  runId: string,                    // 必填
  status?: string,                  // 状态变更（状态机校验）
  reason?: string,                  // 变更原因（日志用，不持久化）
  deviation?: {                     // 记录偏差
    type: string,
    description: string,
    impact?: string
  },
  attribution?: {                   // 记录归因
    rootCause: string,
    strategy: string,
    impact?: string,
    deviationIds?: string[]         // 精确关联；不提供则标记全部未归因
  },
  outcome?: {                       // 设置结果（浅合并）
    summary?: string,
    deliverables?: string[],
    lessonsLearned?: string
  },
  eventFilePath?: string            // 关联 event.md
}
```

**业务规则**：
- `deviation` 追加到 `task.deviations[]`，id 按 `dev-${timestamp}-${random4}` 生成
- `attribution` 追加到 `task.attributions[]`，id 按 `attr-${timestamp}-${random4}` 生成
- `outcome` 浅合并：`task.outcome = { ...task.outcome, ...params.outcome }`，`deliverables` 替换不追加
- 任何写入自动刷新 `task.updatedAt = Date.now()`

---

## 工具注册规范

### 注册方式

```javascript
api.registerTool({
  name: 'task.create',
  description: '创建 draft task',
  parameters: { type: 'object', properties: { ... } },
  async execute(_id, params) {
    const result = await handlers.createTask(params, context);
    return adaptReturn(result);
  }
});
```

### 返回值格式

所有工具统一返回：

```javascript
{
  content: [{ type: 'text', text: JSON.stringify(result) }]
}
```

错误时：

```javascript
{
  content: [{ type: 'text', text: JSON.stringify({ error: '...' }) }],
  isError: true
}
```

通过 `src/tools/adapter.js` 统一包裹，业务层不处理格式。

---

## 数据模型

### Task JSON（v4.3.0）

```json
{
  "runId": "uuid",
  "status": "draft | pending_approval | active | revising | completed",
  "taskType": "coding | research | documentation",
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000,
  "plan": {
    "prompt": "...",
    "context": { "goal", "constraints", "successCriteria" },
    "workspace": { "artifacts", "tools", "skills" },
    "execution": {
      "phases": [
        { "id", "name", "goal", "outputs", "status", "tools", "skills" }
      ],
      "currentPhase": 0
    }
  },
  "deviations": [
    { "id", "type", "description", "impact", "timestamp", "attributed", "attributionId" }
  ],
  "attributions": [
    { "id", "rootCause", "strategy", "impact", "timestamp" }
  ],
  "outcome": { "summary", "deliverables", "lessonsLearned" },
  "eventFilePath": ""
}
```

### Event Markdown（v4.3.0）

文件路径：`./.agent/events/{YYYY-MM-DD}/{runId}.md`

七章节结构：

```markdown
# Event: {runId}

## 1. 元信息

## 2. 计划

## 3. 执行

## 4. 变更记录

## 5. 偏差

## 6. 归因

## 7. 结果
```

**生成规则**：task 完成后，`event.report` 从 task.json 一次性凝练渲染，不再增量追加。

---

## 错误处理

- 文件 IO 使用 try-catch，失败时返回 `{ error: '...' }` 而非抛出
- 工具层捕获所有异常，通过 `adaptError()` 包裹后返回
- 关闭资源（如数据库连接）在 `gateway_stop` 或进程退出时处理

---

## 开发原则

- **最小变更**：只修改必要的部分，不重构无关代码
- **扁平化**：Handler 直接操作文件，不引入中间抽象
- **防御式编程**：工具参数校验在 Tool Handler 层和 Handler 函数内部双重进行
- **日志前缀**：使用 `[task.create]` `[event.report]` 等工具名前缀
- **版本注释**：重大变更添加 `// v4.3.0: description`

---

## 文件映射

| 路径 | 职责 | 变更频率 |
|------|------|----------|
| `src/index.js` | 插件入口，加载模板，注册工具 | 低 |
| `src/tools/index.js` | 工具注册入口 | 低 |
| `src/tools/schemas.js` | 工具参数 schema | 中 |
| `src/tools/handlers.js` | 工具 handler 实现（直接文件 IO） | 中 |
| `src/tools/adapter.js` | 返回值格式适配 | 低 |
| `src/utils/resolve.js` | 路径解析 | 低 |
| `src/utils/io.js` | 文件原子读写 | 低 |
| `src/templates/task.json` | Task 数据结构模板 | 低 |
| `src/templates/event.md` | Event Markdown 模板 | 低 |

---

## 外部参考

- `../../docs/roadmap/v4.3.0.md` — 工具插件架构蓝图
- `../../docs/specs/` — 接口规范（扁平化 handler 层）
- `../../docs/adr/adr-014.md` — 扁平化架构决策记录
- `../../docs/COLLABORATION.md` — 跨角色协作协议与标记规范
