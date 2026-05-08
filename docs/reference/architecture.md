# 四层架构与权力边界（v4.0.0）

```
┌─────────────────────────────────────────────┐
│             用户层（User）                   │
│  · 下达任务需求（自然语言）                   │
│  · 审核代理制定的 Plan                        │
│  · 确认/修改/取消 Plan                        │
│  · 判断任务是否完成                           │
└─────────────────────────────────────────────┘
  ↓ 自然语言指令        ↑ 自然语言汇报
  ↓ 任务需求/确认反馈   ↑ Plan 状态/执行结果
  ↓ 审核意见            ↑ 任务完成报告
┌─────────────────────────────────────────────┐
│            代理层（Agent）                   │
│  · 接收用户任务，制定 Plan                    │
│  · 向用户汇报 Plan，等待审核                  │
│  · 审核通过后，在 Session（任务族）中推进执行 │
│  · 管理多个 Session，复用上下文               │
│  · 向插件层上报：Plan 状态、Session 状态      │
└─────────────────────────────────────────────┘
  ↓ 状态上报              ↑ skill 注入
  ↓ Plan 状态             ↑ planning skill
  ↓ Session 状态          ↑ monitoring skill
  ↓ 执行结果              ↑ 执行上下文提示
┌─────────────────────────────────────────┐
│              插件层（Plugin）            │
│  · 注册 Hook 事件处理器                   │
│  · 在事件触发时调用系统底层 API           │
│  · 接收代理层状态，写入系统底层            │
│  · 注入无可争议的流程/参数 skill           │
└─────────────────────────────────────────┘
  ↓ API 调用              ↑ Hook 事件触发
  ↓ State.saveTask        ↑ before_prompt_build
  ↓ State.saveSession     ↑ before_tool_call / after_tool_call
  ↓ Memory.archiveSession ↑ agent_end
┌─────────────────────────────────────────┐
│           系统底层（文件系统）              │
│  · 提供 Hook 事件总线（Plugin api.on）    │
│  · 插件专属持久化（JSON 文件 + SQLite）   │
│  · State / Flow / Memory / Log / Hook   │
└─────────────────────────────────────────┘
```

## v4.0.0 新增：项目上下文层（Project Context Layer）

在四层架构之上，v4.0.0 引入**项目上下文层**的概念：

> 位于 OpenClaw 会话层之下的持久化协作层，通过标准化的项目目录结构和文件协议，使多个独立的 Agent 能够在同一项目中共享上下文、协作完成任务。

**双系统平行运行**：
- **Agent 自行行动系统**（文件系统）：Agent 直接写入 `tasks/{runId}.json`、事件文件、TODO.md 等所有项目文件
- **史官系统**（插件记录系统）：插件只读取项目文件，将关键状态归档到系统层 Memory/Log

**项目上下文层核心元件**（由 Agent 在目标项目中初始化创建）：

| 元件 | 位置 | 职责 |
|------|------|------|
| 四文件契约 | 项目根目录 | README.md（总览）、metadata.json（机器架构）、SKILL.md（操作手册）、TODO.md（进度看板）|
| .openclaw/ | 项目根目录隐藏目录 | events/（事件流）、locks/（并发控制）、decisions/（决策存档）、tasks/（任务索引）|
| 业务目录 | 项目根目录 | uploads/（只读输入）、manuscripts/（草稿）、docs/（定稿）、knowledge/（知识）、temp/（临时）|
| .openclawignore | 项目根目录 | 可见性控制 |

**上下文来源**：Agent 的上下文来自**文件系统**（`tasks/{runId}.json`、事件文件、TODO.md），而非系统层的 SQLite。系统层数据目前仅用于 Memory 归档和日志记录；查询/心跳统计为占位符。

---

## 权力边界

| 层级 | 权力边界 | 左侧输入 | 右侧输出 |
|------|---------|---------|---------|
| **用户层** | 任务所有者，拥有最终审核权和完成判定权 | 代理层的自然语言汇报、Plan 状态、执行结果 | 自然语言指令、确认反馈、审核意见 |
| **代理层** | 任务执行者，自行决策、制定 Plan、管理 Session | 插件层的 skill 注入、执行上下文 | Plan 状态、Session 状态、执行结果 |
| **插件层** | 工具层，只负责记录和注入无可争议的流程/参数 | 系统底层的 Hook 事件 | skill 文档、状态记录、API 调用 |
| **系统底层** | 基础设施，提供持久化、任务流、状态、记忆、日志 | 插件层的 API 调用 | Hook 事件、数据持久化 |

