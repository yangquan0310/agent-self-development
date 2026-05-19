# 事件管理工作流

事件报告生成、查询和归档的详细指南。

## 生成事件报告

```
1. 确认 task.status === "completed"
   - 如未完成，event.report 将拒绝执行
2. 调用 event.report({ runId })
3. 内部流程：
   a. 读取 task.json，路径：`.agent/tasks/{runId}.json`
   b. 如活跃目录未找到，回退到 `.agent/tasks/archive/{runId}.json`
   c. 校验 task.status === "completed"
   d. 加载模板 `src/assets/event.md`
   e. 使用 task 数据渲染 Markdown：
      - 元信息：runId、status、taskType、createdAt、completedAt
      - 计划：goal、constraints、successCriteria、phases
      - 执行：各阶段完成状态
      - 偏差：所有偏差记录
      - 归因：所有归因记录
      - 结果：summary、artifacts、metrics
   f. 从 task.createdAt 解析日期 → `YYYY-MM-DD`
   g. 写入 `.agent/events/{YYYY-MM-DD}/{runId}.md`
   h. 调用 task.update({ runId, eventFilePath }) 自动关联
4. 返回 { eventFilePath }
```

## 查询事件

```
event.query({ runId?, date?, type? })
```

### 按 runId 查询

```
event.query({ runId: "20260519-abc123" })
→ 返回匹配该 runId 的所有事件
```

### 按日期查询

```
event.query({ date: "2026-05-19" })
→ 返回该日期下的所有事件
```

### 按类型查询

```
event.query({ type: "deviation" })
→ 返回仅包含偏差记录的事件
```

### 组合查询

```
event.query({ runId: "20260519-abc123", type: "attribution" })
→ 返回指定任务的归因记录
```

## 归档事件

```
1. 确认事件文件存在且不再需要频繁访问
2. 调用 event.archive({ runId })
3. 系统执行：
   a. 定位 `.agent/events/{日期}/{runId}.md`
   b. 移动到 `.agent/events/archive/{日期}-{runId}.md`
4. 返回 { success, archivePath }
```

## 事件生成后的人格调节工作流

这是事件管理的核心闭环之一。事件文件生成后，Agent 应主动回顾并决定是否需要更新人格。

```
event.report({ runId }) 成功返回
  → 读取返回的 reflectionPrompt
  → 读取生成的 event.md（特别是"5. 回顾与调节"章节）
  → 分析偏差与归因：
      - 本次有哪些偏差？根因是什么？
      - 归因分析揭示了什么模式？
  → 判断调节类型：
      - 同化：成功经验与现有认知一致 → 强化 MEMORY.md 的 If-Then 规则
      - 顺应：遭遇能力盲区或价值观冲突 → 更新 SOUL.md / IDENTITY.md
  → 检查技能变化：
      - 新获得的技能 → 更新 skills/README.md
      - 发现的技能短板 → 记录改进计划
  → 执行更新（Agent 直接读写人格文件）
```

**注意**：人格更新完全由 Agent 自主决定。插件只提供事件数据和调节提示，不做任何自动修改。

## 完整生命周期示例

```
[任务执行完成]
  → task.update({ runId, status: "completed" })
  → task.update({ runId, outcome: { summary: "...", artifacts: [...] } })
  → event.report({ runId })
      → 生成 .agent/events/2026-05-19/20260519-abc123.md（含"回顾与调节"章节）
      → 返回 reflectionPrompt，提示 Agent 考虑人格更新
      → 自动更新 task.json 的 eventFilePath
  → [Agent 自主回顾事件，决定更新 SOUL.md / MEMORY.md]
  → [数日后不再需要]
  → event.archive({ runId })
      → 移动到 .agent/events/archive/2026-05-19-20260519-abc123.md
  → task.archive({ runId })
      → 移动到 .agent/tasks/archive/20260519-abc123.json
```

## 文件路径

| 类型 | 活跃路径 | 归档路径 |
|------|---------|---------|
| 事件 | `.agent/events/{YYYY-MM-DD}/{runId}.md` | `.agent/events/archive/{日期}-{runId}.md` |
| 任务 | `.agent/tasks/{runId}.json` | `.agent/tasks/archive/{runId}.json` |
