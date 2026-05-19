# v4.4.0 工具暴露问题

**日期**：2026-05-19  
**状态**：待解决

---

## 问题描述

`agent-self-development` 插件 v4.3.0 注册了 8 个工具：

| 工具 | 功能 |
|------|------|
| `task.create` | 创建 draft task |
| `task.update` | 更新 task 状态/偏差/归因 |
| `task.advance` | 推进 task 阶段 |
| `task.get` | 获取 task 信息 |
| `task.archive` | 归档 task |
| `event.report` | 上报事件 |
| `event.query` | 查询事件 |
| `event.archive` | 归档事件 |

**问题**：这些工具在插件中已注册（`registerTools` 被调用），但在 AI Agent 对话中无法调用。

---

## 验证结果

### 1. 插件状态
```
Agent Self-Development  │ agent-self-develop │ openclaw │ enabled │ ~/.openclaw/git/git-de97ffe848595ced/repo/src/index.js │ 4.3.0
```
✅ 插件已启用

### 2. 工具注册日志
```
[agent-self-development] 8 个工具已注册
```
✅ `registerTools` 被调用

### 3. 工具暴露检查
```bash
$ openclaw tools list | grep -i "task\|event"
# 无输出
```
❌ 工具未出现在 OpenClaw 工具列表

### 4. OpenClaw 配置
```json
{
  "plugins": {
    "entries": {
      "agent-self-development": {
        "enabled": true,
        "config": {
          "archive": { "maxArchivedTasks": 50 }
        }
      }
    }
  }
}
```
⚠️ 只有 `config`，无 `tools` 或 `expose` 相关配置

---

## 可能原因

### 假设 1：工具未暴露到 AI 上下文

插件的 `registerTools` 调用后，工具可能只注册到某个特定上下文，而非全局 AI 工具池。

**检查**：查看 OpenClaw 插件 SDK 的 `registerTools` 实现

---

### 假设 2：需要特定配置才暴露

`openclaw.json` 中可能需要额外配置来暴露这些工具：

```json
{
  "plugins": {
    "entries": {
      "agent-self-development": {
        "enabled": true,
        "expose": true,           // 是否暴露工具
        "tools": ["task.*", "event.*"]  // 暴露哪些工具
      }
    }
  }
}
```

**检查**：查看插件的 `configSchema` 是否有 `expose` 或 `tools` 配置

---

### 假设 3：工具是内部使用，非 AI 对话工具

这些工具可能设计为**插件内部工具**，供其他插件/子代理调用，而非供 AI Agent 在对话中直接调用。

**检查**：
- 查看工具的 description 是否说明用途
- 查看是否有其他插件调用这些工具

---

## 期望行为

AI 在执行任务时，应该能够：

1. 用 `task.create` 创建任务
2. 用 `task.advance` 推进任务
3. 用 `event.report` 报告事件

示例流程：
```
task.create: { prompt: "Wiki 瘦身", project: "wiki维护" }
task.advance: { runId: "xxx", phase: "scanning", output: "扫描完成" }
task.archive: { runId: "xxx", result: "删除 16 个文件" }
event.report: { event: "wiki-slimming", result: "完成" }
```

---

## 需要修复的内容

| 优先级 | 内容 | 说明 |
|--------|------|------|
| P0 | 确认工具暴露机制 | 工具为什么没有出现在 AI 工具列表 |
| P1 | 修复工具暴露 | 让 AI 能够调用 task.* / event.* |
| P2 | 补充工具文档 | 说明工具用途和调用方式 |
| P3 | 编写使用示例 | task-skill-workflow 示例 |

---

## 参考

- 插件路径：`~/.openclaw/git/git-de97ffe848595ced/repo/`
- 源码入口：`src/index.js`
- 工具注册：`src/tools/index.js`
- 工具处理：`src/tools/handlers.js`
- 工具对象：`src/objects/task.js`, `src/objects/event.js`

---

## 备注

- 这是 v4.4.0 的核心问题
- 工具如果无法暴露给 AI，插件价值大打折扣
- 需要明确：这些工具是给 AI 用的，还是给其他系统用的
