# EventObject 接口规范

> **版本**：v4.3.0  
> **范围**：`src/objects/EventObject.js`  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-19  
> **关联文档**：`docs/roadmap/v4.3.0.md`、`docs/architecture/adr-011.md`、`docs/architecture/adr-013.md`

---

## 1. 概述

EventObject 是 `event.md` 的**唯一生成者**和**查询者**。

**核心策略变更（v4.3.0）**：
- **删除**实时增量追加模式（旧版 `_appendToSection`、`record()` 已废弃）
- **新增**延迟凝练模式：`generate(runId, task)` 在 task 完成后一次性渲染完整 event.md
- Event.md 是**独立产品**：仅由 Agent 显式调用 `event.record` 触发生成

**职责边界**：
- EventObject = 模板渲染 + 路径管理 + 查询/归档
- `utils/file.js` = 原始文件原子读写（纯 IO）

---

## 2. 依赖注入

```typescript
interface EventObjectDeps {
  projectRoot: string;           // 项目根目录绝对路径
  eventTemplate?: string;        // 可选：assets/event.md 模板字符串（带 `{{placeholder}}`）
  logger?: Logger;               // 可选：OpenClaw api.logger
}
```

**注意**：v4.3.0 移除 `project-context.js` 依赖，改为使用 `utils/path.js` 解析项目级路径。

---

## 3. 类定义

```typescript
class EventObject {
  constructor(deps: EventObjectDeps);

  // ── 生成（v4.3.0 核心变更）──
  async generate(runId: string, task: Task): Promise<GenerateResult>;

  // ── 查询 ──
  async query(filters?: EventQueryFilters): Promise<QueryResult>;

  // ── 归档 ──
  async archive(runId: string, eventFilePath: string): Promise<ArchiveResult>;

  // ── 内部方法 ──
  _renderTemplate(template: string, data: TemplateData): string;        // 同步
  _parseEventFile(content: string): ParsedEvent;                        // 同步
  _getEventPath(runId: string, task: Task): string;                     // 同步
}
```

---

## 4. generate（核心方法）

在 task 完成后，读取 `task.json`，渲染模板，写入 `event.md`。

**调用时机**：
- Agent 在任务完成后显式调用 `event.record` tool
- 仅当 `task.status === 'completed'` 时允许生成

**输入**：

```typescript
interface GenerateParams {
  runId: string;                 // 必填，任务唯一标识
  task: Task;                    // 必填，完整的 task 对象（从 task.json 读取）
}
```

**输出**：

```typescript
interface GenerateResult {
  eventFilePath: string;         // 生成的 event.md 绝对路径
  content: string;               // 渲染后的完整 markdown 内容
}

// 错误时返回
interface GenerateError {
  error: string;                 // "task 未处于 completed 状态" / "模板渲染失败" / "写入失败"
  details?: string;
}
```

**业务规则**：
1. 校验 `task.status === 'completed'`，否则拒绝生成
2. 从 `deps.eventTemplate` 或 `assets/event.md` 加载模板
3. 使用 `_renderTemplate()` 将 `task` 数据注入模板占位符
4. 目标路径：`{projectRoot}/.agent/events/{date}/{runId}.md`
   - `date` 由 `task.createdAt` 解析为 `YYYY-MM-DD`
   - 若 `events/{date}/` 目录不存在，自动创建
5. 生成后自动调用 `task.linkEventFile(runId, eventFilePath)`，将路径写回 `task.json`

**模板占位符（v4.3.0 标准模板）**：

| 占位符 | 来源 | 说明 |
|--------|------|------|
| `{{runId}}` | `task.runId` | 任务标识 |
| `{{date}}` | `task.createdAt` → YYYY-MM-DD | 创建日期 |
| `{{taskType}}` | `task.taskType` | 任务类型 |
| `{{prompt}}` | `task.plan.prompt` | 原始输入（前 500 字截断） |
| `{{goal}}` | `task.plan.context.goal` | 目标 |
| `{{status}}` | `task.status` | 完成状态 |
| `{{phases}}` | `task.plan.execution.phases` | 阶段列表（渲染为表格） |
| `{{deviations}}` | `task.deviations` | 偏差列表（含归因状态） |
| `{{attributions}}` | `task.attributions` | 归因记录列表 |
| `{{outcome}}` | `task.outcome` | 结果摘要 |
| `{{tools}}` | `task.tools` | 使用工具列表 |

