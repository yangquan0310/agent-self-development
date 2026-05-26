# Hook 注入机制（v4.5.0）

> **版本**：v4.5.0  
> **状态**：✅ 现行版本  
> **核心定位**：借鉴 self-improving-agent 条件触发机制，优化 Hook 注入时机，实现精准提醒。

---

## 一、版本演进

| 版本 | 架构 | 特点 |
|------|------|------|
| v4.2.x | Hook + Tool 混合 | 标准事件触发（session_start / after_compaction / before_prompt_build） |
| v4.3.0 | 纯 Tool 架构 | 移除所有 Hook，扁平化 |
| **v4.5.0** | **Hook 条件触发** | **after_tool_call 条件触发 + before_prompt_build 降频** |

### 为什么 v4.5.0 重新引入 Hook？

v4.3.0 移除 Hook 后，Agent 完全依赖显式调用。但在关键业务时机（任务创建/偏差记录/事件生成）缺乏自动提醒机制。

**v4.5.0 的新定位**：
- **条件触发**：通过 `after_tool_call` 监听关键工具返回值，条件触发提醒
- **精准时机**：只在业务关键节点触发，不打扰正常执行
- **借鉴最佳实践**：参考 self-improving-agent 的 `PostToolUse` 机制

---

## 二、注入时机矩阵

| # | 触发时机 | 监听工具 | 条件 | 注入内容 | IdempotencyKey |
|---|----------|----------|------|----------|----------------|
| M1 | 任务创建后 | `task.create` | 返回成功 | 提醒：制定计划 → 拆解 TODO | `agent-self-development:task-created` |
| M2 | 偏差记录后 | `task.update` | 检测到 deviation 字段 | 提醒：执行偏差分析 → 归因分析 | `agent-self-development:deviation-detected` |
| M3 | 事件生成后 | `event.report` | 返回成功 | 提醒：六维度平衡性判断 | `agent-self-development:event-generated` |
| M4 | 无任务执行时 | `before_prompt_build` | 检测无 active task | 提醒：创建任务 | `agent-self-development:no-active-task` |

---

## 三、技术实现

### 3.1 after_tool_call 条件触发

```javascript
// 技术实现路径
after_tool_call hook
    ↓
解析 event.toolName + event.result
    ↓
条件匹配
    ├── task.create → idempotencyKey: 'agent-self-development:task-created'
    ├── task.update (含 deviation) → idempotencyKey: 'agent-self-development:deviation-detected'
    └── event.report → idempotencyKey: 'agent-self-development:event-generated'
    ↓
enqueueNextTurnInjection(perIdempotencyKey)
```

### 3.2 条件判断逻辑

```javascript
// src/hooks/condition.js
function matchCondition(event) {
    const { toolName, result } = event;
    
    // M1: task.create 成功后
    if (toolName === 'task.create' && result.success) {
        return { trigger: 'M1', key: 'agent-self-development:task-created' };
    }
    
    // M2: task.update 含 deviation
    if (toolName === 'task.update' && result.deviation) {
        return { trigger: 'M2', key: 'agent-self-development:deviation-detected' };
    }
    
    // M3: event.report 成功后
    if (toolName === 'event.report' && result.success) {
        return { trigger: 'M3', key: 'agent-self-development:event-generated' };
    }
    
    return null;
}
```

### 3.3 before_prompt_build 降频逻辑

```javascript
// M4: 仅在无 active task 时触发
if (!hasActiveTask(session)) {
    enqueueInjection('agent-self-development:no-active-task', CREATE_TASK_REMINDER);
}
```

---

## 四、注入内容

### 4.1 自我调节 → 技能固化流程

**第一步：平衡判断**  
读取 event.md，执行六维度平衡性分析

**第二步：决策**  
- **同化**（技能存在但不平衡）：修改/细化现有技能
- **顺应**（技能不存在）：创建新技能条目

**第三步：程序性记忆**  
借鉴 self-improving-agent 机制

**第四步：执行同化/顺应**  
- **同化**：找到对应技能文件，修改/细化内容
- **顺应**：在 skills/ 下创建新的 SKILL.md

### 4.2 六维度信号检测

| 维度 | 对应文件 | 不平衡信号 |
|------|----------|------------|
| 自我认知 | SOUL.md | 发现新能力边界或盲区 |
| 风格 | SOUL.md | 某种风格效率低或效果好 |
| 信念 | SOUL.md | 结果与原有信念冲突或验证 |
| 身份 | IDENTITY.md | 承担超出当前身份的职责 |
| 程序性记忆 | MEMORY.md | 归因揭示新的因果模式 |
| 技能 | skills/ | 获得新技能或发现不足 |

---

## 五、异常处理

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 条件判断逻辑错误导致重复注入 | 🟡 中 | 使用 idempotencyKey 去重；每个场景单独测试 |
| before_prompt_build 降频逻辑影响其他插件 | 🟡 中 | 只检查 active task，不做其他逻辑；其他插件不受影响 |
| event.result 解析失败 | 🟡 中 | try-catch 包裹；解析失败时跳过，不阻塞 |

---

## 六、里程碑

| 里程碑 | 时间 | 核心交付物 | 验收标准 |
|--------|------|-----------|----------|
| **M1** | 2026-05-23 | `after_tool_call` + M1/M3 条件触发 | `task.create` 后收到提醒；`event.report` 后收到提醒 |
| **M2** | 2026-05-24 | `after_tool_call` + M2 条件触发 | `task.update` 含 deviation 后收到提醒 |
| **M3** | 2026-05-25 | `before_prompt_build` + M4 条件降频 | 无 active task 时收到提醒；有任务时不打扰 |
| **M4** | 2026-05-26 | 测试覆盖 + 文档更新 | 单元测试覆盖 4 个触发场景；更新 SKILL.md |

---

## 七、文件变更清单

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/index.js` | 修改 | 新增 `after_tool_call` hook；修改 `before_prompt_build` 条件 |
| `src/hooks/condition.js`（新增） | 新增 | 条件判断逻辑封装 |
| `test/hooks-conditional.test.js` | 新增 | 4 个触发场景的单元测试 |
| `SKILL.md` | 更新 | 新增 Hook 时机矩阵说明 |

---

## 八、历史版本参考

### v4.3.0 移除内容（仅作历史存档）

| 组件 | v4.2.x 状态 | v4.3.0 状态 |
|------|------------|------------|
| `api.on()` Hook 注册 | 7 个 Hook 注入 skill | **全部移除** |
| `before_prompt_build` | 注入 planning/monitoring skill | **无注入** |
| `before_agent_finalize` | 解析 `[STATUS]` 标记和 toolCalls | **无解析** |
| `agent_end` | 归档 task、flush hook 链 | **无触发** |
| `HookRegistry` | 调用链累积与可视化 | **已删除** |
| 钩子调用链日志 | `~/.agentslogs/agent-self-development-hooks.log` | **不再生成** |

### v4.3.0 迁移对照

| v4.2.x Hook 行为 | v4.3.0 替代方案 |
|-----------------|----------------|
| `before_prompt_build` 注入 planning skill | Agent 自行读取 `SKILL.md` |
| `before_prompt_build` 注入 monitoring skill | Agent 自行调用 `task.get()` 查询状态 |
| `before_agent_finalize` 解析 `[STATUS]` | Agent 直接调用 `task.update({ status })` |
| `agent_end` 归档 task | Agent 调用 `event.report()` + `task.archive()` |
| `heartbeat_prompt_contribution` 状态统计 | Agent 调用 `task.get()` 自行统计 |

---

*文档版本：v4.5.0*
*最后更新：2026-05-22*
*维护者：Developer*
