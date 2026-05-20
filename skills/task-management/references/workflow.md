# 任务管理工作流

各操作的详细分步指南。

## 创建任务

```
1. 评估任务复杂度 → 决定是否需要制定 Plan
2. 调用 task.create({
     prompt: "用户原始需求",
     taskType?: "task" | "coding" | "research" | "documentation",
     planInput?: {
       goal: "任务目标",
       constraints?: ["约束条件1", "约束条件2"],
       successCriteria?: ["验收标准1", "验收标准2"],
       phases?: [
         { id: "p1", name: "阶段名称", goal: "阶段目标", outputs?: ["文件1.md"] }
       ]
     }
   })
3. 接收返回的 task JSON
4. 向用户展示计划等待确认
```

- `runId` 自动生成（格式：`{YYYYMMDD}-{后缀}`），也可手动指定
- 如提供 `planInput`，直接使用；否则从 `prompt` 自动推断
- `taskType` 默认为 `"task"`

## 更新状态

```
task.update({ runId, status: "新状态", reason?: "变更原因（可选）" })
```

| 当前状态 | 新状态 | 方式 |
|---------|--------|------|
| draft | pending_approval | `task.update({ status: "pending_approval" })` |
| pending_approval | active | `task.update({ status: "active" })` |
| pending_approval | revising | `task.update({ status: "revising" })` → 修改 plan → `task.update({ status: "draft" })` |
| active | completed | `task.advance()` 返回 `isComplete: true`，或 `task.update({ status: "completed" })` |
| revising | draft | `task.update({ status: "draft" })` |

## 记录偏差

```
1. 识别偏差（范围蔓延、技术债务、输出不符等）
2. 调用 task.update({
     runId,
     deviation: {
       type: "scope_creep | technical_debt | output_mismatch | doc_lag | context_loss | file_mismatch | other",
       description: "偏差描述",
       impact?: "影响评估（可选）"
     }
   })
3. 偏差追加到 task.json 的 `deviations[]` 数组
```

## 记录归因

```
1. 分析偏差的根本原因
2. 调用 task.update({
     runId,
     attribution: {
       rootCause: "根本原因",
       strategy: "改进策略",
       impact?: "影响范围（可选）"
     }
   })
3. 归因追加到 task.json 的 `attributions[]` 数组
```

## 记录结果

```
1. 任务全部完成
2. 调用 task.update({
     runId,
     outcome: {
       summary: "完成摘要",
       artifacts?: ["产出文件1.md", "产出文件2.js"],
       metrics?: { phasesCompleted: 3, deviationsCount: 1 }
     }
   })
```

## 推进阶段

```
1. 完成当前阶段工作
2. 调用 task.advance({ runId, phaseId?: "指定阶段ID" })
3. 检查返回结果：
   - isComplete: true → 所有阶段完成，进入结果记录 + 事件生成 + 归档
   - isComplete: false → 继续下一阶段
```

## 查询任务

```
1. 调用 task.get({ runId })
2. 系统依次检查：
   - 先查 `.agentstasks/{runId}.json`
   - 回退到 `.agentstasks/archive/{runId}.json`
3. 返回完整 task.json 或错误
```

## 归档任务

```
1. 确认任务状态为 "completed"
2. 调用 task.archive({ runId })
3. task.json 移动到 `.agentstasks/archive/{runId}.json`
```

## 完整工作流示例

```
用户："构建一个 REST API"
  → task.create({ prompt: "构建一个 REST API", taskType: "coding" })
  → status: draft
  → task.update({ status: "pending_approval" })
  → [用户确认]
  → task.update({ status: "active" })
  → [执行阶段1]
  → task.advance({ runId })
  → [执行阶段2]
  → task.advance({ runId }) → isComplete: true
  → task.update({ outcome: { summary: "API 构建完成", artifacts: ["src/api.js"] } })
  → event.report({ runId })  [参见 event-management 技能]
  → task.archive({ runId })
```
