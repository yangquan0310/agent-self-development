# Hook 注入映射（v3.5.0）

## 决策/注入型钩子（可返回系统上下文）

| Hook | 条件 | 返回值 | 副作用 |
|------|------|--------|--------|
| `before_prompt_build` | 无 task | `prependSystemContext: planningSkill`（评估阶段） | 无 |
| `before_prompt_build` | 无 task + 有历史经验 | `prependSystemContext: developmentSkill`（可选追加） | 无 |
| `before_prompt_build` | task=draft | `prependSystemContext: planningSkill`（制定阶段） | 无 |
| `before_prompt_build` | task=pending_approval / revising | `prependSystemContext: planningSkill`（汇报/修订阶段） | 无 |
| `before_prompt_build` | task=active | `prependSystemContext: monitoringSkill + 执行上下文` | 无 |
| `before_agent_finalize` | 含 `[NEED_PLAN]` | `action: "revise"` + planning skill instruction | `State.saveTask()`（创建 draft） |
| `before_agent_finalize` | 含 TODO/不完整/步骤缺失 | `action: "revise"` + 对应 instruction | 无 |
| `before_agent_finalize` | 正常 | `action: "finalize"` | 无 |
| `heartbeat_prompt_contribution` | Heartbeat 回合 | `prependSystemContext: 状态统计` | `State.getActiveTasks()` |

## 观察型钩子（禁止返回系统上下文，仅做副作用）

| Hook | 副作用 |
|------|--------|
| `llm_output` | `Stream` 缓冲聚合、保存输出到日志 |
| `before_tool_call` | `State.saveSession()`、`State.saveTask()` |
| `after_tool_call` | `State.saveTask()`（记录工具结果）、`State.saveSession()` |
| `agent_end` | `State.archiveTask()`、`Event.archiveTask()`、`Stream.purge()` |
| `subagent_spawning` | 记录预期子代理任务空间 |
| `subagent_spawned` | 关联 sessionKey 到 task |
| `subagent_ended` | 更新 session 状态 |
| `gateway_stop` | `Memory.close()`（关闭数据库连接） |

## 红线

- `llm_output` 和 `agent_end` 为**纯观察型钩子**，禁止返回 `prependSystemContext` 或 `action`
- 所有 skill 注入必须通过 `before_prompt_build` 或 `before_agent_finalize`
- 修改钩子注册前，必须先阅读 `skills/project-conventions/SKILL.md`