**模板渲染规则**：
- 数组渲染为 markdown 列表或表格（按占位符上下文）
- 若字段为 `undefined` 或空数组，渲染为空字符串或 "无"
- 多行文本自动处理 markdown 转义

---

## 5. query

查询 event.md 文件。

**输入**：

```typescript
interface EventQueryFilters {
  runId?: string;                // 精确匹配 runId
  date?: string;                 // 匹配 YYYY-MM-DD 格式的日期目录
  type?: 'deviation' | 'attribution'; // 筛选事件类型（需解析内容后过滤）
  status?: 'completed' | 'archived';  // 任务状态（从文件名推断）
}
```

**输出**：

```typescript
interface QueryResult {
  events: EventItem[];           // 匹配的事件列表
  total: number;                 // 匹配总数
}

interface EventItem {
  runId: string;
  eventFilePath: string;         // 绝对路径
  date: string;                  // YYYY-MM-DD
  status: string;                // 解析后的任务状态
  deviations?: number;           // 偏差数量（需解析内容）
  attributions?: number;         // 归因数量（需解析内容）
  generatedAt?: number;          // 文件 mtime
}

// 错误时返回
interface QueryError {
  error: string;
}
```

**查询规则**：
1. 遍历 `{projectRoot}/.agent/events/` 下的所有 `YYYY-MM-DD/` 子目录
2. 每个目录下读取所有 `.md` 文件
3. 按 `runId`、`date`、`type` 过滤
4. `type` 过滤需调用 `_parseEventFile()` 解析内容后匹配
5. 结果按 `date` 降序、`runId` 降序排列

---

## 6. archive

归档 event.md 文件。

**输入**：

```typescript
interface ArchiveParams {
  runId: string;                 // 必填
  eventFilePath: string;         // 必填，event.md 文件绝对路径
}
```

**输出**：

```typescript
interface ArchiveResult {
  archived: boolean;
  archivedAt: number;            // Date.now()
  archivedPath: string;          // 归档后的文件路径
}

// 错误时返回
interface ArchiveError {
  error: string;                 // "文件不存在" / "移动失败"
}
```

**业务规则**：
1. 源路径：`eventFilePath`
2. 目标路径：`{projectRoot}/.agent/events/archive/{date}/{runId}.md`
   - `date` 从原路径中解析，若无法解析则使用当前日期
3. 原子操作：读取 → 移动到 archive/ → 验证
4. 若 archive 目录不存在，自动创建

---

## 7. 内部方法

### 7.1 _renderTemplate

同步方法，将数据注入模板字符串。

**签名**：

```typescript
_renderTemplate(template: string, data: TemplateData): string
```

**TemplateData 结构**：

```typescript
interface TemplateData {
  runId: string;
  date: string;
  taskType?: string;
  prompt: string;
  goal: string;
  status: string;
  phases: Phase[];
  deviations: Deviation[];
  attributions: Attribution[];
  outcome: Outcome;
  tools: string[];
}
```

**渲染规则**：
- 使用简单的字符串替换：`template.replace(/\{\{(\w+)\}\}/g, ...)`
- 复杂字段（`phases`、`deviations`、`attributions`、`outcome`）使用自定义渲染函数
- `phases` 渲染为 markdown 表格（ID | Name | Status）
- `deviations` 渲染为无序列表，标注 `[已归因]` / `[未归因]`
- `attributions` 渲染为有序列表，含 rootCause 和 strategy
- `outcome` 渲染为摘要块

**示例输出片段**：

