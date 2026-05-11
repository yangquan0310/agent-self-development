# 项目目录结构（Project Structure）

> **版本**：v1.0.0
> **用途**：被 `agent-self-development` 插件管理的项目，初始化后应具备的标准目录结构
> **更新频率**：仅当项目上下文层协议变更时同步更新

---

## 初始化后完整结构

```
项目根目录/
├── README.md              # 项目总览（人类视角）
├── metadata.json          # 机器可读架构
├── SKILL.md               # 项目级操作手册
├── TODO.md                # 进度看板
├── .agentignore           # 可见性控制文件
│
├── skills/                # 项目级技能（协作协议、技术规范、上下文管理）
│
├── .agent/                # 元数据层（隐藏目录）
│   ├── events/            # 事件流：.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md
│   ├── locks/             # 并发控制：.agent/locks/{文件路径替换-为-}.json
│   ├── decisions/         # 决策存档：.agent/decisions/{YYYYMMDD-HHMM}-标题.md
│   └── tasks/             # 任务索引：.agent/tasks/{runId}.json + INDEX.md
│
├── uploads/               # 用户上传的原始材料（Agent 只读）
├── manuscripts/           # Agent 工作草稿（进行中、未确认）
├── docs/                  # 定稿（需用户 [APPROVED] 后方可写入）
├── knowledge/             # 项目积累的知识（笔记和综述）
└── temp/                  # 临时文件和归档草稿
```

---

## 四文件契约（根目录）

| 文件 | 职责 | 维护者 | 必填 |
|------|------|--------|------|
| `README.md` | 项目定位、目录结构说明、关键文件索引、快速开始指南 | Agent / 用户 | ✅ |
| `metadata.json` | **机器可读架构**：模块列表、技能列表、Agent 能力定义、协作模式配置 | Agent | ✅ |
| `SKILL.md` | 项目特有工作流程、工具使用规范、输出格式要求 | Agent | ✅ |
| `TODO.md` | 当前任务状态、进行中任务、待确认任务、已完成任务 | Agent / 用户 | ✅ |

**设计原则**：
- `README.md` 是「人类视角」的总览，`metadata.json` 是「机器视角」的结构，两者互补
- `SKILL.md` 是「过程规范」，`TODO.md` 是「状态跟踪」，两者共同支撑协作执行
- 四文件必须位于项目根目录，Agent 进入项目时优先读取

### metadata.json Schema（通用设计）

```json
{
  "project_id": "string",
  "title": "string",
  "created_date": "string",
  "status": "active | completed | archived",
  "version": "string",
  "description": "string",
  "type": "string",
  "directories": {
    "中文目录名": "english_path/"
  },
  "tags": ["string"],
  "agents": [
    { "id": "string", "role": "string", "handles": ["string"] }
  ],
  "collaboration": {
    "mode": "multi-agent | single-agent",
    "protocol": "string"
  },
  "updated_at": "string"
}
```

| 字段 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| `project_id` | ✅ | 项目唯一标识（通常 = 文件夹名） | `agent-self-development` |
| `title` | ✅ | 项目标题 | `Agent Self-Development` |
| `created_date` | ✅ | 创建日期，ISO 8601 | `2026-05-08` |
| `status` | ✅ | 项目状态 | `active` / `completed` / `archived` |
| `version` | ✅ | 当前版本 | `v4.0.0` |
| `description` | — | 项目描述 | — |
| `type` | ✅ | 项目类型，驱动 Agent 差异化处理 | `openclaw-plugin`、`nodejs-service`、`docs`、`research` |
| `directories` | ✅ | 目录结构映射，**key 用中文，value 用英文路径** | `{ "源码": "src/", "文档": "docs/" }` |
| `tags` | — | 项目标签数组，用于分类和检索 | `["openclaw", "plugin"]` |
| `agents` | — | 可协作的 Agent 列表，`handles` 描述其负责的事项 | `[{ "id": "pm", "role": "product-manager", "handles": ["架构"] }]` |
| `collaboration.mode` | — | 协作模式 | `multi-agent` / `single-agent` |
| `collaboration.protocol` | — | 项目上下文层协议版本 | `4.0.0` |
| `updated_at` | ✅ | 最后更新时间（自动维护） | `2026-05-09T13:00:00` |

**通用原则**：
- 顶层扁平化，Agent 读取后无需深度解析即可掌握全貌
- `directories` 用字典，**key 用中文，value 用英文路径**，方便 Agent 理解语义
- 无代码项目专属字段，任何类型项目都适用
- `updated_at` 由系统或 Agent 在执行变更后自动维护

---

## .agent/ 元数据层

| 子目录 | 职责 | 结构 | 读写规则 |
|--------|------|------|----------|
| `events/` | 事件流 | 按天分文件夹：`events/{YYYY-MM-DD}/{HH-MM-SS}.md` | Agent 只写入 |
| `locks/` | 并发控制 | 单文件：`locks/{文件路径替换-为-}.json` | Agent 创建/删除 |
| `decisions/` | 决策存档 | 单文件：`decisions/{YYYYMMDD-HHMM}-标题.md` | Agent 写入 |
| `tasks/` | 任务文件索引 | JSON：`tasks/{runId}.json` + 索引：`tasks/INDEX.md` | Agent 读写 |

