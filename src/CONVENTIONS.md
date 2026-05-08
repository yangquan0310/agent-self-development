# 技术规范

> 项目根目录技术规范摘要。详细规范见 [`skills/project-conventions/SKILL.md`](../skills/project-conventions/SKILL.md)。

---

## 钩子合规红线

| 类型 | 钩子 | 能否注入 | 能否返回 Action |
|------|------|----------|-----------------|
| 决策/注入型 | `before_prompt_build` | ✅ | — |
| 决策/注入型 | `before_agent_finalize` | — | ✅ |
| 纯观察型 | `llm_output` / `agent_end` | ❌ **禁止** | ❌ **禁止** |
| 纯观察型 | `before_tool_call` / `after_tool_call` / `subagent_*` | ❌ | ❌ |

**永远不要**从 `llm_output` 或 `agent_end` 返回 `prependSystemContext` 或 `action`。

## Skill 注入映射

| Task 状态 | 注入的 skill |
|-----------|-------------|
| 无 task | `planning`（评估） |
| `draft` | `planning`（制定） |
| `pending_approval` / `revising` | `planning`（汇报/修订） |
| `active` | `monitoring` + 执行上下文 |
| `completed` | `development`（人格回顾） |

## 命名规范

| 元素 | 规则 | 示例 |
|------|------|------|
| 类名 | PascalCase，单一名词 | `Metacognition`, `WorkingMemory` |
| 方法名 | 动词前缀，camelCase | `createPlan()`, `onBeforePromptBuild()` |
| 文件名 | 小写，与类名一致 | `module.js`, `plan.js` |
| 模块入口 | 统一 `module.js` | `metacognition/module.js` |

## 模块结构模板

```javascript
export class ModuleName {
  constructor({ api, config, state, skills, logger, log, ...deps }) {
    // 依赖注入
  }
  register() {
    // 注册所有 hooks
  }
  stop() {
    // Gateway 停止时释放资源
  }
}
```

## 数据模型（v3.5.0+）

Task JSON 顶层字段（已移除 `event` 嵌套）：

```json
{
  "runId": "uuid",
  "status": "draft | pending_approval | active | revising | completed",
  "plan": { "prompt", "context", "workspace", "execution" },
  "deviations": [],
  "attributions": [],
  "outcome": {},
  "sessionIds": [],
  "tools": []
}
```

## 开发原则

- **最小修改**：只做必要变更，不重构无关代码
- **向后兼容**：适配器支持 `api === null` 时回退到文件系统
- **防御性编程**：钩子可能不存在，使用 try-catch 保护
- **日志规范**：`[Module] message` 前缀，`logger.debug/info/warn/error`
- **版本注释**：重大变更添加 `// v3.x.y: description`
