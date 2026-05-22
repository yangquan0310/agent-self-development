# 项目目录结构（Project Structure）

> **版本**：v2.0.0
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
├── .agentsignore           # 可见性控制文件
│
├── skills/                # 项目级技能（协作协议、技术规范、上下文管理）
│
├── .agentss                # 元数据层（隐藏目录）
│   ├── events/            # 事件流：.agentssevents/{YYYY-MM-DD}/{runId}.md
│   │   └── archive/       # 归档事件：.agentssevents/archive/{date}-{runId}.md
│   ├── locks/             # 并发控制：.agentsslocks/{文件路径替换-为-}.json
│   ├── decisions/         # 决策存档：.agentssdecisions/{YYYYMMDD-HHMM}-标题.md
│   └── tasks/             # 任务索引：.agentsstasks/{runId}.json
│       └── archive/       # 归档任务：.agentsstasks/archive/{runId}.json
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
  ".agents": [
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
| `version` | ✅ | 当前版本 | `v4.3.0` |
| `description` | — | 项目描述 | — |
| `type` | ✅ | 项目类型，驱动 Agent 差异化处理 | `openclaw-plugin`、`nodejs-service`、`docs`、`research` |
| `directories` | ✅ | 目录结构映射，**key 用中文，value 用英文路径** | `{ "源码": "src/", "文档": "docs/" }` |
| `tags` | — | 项目标签数组，用于分类和检索 | `["openclaw", "plugin"]` |
| `agents` | — | 可协作的 Agent 列表，`handles` 描述其负责的事项 | `[{ "id": "pm", "role": "product-manager", "handles": ["架构"] }]` |
| `collaboration.mode` | — | 协作模式 | `multi-agent` / `single-agent` |
| `collaboration.protocol` | — | 项目上下文层协议版本 | `4.3.0` |
| `updated_at` | ✅ | 最后更新时间（自动维护） | `2026-05-19T10:00:00` |

**通用原则**：
- 顶层扁平化，Agent 读取后无需深度解析即可掌握全貌
- `directories` 用字典，**key 用中文，value 用英文路径**，方便 Agent 理解语义
- 无代码项目专属字段，任何类型项目都适用
- `updated_at` 由系统或 Agent 在执行变更后自动维护

---

## .agentss 元数据层

| 子目录 | 职责 | 结构 | 读写规则 |
|--------|------|------|----------|
| `tasks/` | 活跃任务文件 | `tasks/{runId}.json` | Tool handler 读写 |
| `events/` | 事件流 | `events/{YYYY-MM-DD}/{runId}.md` | Tool handler 写入（一次性生成） |
| `tasks/archive/` | 归档任务 | `tasks/archive/{runId}.json` | Tool handler 移动写入 |
| `events/archive/` | 归档事件 | `events/archive/{date}-{runId}.md` | Tool handler 移动写入 |
| `locks/` | 并发控制 | `locks/{文件路径替换-为-}.json` | Agent 创建/删除 |
| `decisions/` | 决策存档 | `decisions/{YYYYMMDD-HHMM}-标题.md` | Agent 写入 |

### tasks/ 详细设计

- **文件命名**：`tasks/{runId}.json`（与 task.runId 一一对应）
- **内容**：完整的 Task JSON（见 [第二章：数据模型](ch02-data-model.md)）
- **生命周期**：`create` → 活跃目录 → `archive` → `tasks/archive/`

### events/ 详细设计

- **目录结构**：`.agentssevents/{YYYY-MM-DD}/`
- **文件命名**：`{runId}.md`（与 task.runId 对应）
- **生成时机**：任务完成后由 `event.report` **一次性生成**
- **内容**：基于 `src/assets/event.md` 模板渲染，包含 Metadata、Plan、Execution、Deviation、Attribution、Outcome

### archive/ 详细设计（v4.3.0 新增）

- **目的**：分离活跃数据与归档数据，简化查询逻辑
- **任务归档**：`.agentsstasks/{runId}.json` → `.agentsstasks/archive/{runId}.json`
- **事件归档**：`.agentssevents/{date}/{runId}.md` → `.agentssevents/archive/{date}-{runId}.md`
- **查询回退**：`task.get` 先在活跃目录查找，找不到自动回退到归档目录

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

## .agentsignore 可见性控制

```
# 完全隐藏（Agent 不可见）
.env
.git/
node_modules/
*.log
dist/
build/
.agentsslocks/       # 锁文件对 Agent 透明
.agentsignore        # 本文件自身对 Agent 透明
.DS_Store
```

| 规则类型 | 示例 | Agent 行为 |
|----------|------|-----------|
| 完全隐藏 | `.env`, `.git/`, `node_modules/` | 对 Agent 不存在，提问时回答"无此文件" |
| 只读 | `uploads/` | 可读但不可写，写入操作被拒绝 |
| 透明 | `.agentsslocks/` | 锁文件对 Agent 透明，冲突检测由插件处理 |

---

## 初始化命令

```bash
mkdir -p .agentss{events,locks,decisions,tasks}
mkdir -p {uploads,manuscripts,docs,knowledge,skills,temp}
```

---

## 插件源码目录结构（v4.3.0）

```
src/
├── index.js                  # 插件入口：registerTools(api, context)
├── assets/                   # 模板文件
│   ├── task.json             # task 初始模板
│   └── event.md              # event Markdown 模板
├── objects/                  # 对象层（裸函数）
│   ├── task.js               # 5 个 task 函数
│   └── event.js              # 3 个 event 函数
├── tools/                    # 工具层
│   ├── index.js              # 注册 8 个 tools
│   ├── schemas.js            # 8 个 tool 的 parameters schema
│   ├── handlers.js           # handler 映射 + 薄适配
│   └── return-adapter.js     # adaptReturn / adaptError
└── utils/                    # 基础设施
    ├── io.js                 # 原子文件 IO
    ├── resolve.js            # 路径解析
    ├── validate.js           # 校验逻辑
    └── helpers.js            # 生成器工具
```

> **v4.3.0 变更**：移除了 `src/metacognition/`、`src/working-memory/`、`src/personality/`、`src/common/` 目录。所有功能收敛到 `objects/` + `tools/` + `utils/` 三层。

---

## 与系统层（插件）的文件系统映射

| 存储类型 | 路径 | 格式 | 写入者 | 读取者 |
|----------|------|------|--------|--------|
| 活跃任务 | `.agentsstasks/{runId}.json` | JSON | Tool handler | Agent + Tool |
| 归档任务 | `.agentsstasks/archive/{runId}.json` | JSON | Tool handler | Agent + Tool |
| 事件文件 | `.agentssevents/{YYYY-MM-DD}/{runId}.md` | Markdown | Tool handler | Agent + Tool |
| 归档事件 | `.agentssevents/archive/{date}-{runId}.md` | Markdown | Tool handler | Agent + Tool |
| 项目级 Lock | `.agentsslocks/{文件路径替换-为-}.json` | JSON | Agent | Agent + Tool |

> **双系统原则**：Agent 是项目文件系统的主要写入者；插件只响应 Tool 调用执行文件写入。
> **v4.3.0 变更**：插件不再通过 Hook 主动操作文件。所有文件写入均由 Agent 显式调用 Tool 触发。

---

*文档版本：v2.0.0*
*最后更新：2026-05-19*
*维护者：Developer*
