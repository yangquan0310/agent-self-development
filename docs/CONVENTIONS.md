---
name: project-conventions
description: >
  agent-self-development 插件项目的编码规范、目录结构标准与数据模型约定。
  适用场景：(1) 为项目编写或审查 JavaScript 代码，
  (2) 新增工具或对象方法，
  (3) 更新 SKILL.md 前言或数据模型文档。
---

# 项目规范

为 agent-self-development 编写代码时遵循以下标准。

## 目录结构（v4.3.0+）

v4.3.0 精简为工具插件后，`src/` 下仅保留四个目录：

```
src/
├── index.js              # 插件入口：definePluginEntry + registerTools
├── objects/              # 核心对象层
│   ├── TaskObject.js     # task.json 全生命周期
│   ├── EventObject.js    # event.md 生成器
│   └── index.js          # 导出
├── assets/               # 静态模板与资源
│   ├── task.json         # Task 数据结构模板
│   ├── event.md          # Event Markdown 模板
│   └── templates/        # 可选 Skill 模板
├── tools/                # 工具注册层
│   ├── index.js          # 注册入口
│   ├── task-tools.js     # task.* 工具实现
│   ├── event-tools.js    # event.* 工具实现
│   ├── schemas.js        # 工具参数 schema
│   └── return-adapter.js # 返回值统一适配
└── utils/                # 工具函数
    ├── path.js           # 路径解析
    ├── file.js           # 文件 IO（原子读写）
    └── validate.js       # 校验工具
```

**红线**：`src/` 下不得出现 `metacognition/`、`working-memory/`、`personality/`、`common/adapters/` 等旧目录。

---

## 命名规范

| 元素 | 规则 | 示例 |
|------|------|------|
| 类名 | 单一名词，PascalCase | `TaskObject`, `EventObject` |
| 方法名 | 动词前缀，camelCase | `create()`, `recordDeviation()`, `generate()` |
| 文件名 | 小写，与类名对应 | `task-object.js`（旧）→ `TaskObject.js`（v4.3.0 保留 PascalCase） |
| 工具名 | 命名空间 + 动词，snake_case | `task.create`, `event.record` |
| 常量 | 全大写 SNAKE_CASE | `VALID_STATUSES`, `STATE_MACHINE` |

---

## 对象层规范

### TaskObject

```javascript
export class TaskObject {
  constructor(deps) {
    // deps 仅注入：baseDir, logger, taskSchema, utils
    // 禁止注入：state adapter, caseIndex, cognitiveTrace, events
  }

  // 核心生命周期方法
  async create(params)           // 创建 task
  async get(runId)               // 查询 task
  async update(params)           // 更新状态
  async advance(params)          // 推进阶段
  async archive(runId)           // 归档

  // 偏差与归因（v4.3.0 新增）
  async recordDeviation(runId, { type, description, impact })
  async recordAttribution(runId, { rootCause, strategy, impact, deviationIds })

  // 结果与关联（v4.3.0 新增）
  async setOutcome(runId, outcome)
  async linkEventFile(runId, eventFilePath)

  // 校验
  validate(task)
}
```

### EventObject

```javascript
export class EventObject {
  constructor(deps) {
    // deps 仅注入：logger, eventTemplate, baseDir
  }

  // v4.3.0：task 完成后一次性凝练生成
  async generate(runId, task)    // 从 task.json 生成 event.md
  async query(filters)           // 扫描 .agent/events/{date}/
  async archive(runId)           // 移动 event.md
}
```

**原则**：
- TaskObject 是 `task.json` 的唯一写入者
- EventObject 是 `event.md` 的唯一写入者
- 两个对象**不互相调用**，Tool Handler 层负责协调

---

## 工具注册规范

### 注册方式

使用 OpenClaw 新规范：

```javascript
api.registerTool({
  name: 'task.create',
  description: '创建 draft task',
  parameters: { type: 'object', properties: { ... } },
  async execute(_id, params) {
    const result = await taskObject.create(params);
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

通过 `src/tools/return-adapter.js` 统一包裹，业务层不处理格式。

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
  "sessionIds": [],
  "tools": [],
  "revisionReason": "",
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

**生成规则**：task 完成后，EventObject 从 task.json 一次性凝练渲染，不再增量追加。

---

## 错误处理

- 文件 IO 使用 try-catch，失败时返回 `{ error: '...' }` 而非抛出
- 工具层捕获所有异常，通过 `adaptError()` 包裹后返回
- 关闭资源（如数据库连接）在 `gateway_stop` 或进程退出时处理

---

## 开发原则

- **最小变更**：只修改必要的部分，不重构无关代码
- **对象边界**：TaskObject / EventObject 是各自文件的唯一写入者
- **防御式编程**：工具参数校验在 Tool Handler 层和 Object 层双重进行
- **日志前缀**：使用 `[TaskObject]` `[EventObject]` `[Tools]` 等模块前缀
- **版本注释**：重大变更添加 `// v4.3.0: description`

---

## 文件映射

| 路径 | 职责 | 变更频率 |
|------|------|----------|
| `src/index.js` | 插件入口，初始化对象，注册工具 | 低 |
| `src/objects/TaskObject.js` | task.json 生命周期 + 业务规则 | 中 |
| `src/objects/EventObject.js` | event.md 生成 + 查询 | 中 |
| `src/tools/index.js` | 工具注册入口 | 低 |
| `src/tools/task-tools.js` | task.* 工具实现 | 中 |
| `src/tools/event-tools.js` | event.* 工具实现 | 中 |
| `src/tools/schemas.js` | 工具参数 schema | 中 |
| `src/tools/return-adapter.js` | 返回值格式适配 | 低 |
| `src/utils/path.js` | 路径解析（getBaseDir 等） | 低 |
| `src/utils/file.js` | 文件原子读写 | 低 |
| `src/utils/validate.js` | task schema 校验 | 低 |
| `src/assets/task.json` | Task 数据结构模板 | 低 |
| `src/assets/event.md` | Event Markdown 模板 | 低 |

---

## 外部参考

更多技术细节请参阅：

- `docs/roadmap/v4.3.0.md` — 工具插件架构蓝图
- `docs/specs/task-object-interface.md` — TaskObject 完整接口定义
- `docs/specs/event-object-interface.md` — EventObject 完整接口定义
- `docs/specs/tool-registry-interface.md` — Tool Registry 接口定义
- `docs/reference/data-model.md` — 完整 JSON schema 与状态流转规则
- `docs/COLLABORATION.md` — 跨角色协作协议与标记规范
