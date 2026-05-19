---
name: event-management
description: >
  指导 Agent 使用 event.* 命名空间工具管理事件（Event）Markdown 文件生命周期。
  当 Agent 需要创建事件文件、记录偏差/归因到 event.md、查询事件记录、归档事件时，使用此技能。
  触发条件：(1) 任务创建后需要初始化事件文件，(2) 需要记录偏差或归因到 event.md，
  (3) 需要查询历史事件记录，(4) 任务完成需要归档事件。
---

# 事件管理技能（Event Management）

> 版本：v1.0.0
> 对应插件：agent-self-development v4.3.0+

## 核心对象：EventObject

EventObject 是 `event.md` 的唯一写入者。所有事件记录必须通过 event.* 工具调用，Agent 不得直接读写 event.md 文件。

## 工具清单（2 个）

| 工具 | 用途 | 触发场景 |
|------|------|----------|
| `event.record` | 记录偏差或归因到 event.md | 发现偏差或完成归因分析时 |
| `event.query` | 查询事件记录 | 需要回顾历史偏差/归因时 |

## event.record 详解

`event.record` 是**统一记录入口**，通过 `recordType` 参数区分偏差和归因：

### 记录偏差
```javascript
event.record({
  runId: "uuid",
  recordType: "deviation",
  data: {
    type: "scope_creep",      // 偏差类型
    description: "偏差描述",  // 必填
    impact: "影响评估"        // 可选
  },
  task: taskObject  // 可选，用于定位事件文件
})
```

### 记录归因
```javascript
event.record({
  runId: "uuid",
  recordType: "attribution",
  data: {
    rootCause: "根本原因",    // 必填
    strategy: "改进策略",     // 必填
    impact: "影响范围"         // 可选
  },
  task: taskObject  // 可选，用于定位事件文件
})
```

## 事件文件结构

Event.md 包含七章节：
1. **元信息** — runId, agentId, role, 创建时间
2. **计划** — 目标, 验收标准
3. **执行** — 阶段数, 实际完成
4. **变更记录** — 文件编辑审计
5. **偏差（Deviation）** — 发现的偏差列表
6. **归因（Attribution）** — 根因分析和改进策略
7. **结果（Outcome）** — 最终状态, 归档时间

文件路径规则：`.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md`

## 标准工作流

### 创建事件文件
```
1. 调用 task.create 创建任务
2. 系统自动生成 eventFilePath
3. 首次调用 event.record 时自动创建 event.md（从模板渲染）
```

### 记录偏差
```
1. 发现偏差
2. 调用 task.deviate({ runId, type, description, impact }) — 更新 task.json
3. 调用 event.record({ runId, recordType: "deviation", data, task }) — 追加到 event.md
```

### 记录归因
```
1. 分析偏差根因
2. 调用 task.attribute({ runId, rootCause, strategy, impact }) — 更新 task.json
3. 调用 event.record({ runId, recordType: "attribution", data, task }) — 追加到 event.md
```

## 注意事项

- event.md 是项目级文件（相对于 projectRoot），不是系统级文件
- 章节追加采用「切片替换」策略，不重新渲染全文件
- 查询时解析 Markdown 章节结构返回结构化数据
- 归档时将 event.md 内容打包到系统级 Memory EventLog

## 数据结构参考

Event Markdown 完整模板见 `references/event-template.md`
