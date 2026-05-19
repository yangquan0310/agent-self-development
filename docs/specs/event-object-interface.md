# Event Handler 接口规范

> **版本**：v4.3.0  
> **范围**：`src/tools/handlers.js` 中事件报告相关函数  
> **状态**：[ARCH_READY]  
> **作者**：Architect  
> **更新日期**：2026-05-19  
> **关联 ADR**：`docs/adr/adr-014.md`（扁平化架构）  
> **关联文档**：`docs/roadmap/v4.3.0.md` v2.0.0

---

## 1. 概述

v4.3.0 采用扁平化架构：**Tool Handler 直接读写 `event.md`**，不引入 EventObject 中间层。

本规范定义 1 个事件报告 Handler 的接口契约（`query` 和 `archive` 为辅助功能）。

---

## 2. 依赖

```javascript
// Handler 通过 context 接收以下依赖
const context = {
  templates: { event: string },   // 加载后的 event.md 模板字符串
  logger: Logger,                 // 可选
  baseDir: string                 // 项目根目录绝对路径
};
```

---

## 3. Handler 定义

```javascript
export async function reportEvent(params, context)   // 生成 event.md
export async function queryEvent(params, context)    // 查询 events
export async function archiveEvent(params, context)  // 归档 event.md
```

---

## 4. reportEvent（核心方法）

读取 `task.json`，渲染模板，写入 `event.md`。

**输入**：

```typescript
interface ReportEventParams {
  runId: string;                 // 必填
}
```

**输出**：

```typescript
interface ReportEventResult {
  eventFilePath: string;         // 生成的 event.md 绝对路径
  content: string;               // 渲染后的完整 markdown
}

interface ReportEventError {
  error: string;
  details?: string;
}
```

**业务规则**：
1. 扫描双路径读取 `task.json`：
   - `{baseDir}/.agent/tasks/{runId}.json`
   - `{baseDir}/.agent/tasks/archive/{runId}.json`
   - 均不存在则返回错误
2. 校验 `task.status === 'completed'`，否则拒绝生成
3. 从 `templates.event` 加载模板
4. 渲染后写入 `{baseDir}/.agent/events/{date}/{runId}.md`
   - `date` 由 `task.createdAt` 解析为 `YYYY-MM-DD`
5. 返回 `eventFilePath`，由 Tool Handler 层决定是否调用 `task.update` 关联

---

## 5. queryEvent

查询 event.md 文件。

**输入**：

```typescript
interface QueryEventParams {
  runId?: string;                // 精确匹配
  date?: string;                 // YYYY-MM-DD
  type?: 'deviation' | 'attribution';
}
```

**输出**：

```typescript
interface QueryEventResult {
  events: EventItem[];
  total: number;
}

interface EventItem {
  runId: string;
  eventFilePath: string;
  date: string;
  status: string;
  deviations?: number;
  attributions?: number;
  generatedAt?: number;
}
```

**查询规则**：
- 遍历 `{baseDir}/.agent/events/` 下的所有 `YYYY-MM-DD/` 子目录
- `type` 过滤需解析文件内容后匹配
- 结果按 `date` 降序排列

---

## 6. archiveEvent

归档 event.md。

**输入**：`{ runId: string }`

**输出**：

```typescript
interface ArchiveEventResult {
  archived: boolean;
  archivedAt: number;
  archivedPath: string;
}

interface ArchiveEventError {
  error: string;
}
```

**业务规则**：
- 源路径：从 `.agent/events/` 下扫描找到包含该 runId 的 `.md` 文件
- 目标路径：`{baseDir}/.agent/events/archive/{date}-{runId}.md`

---

## 7. 模板渲染

**模板占位符**：

| 占位符 | 来源 |
|--------|------|
| `{{runId}}` | `task.runId` |
| `{{date}}` | `task.createdAt` → YYYY-MM-DD |
| `{{taskType}}` | `task.taskType` |
| `{{prompt}}` | `task.plan.prompt`（前 500 字截断） |
| `{{goal}}` | `task.plan.context.goal` |
| `{{status}}` | `task.status` |
| `{{phases}}` | `task.plan.execution.phases`（表格） |
| `{{deviations}}` | `task.deviations`（列表，标注归因状态） |
| `{{attributions}}` | `task.attributions`（列表） |
| `{{outcome}}` | `task.outcome`（摘要块） |
| `{{tools}}` | `task.plan.workspace.tools` |

**渲染规则**：
- 简单字符串替换：`template.replace(/\{\{(\w+)\}\}/g, ...)`
- 复杂字段（`phases`、`deviations`、`attributions`）使用自定义渲染函数
- `undefined` 或空数组渲染为空字符串或 "无"

---

## 8. 文件路径映射

| 操作 | 活跃路径 | 归档路径 |
|------|---------|---------|
| reportEvent | — | `{baseDir}/.agent/events/{date}/{runId}.md` |
| queryEvent | 遍历 `{baseDir}/.agent/events/` | 不包含 archive/ |
| archiveEvent | 从活跃路径移动 | `{baseDir}/.agent/events/archive/{date}-{runId}.md` |

---

*文档版本：v3.0.0*  
*状态：[ARCH_READY]*  
*关联 ADR：ADR-014（扁平化架构）*