### events/ 详细设计

- **目录结构**：`.agent/events/{YYYY-MM-DD}/`
- **文件命名**：`{HH-MM-SS}.md`（精确到秒，单文件记录完整事件）
- **文件内容**（7 个必选部分）：
  1. **元信息（Metadata）**：runId、agentId、role、createdAt
  2. **计划（Plan）**：执行计划、验收标准、预估时间
  3. **执行（Execution）**：实际完成的工作、产出文件
  4. **变更记录（ChangeLog）**：`- {HH:MM} {agent-id} {write|edit} {filePath} — {摘要}`
  5. **偏差（Deviation）**：发现的偏差（类型、描述、影响范围）
  6. **归因（Attribution）**：根本原因、影响评估、策略更新
  7. **结果（Outcome）**：最终状态（完成/修正/放弃）

### tasks/ 详细设计

- **文件命名**：`tasks/{runId}.json`（与 task.runId 一一对应）
- **内容**：
  ```json
  {
    "runId": "uuid",
    "status": "active",
    "agentId": "main",
    "role": "primary",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "files": [
      {"path": "manuscripts/plan.md", "agentId": "main", "role": "primary", "type": "draft"}
    ]
  }
  ```
- **索引文件**：`tasks/INDEX.md` 按日期分组列出所有任务摘要

---

## 业务目录层

| 目录 | 职责 | 访问规则 |
|------|------|----------|
| `uploads/` | 用户上传的原始材料 | Agent 只读，不可写入 |
| `manuscripts/` | Agent 工作草稿（进行中、未确认） | Agent 读写 |
| `docs/` | 定稿（用户已确认的成果） | Agent 可读写（写入前需获得用户 [APPROVED]） |
| `knowledge/` | 项目积累的知识（笔记和综述） | Agent 读写 |
| `skills/` | 项目级技能（协作协议、技术规范、上下文管理） | Agent 读写 |
| `temp/` | 临时文件和归档草稿 | Agent 读写 |

**设计原则**：
- `uploads/` 是「输入层」，用户提供的原始材料
- `manuscripts/` 是「工作层」，Agent 的草稿和中间产出
- `docs/` 是「输出层」，经用户确认的最终成果
- 文件从 `manuscripts/` 到 `docs/` 必须经过用户确认（`[APPROVED]`）

---

## .agentignore 可见性控制

```
# 完全隐藏（Agent 不可见）
.env
.git/
node_modules/
*.log
dist/
build/
.agent/locks/       # 锁文件对 Agent 透明
.agentignore        # 本文件自身对 Agent 透明
.DS_Store
```

| 规则类型 | 示例 | Agent 行为 |
|----------|------|-----------|
| 完全隐藏 | `.env`, `.git/`, `node_modules/` | 对 Agent 不存在，提问时回答"无此文件" |
| 只读 | `uploads/` | 可读但不可写，写入操作被拒绝 |
| 透明 | `.agent/locks/` | 锁文件对 Agent 透明，冲突检测由插件处理 |

---

## 初始化命令

```bash
mkdir -p .agent/{events,locks,decisions,tasks}
mkdir -p {uploads,manuscripts,docs,knowledge,skills,temp}
```

---

## 与系统层（插件）的文件系统映射

| 存储类型 | 路径 | 格式 | 写入者 | 读取者 |
|----------|------|------|--------|--------|
| 项目级 Task 索引 | `.agent/tasks/{runId}.json` | JSON | Agent + 插件（Tool 被动响应） | Agent + 插件 |
| 项目级 Event | `.agent/events/{YYYY-MM-DD}/{HH-MM-SS}.md` | Markdown | Agent + 插件（Tool 被动响应） | Agent + 插件 |
| 项目级 Lock | `.agent/locks/{file-path}.json` | JSON | Agent | Agent + 插件 |
| 系统级 State | `~/.agent/state/agent-self-development/` | JSON | 插件 | 插件 |
| 系统级 Memory | `~/.agent/memory/{agentId}.sqlite` | SQLite | 插件 | 插件 |
| 系统级 Log | `~/.agent/logs/{agentId}.log` | 文本 | 插件 | 插件 |
| 系统级 Hook 链日志 | `~/.agent/logs/agent-self-development-hooks.log` | 文本 | 插件 | 插件 |

> **双系统原则**：Agent 是项目文件系统的唯一写入者；插件只读取项目文件，将关键状态归档到系统层。
> **v4.1.0 变更**：操作型 Tool（如 `create_plan`、`record_deviation`）在 Agent 调用时执行文件写入，插件不再主动代劳。

---

*文档版本：v1.0.0*
*最后更新：2026-05-09*
*维护者：PM*
