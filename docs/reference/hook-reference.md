# Hook 注入映射（v4.0.0）

## 决策/注入型钩子（可返回系统上下文或 action）

| Hook | 条件 | 返回值 | 副作用 |
|------|------|--------|--------|
| `before_prompt_build` | 无 task | `prependSystemContext: planningSkill`（评估阶段） | 无 |
| `before_prompt_build` | task=draft | `prependSystemContext: planningSkill + 文件上下文提示`（制定阶段） | 无 |
| `before_prompt_build` | task=pending_approval / revising | `prependSystemContext: planningSkill + 文件上下文提示`（汇报/修订阶段） | 无 |
| `before_prompt_build` | task=active | `prependSystemContext: monitoringSkill + regulationSkill(条件) + 执行上下文 + 文件上下文提示` | 无 |
| `before_prompt_build` | task=active + 有历史文件 | `prependSystemContext: workingMemorySkill + 文件列表`（条件注入） | 无 |
| `before_prompt_build` | task=completed | `prependSystemContext: developmentSkill + Event摘要` | 无 |
| `before_agent_finalize` | 含 `[NEED_PLAN]` | `action: "revise"` + planning skill instruction | `State.saveTask()`（创建 draft） |
| `before_agent_finalize` | 含 `[STATUS: xxx]` | 无 | `State.saveTask()`（更新 task.status） |
| `before_agent_finalize` | 含 TODO/不完整/步骤缺失 | `action: "revise"` + 对应 instruction | 无 |
| `before_agent_finalize` | 正常 | `action: "finalize"` | 无 |
| `heartbeat_prompt_contribution` | Heartbeat 回合 | `prependContext: 状态统计` | `[占位符]` |

## 观察型钩子（禁止返回系统上下文，仅做副作用）

| Hook | 副作用 |
|------|--------|
| `llm_output` | `Stream` 缓冲聚合、保存输出到 task.plan.output |
| `before_tool_call` | `State.saveSession()`、`State.saveTask()`（子代理追踪） |
| `after_tool_call` | `State.saveTask()`（记录工具结果）、文件变更审计追踪（读取事件文件 → 系统层日志） |
| `agent_end` | `State.archiveTask()`、`Event.archiveTask()`（读取项目级事件文件 → 系统层 Memory）、`Stream.purge()` |
| `subagent_spawning` | 记录预期子代理任务空间 |
| `subagent_spawned` | 关联 sessionKey 到 task |
| `subagent_ended` | 更新 session 状态 |
| `gateway_stop` | `Memory.close()`（关闭数据库连接） |

## Skill 注入映射表（v4.0.0）

| task.status | 注入 Skill | 注入内容 | 目的 |
|-------------|-----------|----------|------|
| 无 task | `planning`（评估） | 任务评估流程、复杂度判断标准 | 让 Agent 决定是否需要制定 Plan |
| `draft` | `planning`（制定） + 文件上下文提示 | Plan 模板、阶段划分规则、历史文件列表 | 让 Agent 制定完整 Plan |
| `pending_approval` | `planning`（反馈） + 文件上下文提示 | 用户反馈处理指南、状态转换规则 | 让 Agent 处理确认/修改/取消 |
| `active` | `monitoring` + 执行上下文 + WM文件上下文(条件) + regulation(条件) + 文件上下文提示 | 当前阶段目标、历史偏差、文件列表、未处理偏差 | 让 Agent 自主执行并监控偏差 |
| `revising` | `planning`（修订） + regulation(条件) + 文件上下文提示 | 修订原因、当前 Plan 快照、未处理偏差 | 让 Agent 重新制定 Plan |
| `completed` | 无（agent_end 纯观察） | — | 插件自动归档，不注入 |

## 红线

- `llm_output` 和 `agent_end` 为**纯观察型钩子**，禁止返回 `prependSystemContext` 或 `action`
- 所有 skill 注入必须通过 `before_prompt_build` 或 `before_agent_finalize`
- 能注入的只有 `before_prompt_build`（给上下文）和 `before_agent_finalize`（给 action）
- 修改钩子注册前，必须先阅读 `docs/CONVENTIONS.md`
