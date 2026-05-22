# Hook 机制参考（v4.5.0）

> **版本**：v4.5.0
> **状态**：✅ 现行
> **核心变更**：v4.3.0 曾移除 Hook，v4.4.0 恢复并精细化触发时机

---

## 一、概述

agent-self-development 插件通过 Hook 机制在关键时机注入自我调节提醒，触发 Agent 执行六维度平衡性判断和技能固化流程。

---

## 二、触发时机矩阵

| # | 触发时机 | 事件 | 功能 | 注入内容 |
|---|----------|------|------|----------|
| M1 | 会话启动（仅 compaction 恢复时） | `session:start` | 注入自我调节提醒 | 六维度平衡判断流程 |
| M2 | 压缩合并完成后 | `session:compact:after` | 注入自我调节提醒 | 六维度平衡判断流程 |
| M3 | 每次 prompt 构建前 | `before_prompt_build` | 注入自我调节提醒 | 六维度平衡判断流程 |
| M4 | 任务创建后（条件触发） | `after_tool_call` | 检测 task.create | 提醒制定计划 |
| M5 | 偏差记录后（条件触发） | `after_tool_call` | 检测 task.update deviation | 提醒偏差分析 |
| M6 | 事件生成后（条件触发） | `after_tool_call` | 检测 event.report | 提醒六维度判断 |

---

## 三、注入内容：自我调节流程

Hook 注入以下提醒文本，触发 Agent 执行：

### 第一步：平衡判断

读取 event.md，执行六维度平衡性分析：

| 维度 | 对应文件 | 不平衡信号 |
|------|----------|------------|
| $D_1$ 自我认知 | SOUL.md | 发现新能力边界或盲区 |
| $D_2$ 风格 | SOUL.md | 某种风格效率低或效果好 |
| $D_3$ 信念 | SOUL.md | 结果与原有信念冲突或验证 |
| $D_4$ 身份 | IDENTITY.md | 承担超出当前身份的职责 |
| $D_5$ 程序性记忆 | MEMORY.md | 归因揭示新的因果模式 |
| $D_6$ 技能 | skills/ | 获得新技能或发现不足 |

### 第二步：决策（同化 vs 顺应）

- **同化**（技能存在但不平衡）：修改/细化现有技能
- **顺应**（技能不存在）：创建新技能条目

### 第三步：程序性记忆

借鉴 self-improving-agent 机制：

- 记录到 `.learnings/` 供后续参考
- 满足条件时触发技能固化

### 第四步：执行同化/顺应

- **同化**：找到对应技能文件，修改/细化内容
- **顺应**：在 skills/ 下创建新的 SKILL.md

---

## 四、v4.3.0 移除说明

v4.3.0 曾移除 Hook 机制，原因：

1. **复杂度**：Hook 注入使 Agent 行为难以预测
2. **控制权**：插件不应替 Agent 决定"当前需要什么 skill"
3. **架构简化**：纯 Tool 驱动足够表达全部能力

---

## 五、v4.4.0/v4.5.0 恢复原因

v4.4.0 恢复 Hook，并 v4.5.0 精细化触发时机：

1. **精准时机**：通过 `after_tool_call` 条件触发，只在关键节点提醒
2. **非侵入性**：通过 `enqueueNextTurnInjection` 下一 turn 提醒
3. **条件判断**：使用 idempotencyKey 避免重复注入

---

## 六、技术实现

### 6.1 注册位置

Hook 在插件入口 `src/index.js` 中通过 `api.on()` 注册：

```javascript
function registerSessionHooks(api, logger) {
  api.on('session:start', async (event) => {
    await api.enqueueNextTurnInjection({
      idempotencyKey: 'agent-self-development:session-start-reminder',
      prependContext: INJECT_REMINDER,
    });
  }, { priority: 50 });

  api.on('session:compact:after', async (event) => {
    await api.enqueueNextTurnInjection({
      idempotencyKey: 'agent-self-development:compaction-reminder',
      prependContext: INJECT_REMINDER,
    });
  }, { priority: 50 });

  api.on('before_prompt_build', async (event) => {
    await api.enqueueNextTurnInjection({
      idempotencyKey: 'agent-self-development:before-prompt-reminder',
      prependContext: INJECT_REMINDER,
    });
  }, { priority: 50 });
}
```

### 6.2 after_tool_call 条件触发

```javascript
api.on('after_tool_call', async (event) => {
  if (event.toolName === 'task.create') {
    await api.enqueueNextTurnInjection({
      idempotencyKey: 'reg:task-created',
      prependContext: '【任务已创建】请制定计划 → 拆解 TODO'
    });
  }
  
  if (event.toolName === 'task.update') {
    const result = JSON.parse(event.result?.content?.[0]?.text || '{}');
    if (result.deviation) {
      await api.enqueueNextTurnInjection({
        idempotencyKey: 'reg:deviation-detected',
        prependContext: '【偏差已记录】请执行偏差分析 → 归因分析'
      });
    }
  }
  
  if (event.toolName === 'event.report') {
    await api.enqueueNextTurnInjection({
      idempotencyKey: 'reg:event-generated',
      prependContext: '【事件已生成】请执行六维度平衡性判断'
    });
  }
});
```

### 6.3 Hook 文件位置

| 位置 | 说明 |
|------|------|
| `hooks/openclaw/HOOK.md` | Hook 元数据 + 文档 |
| `hooks/openclaw/handler.ts` | Handler 占位符 |
| `src/index.js` | 实际 Hook 注册逻辑 |

---

## 七、相关文档

- [`piaget-development-algorithm.md`](piaget-development-algorithm.md) — 皮亚杰发展算法（六维度形式化）
- [`theory.md`](theory.md) — 理论基础（同化/顺应/平衡）

---

*文档版本：v4.5.0*
*最后更新：2026-05-22*
*维护者：Developer*
