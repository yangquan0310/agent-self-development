# Event: {{runId}}

> 本文件由 event.report 在任务完成后从 task.json 生成。

---

## 1. 元信息

- **runId**: {{runId}}
- **createdAt**: {{createdAt}}
- **updatedAt**: {{updatedAt}}
- **taskType**: {{taskType}}
- **status**: {{status}}

---

## 2. 计划

### Prompt

{{prompt}}

### Context

- Goal: {{goal}}
- Constraints: {{constraints}}
- Success Criteria: {{successCriteria}}

### Execution

{{phases}}

---

## 3. 变更记录

{{changeLog}}

---

## 4. 结果

{{outcome}}

## 5. 回顾与调节

> **触发**：事件文件生成后，Agent 必须执行六维度平衡性判断，将本次任务经验与现有自我认知结构对比，决定是否调节及如何调节。

### 5.1 偏差回顾

{{deviations}}

### 5.2 归因回顾

{{attributions}}

### 5.3 六维度平衡性判断

将本次经验与现有结构逐一对比：

| 维度 | 现有内容 | 不平衡信号 | 调节方式 |
|------|---------|-----------|---------|
| **自我认知** | SOUL.md（核心自我） | 发现新的能力边界或盲区 | 同化：细化边界；顺应：扩展自我定义 |
| **风格** | SOUL.md（风格） | 某种风格效率低或效果好 | 同化：强化高效风格；顺应：建立新场景风格 |
| **信念** | SOUL.md（信念） | 结果与原有信念冲突或验证 | 同化：补充适用条件；顺应：修正优先级 |
| **身份** | IDENTITY.md（角色） | 承担超出当前身份的职责 | 同化：细化角色范围；顺应：新增角色 |
| **程序性记忆** | MEMORY.md（If-Then） | 归因揭示新的因果模式 | 同化：细化触发条件；顺应：新增规则 |
| **技能** | skills/README.md | 获得新技能或发现不足 | 同化：提升熟练度；顺应：新增技能条目 |

### 5.4 同化 vs 顺应 判定

- **同化**：新经验可被现有结构解释 → **修改/细化**原有内容
- **顺应**：新经验无法被现有结构解释 → **增加/创建**新内容

### 5.5 下一步行动

- 查询完整事件：`event.query({ runId: "{{runId}}" })`
- 执行六维度平衡性判断
- 自主决定同化/顺应，直接更新对应人格文件

---

*本文件由 Agent Self-Development 插件自动生成*
