# 函数模块模型（v4.5.0）

v4.5.0 保持纯函数 + 直接 IO 的扁平架构。不存在类、不存在依赖注入、不存在适配器层。

框架由四层构成：**对象层**（裸函数）、**工具层**（薄适配）、**Hook 层**（条件触发）、**基础设施层**（原子 IO）。

---

## 1. 对象层（Objects）

直接实现业务逻辑，读写文件系统。无类、无状态、无构造函数。

### 1.1 Task 对象模块

**源文件**：`src/objects/task.js`

| 函数 | 参数 | 返回值 | 职责 |
|------|------|--------|------|
| `create(params, context)` | `{ prompt, runId?, taskType?, planInput? }` | `{ task }` 或 `{ error }` | 验证 prompt/runId，生成 plan，写入 `.agentstasks/{runId}.json` |
| `update(params, context)` | `{ runId, status?, deviation?, attribution?, outcome?, eventFilePath?, reason? }` | `{ task, previousStatus?, updatedFields? }` 或 `{ error }` | 读取 task.json，应用部分更新，写回 |
| `advance(params, context)` | `{ runId, phaseId? }` | `{ task, previousPhase, nextPhase, isComplete }` 或 `{ error }` | 推进 currentPhase，标记 completed 若最后阶段 |
| `get(params, context)` | `{ runId }` | `{ task }` 或 `{ error }` | 读取 task.json（先查活跃目录，再查归档目录） |
| `archive(params, context)` | `{ runId }` | `{ success, archivePath }` 或 `{ error }` | 移动 task.json 到 `.agentstasks/archive/` |

**关键设计**：
- `update` 是通用更新入口。Agent 通过一次调用更新状态、偏差、归因、结果中的任意字段。
- 状态转换校验在 `validate.js` 中实现，`update` 拒绝非法状态跳转。
- `archive` 后任务从活跃目录消失，`get` 会自动回退到归档目录查找。

### 1.2 Event 对象模块

**源文件**：`src/objects/event.js`

| 函数 | 参数 | 返回值 | 职责 |
|------|------|--------|------|
| `report(params, context)` | `{ runId }` | `{ eventFilePath }` 或 `{ error }` | 读取 task.json，渲染模板，生成 `.agentsevents/{date}/{runId}.md` |
| `query(params, context)` | `{ runId?, date?, type? }` | `{ events: [] }` 或 `{ error }` | 扫描事件目录，支持按 runId、日期、类型筛选 |
| `archive(params, context)` | `{ runId }` | `{ success, archivePath }` 或 `{ error }` | 移动 event.md 到 `.agentsevents/archive/` |

**关键设计**：
- `report` 是**一次性生成**，非增量追加。仅在任务完成后调用。
- `report` 成功后由 `handlers.report` 自动回写 `eventFilePath` 到 task.json（通过 `task.update`）。
- `query` 只读，不修改任何文件。

---

## 2. 工具层（Tools）

薄适配层，负责将对象层结果转换为 OpenClaw 工具返回格式。

### 2.1 工具注册

**源文件**：`src/tools/index.js`

```javascript
export function registerTools(api, context) {
  for (const name of ALL_TOOLS) {
    const spec = TOOL_SCHEMAS[name];
    const handler = HANDLER_MAP[name];
    api.registerTool({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      execute: async (_id, params) => handler(params, context)
    });
  }
}
```

### 2.2 工具 Handler 映射

**源文件**：`src/tools/handlers.js`

| 命名空间工具 | 对应对象函数 | 特殊行为 |
|-------------|-------------|---------|
| `task.create` | `task.create()` | 直接包装 |
| `task.update` | `task.update()` | 直接包装 |
| `task.advance` | `task.advance()` | 直接包装 |
| `task.get` | `task.get()` | 直接包装 |
| `task.archive` | `task.archive()` | 直接包装 |
| `event.report` | `event.report()` | 成功后自动调用 `task.update` 回写 `eventFilePath` |
| `event.query` | `event.query()` | 直接包装 |
| `event.archive` | `event.archive()` | 直接包装 |

### 2.3 返回值适配

**源文件**：`src/tools/return-adapter.js`

```javascript
// 成功：OpenClaw 标准格式
function adaptReturn(result) {
  return { success: true, data: result };
}

// 失败：OpenClaw 标准格式
function adaptError(message) {
  return { success: false, error: message };
}
```

