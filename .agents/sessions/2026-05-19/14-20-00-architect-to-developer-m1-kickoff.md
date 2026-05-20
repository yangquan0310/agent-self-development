# Architect → Developer：M1 启动指令与实现指南

> **事件类型**：指令 + 实现指南  
> **来源**：Architect  
> **目标角色**：Developer  
> **日期**：2026-05-19  
> **关联文档**：`docs/adr/adr-014.md`、`docs/CONVENTIONS.md`、`docs/specs/*.md`  
> **关联 ADR**：ADR-014（扁平化架构）  
> **里程碑**：M1 截止 2026-05-23

---

## 1. 问题

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | `src/objects/TaskObject.js` 和 `src/objects/EventObject.js` 仍使用旧架构（类封装、依赖注入、增量追加） | 🔴 阻塞 | Architect | 🚧 待 Developer 重写 |
| I2 | `src/index.js` 仍初始化旧框架（metacognition、heartbeat 等） | 🔴 阻塞 | Architect | 🚧 待 Developer 重写 |
| I3 | `src/common/` 下大量旧模块未清理 | 🔴 阻塞 | Architect | 🚧 待 Developer 删除/迁移 |
| I4 | 当前仅暴露 6 个工具，缺少 `event.query` 和 `event.archive` | 🟡 中 | Architect | 🚧 待 Developer 补充 |

---

## 2. 已解决

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | 架构方向 | ADR-014 确定：扁平化，4 文件夹（assets/objects/tools/utils），8 个工具 | Architect | 2026-05-19 |
| R2 | 接口冻结 | 三份 specs + CONVENTIONS.md 全部 `[ARCH_READY]` | Architect | 2026-05-19 |
| R3 | task.json 模板 | 已删除 `sessionIds`/`tools`/`revisionReason` | Architect | 2026-05-19 |
| R4 | event.query + event.archive | 已在 tool-registry-interface.md 中注册定义 | Architect | 2026-05-19 |

---

## 3. 待解决

### P1：创建新文件（优先级：高，建议首日完成）

按以下顺序实现：

**第一步：`src/utils/io.js` 和 `src/utils/resolve.js`**

```javascript
// utils/io.js
export async function readJson(path)       // 读 JSON，不存在返回 null
export async function writeJson(path, data) // 写 JSON，自动 ensureDir
export async function ensureDir(path)       // 递归创建目录
export async function moveFile(src, dst)    // 移动文件
```

```javascript
// utils/resolve.js
export function taskPath(runId)             // {baseDir}/.agentstasks/{runId}.json
export function archiveTaskPath(runId)      // {baseDir}/.agentstasks/archive/{runId}.json
export function eventPath(runId, date)      // {baseDir}/.agentsevents/{date}/{runId}.md
export function archiveEventPath(date, runId) // {baseDir}/.agentsevents/archive/{date}-{runId}.md
```

**第二步：`src/objects/task.js`**

5 个纯函数，直接调用 `utils/io.js`：
- `create(params, context)` — 参考 specs §4
- `update(params, context)` — 参考 specs §5（核心：万能更新入口）
- `advance(params, context)` — 参考 specs §6
- `get(params, context)` — 参考 specs §7（双路径扫描）
- `archive(params, context)` — 参考 specs §8

**第三步：`src/objects/event.js`**

3 个纯函数：
- `report(params, context)` — 参考 specs §4（双路径扫描 task.json → 渲染 → 写 event.md）
- `query(params, context)` — 参考 specs §5
- `archive(params, context)` — 参考 specs §6

**第四步：`src/tools/schemas.js`**

8 个工具的 JSON Schema：
```
task.create / task.update / task.advance / task.get / task.archive
event.report / event.query / event.archive
```

**第五步：`src/tools/handlers.js`**

```javascript
import * as task from '../objects/task.js';
import * as event from '../objects/event.js';
import { adaptReturn, adaptError } from './adapter.js';

export async function create(params, context) {
  const result = await task.create(params, context);
  return result.error ? adaptError(result.error) : adaptReturn(result);
}
// ... 同理实现 update / advance / get / archive / report / query / eventArchive
```

**注意**：`event.report` 的 handler 需额外调用 `task.update` 关联 `eventFilePath`：
```javascript
export async function report(params, context) {
  const result = await event.report(params, context);
  if (result.error) return adaptError(result.error);
  await task.update({ runId: params.runId, eventFilePath: result.eventFilePath }, context);
  return adaptReturn(result);
}
```

**第六步：`src/tools/index.js`**