```markdown
# Event Report: abc-123

- **Run ID**: abc-123
- **Date**: 2026-05-19
- **Task Type**: coding
- **Status**: completed

## Goal
实现 TaskObject 接口重写

## Phases
| ID | Name | Status |
|----|------|--------|
| p1 | Planning | completed |
| p2 | Implementation | completed |

## Deviations
- [未归因] scope_creep: 接口文档范围扩大，增加 3 个新增方法
  Impact: 导致 M1 延期 1 天

## Attributions
1. **Root Cause**: 设计阶段未充分评估变更范围
   **Strategy**: M1 接受标准增加零残留验证（P1-4）

## Outcome
- Summary: 完成三份接口文档重写
- Deliverables: task-object-interface.md, event-object-interface.md, tool-registry-interface.md
```

### 7.2 _parseEventFile

同步方法，解析 event.md 文件内容为结构化数据。

**签名**：

```typescript
_parseEventFile(content: string): ParsedEvent
```

**ParsedEvent 结构**：

```typescript
interface ParsedEvent {
  runId: string;
  date: string;
  status: string;
  goal: string;
  phases: ParsedPhase[];
  deviations: ParsedDeviation[];
  attributions: ParsedAttribution[];
  outcome: ParsedOutcome;
  metadata: {
    generatedAt?: number;
    templateVersion?: string;
  };
}

interface ParsedPhase {
  id: string;
  name: string;
  status: string;
}

interface ParsedDeviation {
  type: string;
  description: string;
  impact?: string;
  attributed: boolean;
}

interface ParsedAttribution {
  rootCause: string;
  strategy: string;
  impact?: string;
}

interface ParsedOutcome {
  summary?: string;
  deliverables?: string[];
  lessonsLearned?: string;
}
```

**解析规则**：
- 使用正则表达式匹配 markdown 标题和内容块
- `## Deviations` 下的 `-` 列表项解析为偏差
- `## Attributions` 下的 `1.` / `**Root Cause**` 解析为归因
- 解析失败时返回空结构，不抛错

### 7.3 _getEventPath

同步方法，计算 event.md 的目标路径。

**签名**：

```typescript
_getEventPath(runId: string, task: Task): string
```

**规则**：

```typescript
const date = new Date(task.createdAt).toISOString().slice(0, 10); // YYYY-MM-DD
return path.join(projectRoot, '.agent', 'events', date, `${runId}.md`);
```

---

## 8. 文件路径映射

| 操作 | 活跃路径 | 归档路径 |
|------|---------|---------|
| generate | — | `{projectRoot}/.agent/events/{date}/{runId}.md` |
| query | 遍历 `{projectRoot}/.agent/events/` 所有子目录 | 不包含 archive/ |
| archive | 从活跃路径移动 | `{projectRoot}/.agent/events/archive/{date}/{runId}.md` |

---

## 9. 与 TaskObject 的协作

```
Agent 完成任务
    │
    ▼
调用 task.update({ status: 'completed', outcome: {...} })
    │
    ▼
调用 event.record({ runId })   // Tool Handler → EventObject.generate()
    │
    ▼
EventObject.generate(runId, task):
  1. 校验 task.status === 'completed'
  2. 渲染 event.md 模板
  3. 写入 .agent/events/{date}/{runId}.md
  4. 调用 task.linkEventFile(runId, eventFilePath)
    │
    ▼
返回 { eventFilePath }
```

**关键约束**：
- `event.record` 是**显式调用**，Agent 自主决定是否生成 event.md
- 偏差/归因数据**仅存在于 task.json**，event.md 是只读渲染产物
- event.md 生成后不再修改；如需更新，重新生成覆盖

---

## 10. 错误码

| 错误码 | 场景 |
|--------|------|
| `task_not_completed` | generate 时 task.status ≠ completed |
| `template_not_found` | 无法加载 assets/event.md 模板 |
| `render_failed` | 模板渲染时异常 |
| `write_failed` | 写入 event.md 时 IO 错误 |
| `file_not_found` | archive 时文件不存在 |
| `move_failed` | 归档时移动文件失败 |

---

*文档版本：v2.0.0*  
*状态：[ARCH_READY]*  
*关联 ADR：ADR-011（单次写入源）、ADR-013（event.md 延迟凝练策略）*