所有 handler 通过 `wrap(result)` 统一转换：
- 对象函数返回 `{ error }` → `adaptError`
- 对象函数返回正常结果 → `adaptReturn`

---

## 3. 基础设施层（Utils）

### 3.1 原子 IO

**源文件**：`src/utils/io.js`

| 函数 | 职责 |
|------|------|
| `ensureDir(dirPath)` | 递归创建目录 |
| `fileExists(filePath)` | 检查文件是否存在 |
| `readJson(filePath)` | 读取并解析 JSON |
| `writeJson(filePath, data)` | 序列化并原子写入 JSON |
| `writeMarkdown(filePath, content)` | 原子写入 Markdown |
| `moveFile(src, dest)` | 移动文件（用于归档） |
| `atomicWrite(filePath, content)` | 内部：先写 `.tmp` 再 `rename`，保证 POSIX 原子性 |

### 3.2 路径解析

**源文件**：`src/utils/resolve.js`

| 函数 | 返回值 |
|------|--------|
| `taskPath(runId)` | `.agentstasks/{runId}.json` |
| `archiveTaskPath(runId)` | `.agentstasks/archive/{runId}.json` |
| `eventPath(runId, date?)` | `.agentsevents/{date}/{runId}.md` |
| `archiveEventPath(runId, date?)` | `.agentsevents/archive/{date}-{runId}.md` |

### 3.3 校验

**源文件**：`src/utils/validate.js`

| 函数 | 职责 |
|------|------|
| `isValidRunId(runId)` | runId 格式校验 |
| `isValidStatus(status)` | 状态值在白名单中 |
| `canTransition(from, to)` | 状态转换合法性校验 |

### 3.4 生成器

**源文件**：`src/utils/helpers.js`

| 函数 | 职责 |
|------|------|
| `getNow()` | 返回当前 ISO 时间戳 |
| `generateRunId()` | 生成唯一 runId |
| `generatePlan(prompt, planInput?)` | 根据 prompt 和可选 planInput 生成 plan 对象 |

---

## 4. 源码结构（v4.5.0）

```
agent-self-development/
├── openclaw.plugin.json          # 插件 manifest
├── package.json                  # npm 包配置（ESM）
├── README.md                     # 项目总览
├── src/
│   ├── index.js                  # 插件入口：registerTools(api, context)
│   ├── assets/                   # 模板文件
│   │   ├── task.json             # task 初始模板
│   │   └── event.md              # event Markdown 模板
│   ├── objects/                  # 对象层（裸函数）
│   │   ├── task.js               # 5 个 task 函数
│   │   └── event.js              # 3 个 event 函数
│   ├── tools/                    # 工具层
│   │   ├── index.js              # 注册 8 个 tools
│   │   ├── schemas.js            # 8 个 tool 的 parameters schema
│   │   ├── handlers.js           # handler 映射 + 薄适配
│   │   └── return-adapter.js     # adaptReturn / adaptError
│   └── utils/                    # 基础设施
│       ├── io.js                 # 原子文件 IO
│       ├── resolve.js            # 路径解析
│       ├── validate.js           # 校验逻辑
│       └── helpers.js            # 生成器工具
├── test/                         # 测试套件
├── skills/                       # 项目级技能
├── .agents                       # 角色定义
└── docs/                         # 项目文档
```

---

## 5. 与 v4.2.0 面向对象模型的对比

| 维度 | v4.2.0 | v4.3.0 |
|------|--------|--------|
| 代码单元 | 类（构造函数 + 方法 + 状态） | **纯函数**（无 this，无状态） |
| 依赖注入 | `deps.state`, `deps.memory` 注入 | **直接 import io.js** |
| 适配器 | `State` / `Memory` / `Flow` 适配器类 | **无适配器，直接文件读写** |
| Hook | 7 个 Hook + `HookRegistry` | **条件触发**（after_tool_call + before_prompt_build） |
| 模块 | Metacognition / WorkingMemory / Personality | **全部移除** |
| 工具数量 | 13 个 | **8 个**（聚焦核心） |
| 可测试性 | 需要 mock 依赖注入容器 | **直接 mock fs/promises** |

---

*文档版本：v4.5.0*
*最后更新：2026-05-19*
*维护者：Developer*
