# 事件管理工作流

事件报告生成、查询和归档的详细指南。

## 生成事件报告

```
1. 确认 task.status === "completed"
   - 如未完成，event_report 将拒绝执行
2. 调用 event_report({ runId })
3. 内部流程：
   a. 读取 task.json，路径：`.agentstasks/{runId}.json`
   b. 如活跃目录未找到，回退到 `.agentstasks/archive/{runId}.json`
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
   g. 写入 `.agentsevents/{YYYY-MM-DD}/{runId}.md`
   h. 调用 task_update({ runId, eventFilePath }) 自动关联
4. 返回 { eventFilePath }
```

## 查询事件

```
event_query({ runId?, date?, type? })
```

### 按 runId 查询

```
event_query({ runId: "20260519-abc123" })
→ 返回匹配该 runId 的所有事件
```

### 按日期查询

```
event_query({ date: "2026-05-19" })
→ 返回该日期下的所有事件
```

### 按类型查询

```
event_query({ type: "deviation" })
→ 返回仅包含偏差记录的事件
```

### 组合查询

```
event_query({ runId: "20260519-abc123", type: "attribution" })
→ 返回指定任务的归因记录
```

## 归档事件

```
1. 确认事件文件存在且不再需要频繁访问
2. 调用 event_archive({ runId })
3. 系统执行：
   a. 定位 `.agentsevents/{日期}/{runId}.md`
   b. 移动到 `.agentsevents/archive/{日期}-{runId}.md`
4. 返回 { success, archivePath }
```

## 事件生成后的人格调节工作流

这是事件管理的核心闭环。事件文件生成后，Agent 必须执行**平衡性判断**：将本次任务经验与现有自我认知结构对比，决定是否以及如何进行调节。

### 六维度平衡性判断

将 event.md 中的**计划、执行、偏差、归因、结果**，与现有六个维度逐一对比：

| 维度 | 现有内容位置 | 不平衡信号 | 调节方式 |
|------|-------------|-----------|---------|
| **自我认知** | SOUL.md（核心自我） | 发现新的能力边界或盲区 | 同化：细化边界描述；顺应：扩展/修正自我定义 |
| **风格** | SOUL.md（交互/文档/代码风格） | 本次任务证明某种风格效率低或效果好 | 同化：强化高效风格；顺应：建立新场景下的风格规则 |
| **信念** | SOUL.md（工作信念、价值观） | 任务结果与原有信念冲突或验证 | 同化：补充信念的适用条件；顺应：修正信念优先级 |
| **身份** | IDENTITY.md（角色集） | 承担了超出当前身份定义的职责 | 同化：细化角色范围；顺应：新增角色定义 |
| **程序性记忆** | MEMORY.md（If-Then 规则） | 归因揭示了新的因果模式 | 同化：细化现有规则的触发条件；顺应：新增 If-Then 规则 |
| **技能** | skills/README.md | 获得新技能或发现技能不足 | 同化：提升熟练度描述；顺应：新增技能条目 |

### 调节决策流程

```
event_report({ runId }) 成功返回
  → 读取 reflectionPrompt
  → 读取 event.md（第 5 章"回顾与调节"）
  → 六维度平衡性判断：
      for each 维度 in [自我认知, 风格, 信念, 身份, 程序性记忆, 技能]:
        对比现有内容与本次任务经验
        if 不平衡:
          判断调节类型:
            - 新经验与现有结构兼容 → 同化（修改/细化原有内容）
            - 新经验与现有结构冲突 → 顺应（增加/创建新内容）
  → 执行更新（Agent 直接读写对应人格文件）
```

### 同化 vs 顺应 判定标准

| 判定 | 标准 | 操作 |
|------|------|------|
| **同化** | 新经验可被现有结构解释或容纳 | 修改、细化原有内容的细节、条件、范围 |
| **顺应** | 新经验无法被现有结构解释，必须创建新结构 | 增加全新的章节、条目、角色、规则或技能 |

**示例**：
- 同化：原有"代码审查时检查变量命名"规则 → 细化为"代码审查时检查变量命名 + 函数长度"
- 顺应：首次承担项目管理角色 → 在 IDENTITY.md 中新增"项目协调者"角色

**注意**：人格更新完全由 Agent 自主决定。插件只提供事件数据和六维度框架，不做任何自动修改。

## 完整生命周期示例

```
[任务执行完成]
  → task_update({ runId, status: "completed" })
  → task_update({ runId, outcome: { summary: "...", artifacts: [...] } })
  → event_report({ runId })
      → 生成 .agentsevents/2026-05-19/20260519-abc123.md（含"回顾与调节"章节）
      → 返回 reflectionPrompt，提示 Agent 考虑人格更新
      → 自动更新 task.json 的 eventFilePath
  → [Agent 自主回顾事件，决定更新 SOUL.md / MEMORY.md]
  → [数日后不再需要]
  → event_archive({ runId })
      → 移动到 .agentsevents/archive/2026-05-19-20260519-abc123.md
  → task_archive({ runId })
      → 移动到 .agentstasks/archive/20260519-abc123.json
```

## 文件路径

| 类型 | 活跃路径 | 归档路径 |
|------|---------|---------|
| 事件 | `.agentsevents/{YYYY-MM-DD}/{runId}.md` | `.agentsevents/archive/{日期}-{runId}.md` |
| 任务 | `.agentstasks/{runId}.json` | `.agentstasks/archive/{runId}.json` |