### 各层职责详解

**用户层（User）**
- ✅ 下达任务需求
- ✅ 审核代理制定的 Plan
- ✅ 确认/修改/取消 Plan
- ✅ 判断任务是否完成
- ❌ 不直接操作系统底层
- ❌ 不直接管理 Session

**代理层（Agent）**
- ✅ 接收用户任务，制定 Plan
- ✅ 向用户汇报 Plan，等待审核
- ✅ 审核通过后，在 Session 中推进执行
- ✅ 管理多个 Session，复用上下文
- ✅ 向插件层上报状态
- ❌ 不直接读写系统底层（通过插件层）
- ❌ 不替用户做最终决策

**插件层（Plugin）**
- ✅ 注册 Plugin 生命周期事件处理器
- ✅ 在事件触发时读写插件专属状态与记忆
- ✅ 接收代理层状态，持久化到文件系统
- ✅ 注入无可争议的流程/参数 skill
- ❌ 不做业务决策
- ❌ 不替代理制定 Plan
- ❌ 只记录和传递，不判断

**系统底层（文件系统）**
- ✅ 提供 Plugin 事件总线
- ✅ 插件专属目录结构
- ✅ JSON 文件 + SQLite 数据库 + 文本持久化
- ❌ 不做业务逻辑
- ❌ 不替代理或插件决策

---

## 数据流向

| 方向 | 左侧输入（下层→上层） | 右侧输出（上层→下层） |
|------|----------------------|----------------------|
| 用户层 ↔ 代理层 | ↑ 自然语言汇报 | ↓ 自然语言指令 |
| 代理层 ↔ 插件层 | ↑ 状态上报 | ↓ Skill 注入 |
| 插件层 ↔ 系统层 | ↑ 文件读写 | ↓ Plugin 事件触发 |

---

## 文件系统映射

| 存储类型 | 数据库路径 | 格式 | 插件层调用 | 用途 | 状态 |
|----------|-----------|------|-----------|------|------|
| **Task** | `.openclaw/tasks/runs.sqlite` | SQLite | Task | 使用已有系统数据库 | [占位符] |
| **Flow** | `.openclaw/flows/registry.sqlite` | SQLite | Flow | 使用已有系统数据库 | [占位符] |
| **State** | `.openclaw/state/agent-self-development/` | JSON | State | Plan/Session/Deviation/Attribution 状态 | 保留 |
| **Memory** | `.openclaw/memory/{agentId}.sqlite` | SQLite | Memory | 归档、事件记录 | 必需 |
| **Log** | `.openclaw/logs/{agentId}.log` | 文本 | Log | 每个代理独立日志文件 | 必需 |
| **Hook** | `.openclaw/hooks/agent-self-development/` | MD/TS | Hook | Hook 声明文件 | 保留 |

### v4.0.0 项目级文件系统映射（Agent 读写，插件读取）

这些文件位于**被插件管理的项目**中，不在插件源码内：

| 文件/目录 | 路径 | 格式 | 用途 |
|-----------|------|------|------|
| 项目级 Task 索引 | `.openclaw/tasks/{runId}.json` | JSON | 任务文件索引：文件列表、Agent 信息 |
| 项目级 Event | `.openclaw/events/{YYYY-MM-DD}/{HH-MM-SS}.md` | Markdown | 事件文件：完整任务记录 |
| 项目级 Lock | `.openclaw/locks/{file-path}.json` | JSON | 文件锁：并发控制 |
| 项目级 README | `README.md` | Markdown | 项目总览 |
| 项目级 metadata | `metadata.json` | JSON | 机器可读架构 |
| 项目级 SKILL | `SKILL.md` | Markdown | 项目级操作手册 |
| 项目级 TODO | `TODO.md` | Markdown | 进度看板 |

> **兼容性设计**：适配器构造函数接收 `(api, options)`，当 `api` 为 null 时回退到 JSON 文件。若未来 OpenClaw 暴露对应核心 API，传入真实 API 对象即可无缝切换。