遍历注册 8 个工具：
```javascript
import * as handlers from './handlers.js';
import * as schemas from './schemas.js';

export function registerTools(api, context) {
  const tools = [
    { name: 'task.create',    schema: schemas.create,    handler: handlers.create },
    { name: 'task.update',    schema: schemas.update,    handler: handlers.update },
    { name: 'task.advance',   schema: schemas.advance,   handler: handlers.advance },
    { name: 'task.get',       schema: schemas.get,       handler: handlers.get },
    { name: 'task.archive',   schema: schemas.archive,   handler: handlers.archive },
    { name: 'event.report',   schema: schemas.report,    handler: handlers.report },
    { name: 'event.query',    schema: schemas.query,     handler: handlers.query },
    { name: 'event.archive',  schema: schemas.eventArchive, handler: handlers.eventArchive },
  ];
  for (const t of tools) {
    api.registerTool({
      name: t.name,
      description: t.schema.description,
      parameters: t.schema.parameters,
      async execute(_id, params) { return t.handler(params, context); }
    });
  }
}
```

**第七步：`src/tools/adapter.js`**

直接复用现有 `src/tools/return-adapter.js` 的逻辑。

**第八步：`src/index.js`**

```javascript
import { readFileSync } from 'fs';
import { registerTools } from './tools/index.js';

export async function initialize(api, config) {
  const baseDir = config.projectRoot || process.cwd();
  const templates = {
    task: JSON.parse(readFileSync(`${baseDir}/src/assets/task.json`, 'utf-8')),
    event: readFileSync(`${baseDir}/src/assets/event.md`, 'utf-8')
  };
  registerTools(api, { templates, baseDir, logger: api.logger });
}
```

---

### P2：删除旧文件（优先级：高，与 P1 并行）

**必须删除**：
- `src/metacognition/`（整个目录）
- `src/working-memory/`（整个目录）
- `src/personality/`（整个目录）
- `src/common/adapters/`（整个目录）
- `src/common/heartbeat.js`
- `src/common/cognitive-trace.js`
- `src/common/case-index.js`
- `src/common/skills.js`
- `src/common/template-engine.js`
- `src/common/stream.js`
- `src/common/hook.js`
- `src/common/project-context.js`（功能迁移到 `utils/resolve.js`）
- `src/common/utils.js`（功能分拆到 `utils/io.js` 等）

**重写**：
- `src/objects/TaskObject.js` → 删除，由 `objects/task.js` 替代
- `src/objects/EventObject.js` → 删除，由 `objects/event.js` 替代
- `src/index.js` → 重写（<50 行）

---

### P3：P1-4 零残留验证（M1 验收日执行）

```bash
grep -r "metacognition\|workingMemory\|personality\|heartbeat\|cognitiveTrace\|caseIndex" src/
grep -r "TaskObject\|EventObject" src/
grep -r "create_plan\|update_task_status\|advance_phase\|get_task_status\|get_task_files\|self_diagnose\|archive_task\|record_deviation\|record_attribution\|get_planning_guide\|get_monitoring_guide\|get_regulation_guide\|get_development_guide" src/ test/
grep -r "task.deviate\|task.attribute\|task.files\|task.diagnose\|guide.planning\|guide.monitoring\|guide.regulation\|guide.development" src/ test/
```

**验收标准**：以上 4 条命令全部零匹配。

---

## 4. 建议

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | **实现顺序**：`utils/` → `objects/` → `tools/` → `index.js`。`utils/io.js` 是基础依赖，优先实现 | Architect | 🔴 高 | 待确认 |
| S2 | **保留 `src/common/utils.js` 中的有用函数**（如 `safeReadJson`、`safeWriteJson`、`getNow`）迁移到 `utils/io.js` 或 `utils/helpers.js`，不要重写 | Architect | 🟡 中 | 待确认 |
| S3 | `task.update` 是核心难点，建议先实现 `create` + `get` 验证 IO 通路，再实现 `update` | Architect | 🟡 中 | 待确认 |
| S4 | 旧的 `src/templates/` 目录（如果存在）应移至 `src/assets/templates/` | Architect | 🟢 低 | 待确认 |
| S5 | 若发现架构不可行（如文件 IO 原子性无法满足），立即通过 `.agentssessions/` 输出 `[TECH_BLOCKER]` | Architect | 🔴 高 | 待确认 |

---

## 5. 参考文档速查

| 文档 | 用途 |
|------|------|
| `docs/adr/adr-014.md` | 架构决策：为什么扁平化、为什么 4 文件夹 |
| `docs/CONVENTIONS.md` | 命名规范、目录结构、开发原则 |
| `docs/specs/task-object-interface.md` | `objects/task.js` 5 个函数的参数和返回值 |
| `docs/specs/event-object-interface.md` | `objects/event.js` 3 个函数的参数和返回值 |
| `docs/specs/tool-registry-interface.md` | 8 个工具的 schema、handler 签名、注册方式 |
| `src/assets/task.json` | Task 数据结构模板 |
| `src/assets/event.md` | Event Markdown 模板 |

---

*事件创建：Architect*  
*日期：2026-05-19*  
*`[ARCH_READY]`*
