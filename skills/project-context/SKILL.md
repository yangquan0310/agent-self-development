---
name: project-context
description: >
  Agent 读取项目上下文的标准流程。
  使用场景：(1) 首次加入项目，(2) 开始新任务，(3) 更新项目文档，(4) 多 Agent 协作时同步状态。
version: 4.0.0
---

# Project Context — 项目上下文读取技能

> **版本**：v4.0.0
> **核心原则**：Agent 按标准流程读取项目文件获取上下文，不依赖 Session 内存复用

---

## 标准读取流程

Agent 进入项目后，按以下顺序读取上下文：

```
1. 读取 metadata.json → 理解项目结构、模块列表、Agent 能力定义
2. 读取 TODO.md → 理解当前任务状态和优先级
3. 读取 .agent/tasks/{runId}.json → 了解该任务已涉及的文件及负责 Agent
4. 读取 .agent/events/{今天}/ 下最近的事件文件 → 了解最近动态
5. 执行任务 → 产出到 manuscripts/
6. 完成 → 更新 TODO.md → 请求用户确认
```

---

## 首次加入项目

1. **读取 `README.md`** — 项目定位、目录结构、快速开始指南
2. **读取 `metadata.json`** — 模块列表、技能列表、Agent 能力定义、协作模式配置
3. **读取 `SKILL.md`（项目级）** — 项目特有工作流程、工具使用规范、输出格式要求
4. **读取 `TODO.md`** — 当前任务状态、进行中任务、待确认任务
5. **读取 `.agentignore`** — 了解文件可见性边界

---

## 开始新任务

1. **读取 `TODO.md`** — 识别最高优先级的开放任务
2. **读取 `.agent/tasks/{runId}.json`** — 了解该任务已涉及的文件
3. **读取 `.agent/events/{今天}/`** — 了解最近动态
4. **认领任务** — 在 `TODO.md` 中标记 `@agent-id` 和状态
5. **创建事件文件** — `.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md`
6. **执行任务** — 遵循项目级 SKILL.md 中的规范

---

## 多 Agent 协作时

### Agent 举手请求协助

1. Agent A 继续执行自己擅长的部分（不阻塞）
2. Agent A 在 `TODO.md`「待分配（用户协调）」写入子任务：
   ```markdown
   ## 待分配（用户协调）
   - [ ] 子任务：{描述} — 需要擅长{能力}的 Agent — 举手者：@{agent-id}
   ```
3. Agent A 向用户汇报：
   > "我擅长{我的能力}，但发现需要{其他能力}。建议分配此子任务给擅长{其他能力}的 Agent。我继续处理{我的部分}。"
4. 用户收到后，将子任务分配给 Agent B

### 文件协作规则

- 多个 Agent 通过读写共享文件协作，不通过 `sessions_send`
- Agent A 将中间成果写入 `manuscripts/` 或 `knowledge/notes/`
- Agent B 读取同一文件，继续工作
- 若编辑同一文件，通过 `.agent/locks/` 检测冲突

---

## 更新项目文档

完成任务后，判断是否需要更新文档：

| 变更类型 | 操作 |
|-------------|--------|
| 新增模块或目录 | 更新 `README.md` 结构 + `metadata.json` modules 列表 |
| 新增工具或脚本 | 更新项目级 `SKILL.md` 工具使用规范 |
| API 或接口变更 | 更新 `docs/reference/` 相关文档 |
| 代码规范变更 | 更新 `docs/CONVENTIONS.md` |
| 任务完成 | 更新 `TODO.md` 状态 |
| 纯局部修改 | 标记 `[DOC_SKIP]` |

---

## 快速参考

- **技术栈**：Node.js 18+, OpenClaw Extension API
- **测试命令**：`npm test`
- **项目规范**：`docs/CONVENTIONS.md`
- **协作协议**：`docs/COLLABORATION.md`
- **版本**：v4.0.0

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v4.0.0 | 2026-05-08 | 与项目上下文层对齐；新增标准读取流程、多 Agent 协作规则、事件文件创建步骤 |
