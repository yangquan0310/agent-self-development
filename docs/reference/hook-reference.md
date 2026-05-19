# Hook 与 Tool 混合架构参考（v4.3.0 已移除）

> **状态**：⚠️ **已废弃（v4.3.0）**
>
> 本文档描述的是 v4.1.0 ~ v4.2.x 的 Hook + Tool 混合架构。v4.3.0 已**完全移除** Hook 注入机制。
> 当前架构参考请见 [`architecture.md`](architecture.md)。

---

## 移除说明

v4.3.0（ADR-014）对架构进行了扁平化重构：

| 组件 | v4.2.x 状态 | v4.3.0 状态 |
|------|------------|------------|
| `api.on()` Hook 注册 | 7 个 Hook 注入 skill | **全部移除** |
| `before_prompt_build` | 注入 planning/monitoring skill | **无注入** |
| `before_agent_finalize` | 解析 `[STATUS]` 标记和 toolCalls | **无解析** |
| `agent_end` | 归档 task、flush hook 链 | **无触发** |
| `HookRegistry` | 调用链累积与可视化 | **已删除** |
| 钩子调用链日志 | `~/.agent/logs/agent-self-development-hooks.log` | **不再生成** |

## 为什么移除

1. **复杂度**：Hook 注入使 Agent 行为难以预测（何时注入、注入什么、注入多少）
2. **控制权**：插件不应替 Agent 决定"当前需要什么 skill"
3. **可维护性**：Hook 链调试困难，调用顺序依赖容易出错
4. **架构简化**：纯 Tool 驱动足够表达全部能力，无需双轨并行

## 迁移对照

| v4.2.x Hook 行为 | v4.3.0 替代方案 |
|-----------------|----------------|
| `before_prompt_build` 注入 planning skill | Agent 自行读取 `SKILL.md` |
| `before_prompt_build` 注入 monitoring skill | Agent 自行调用 `task.get()` 查询状态 |
| `before_agent_finalize` 解析 `[STATUS]` | Agent 直接调用 `task.update({ status })` |
| `agent_end` 归档 task | Agent 调用 `event.report()` + `task.archive()` |
| `heartbeat_prompt_contribution` 状态统计 | Agent 调用 `task.get()` 自行统计 |

## 当前架构

v4.3.0 仅保留 **Tool 暴露** 一种能力交互模式：

- 8 个命名空间工具通过 `api.registerTool()` 注册
- Agent 显式调用，插件被动响应
- 无注入、无 Hook、无隐式行为

详见 [`architecture.md`](architecture.md) 和 [`object-model.md`](object-model.md)。

---

*文档版本：v4.3.0（废弃标记）*
*最后更新：2026-05-19*
*维护者：Developer*
