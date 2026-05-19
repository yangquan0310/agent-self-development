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

> **触发**：事件文件生成后，Agent 应回顾本次任务的偏差与归因，决定是否执行同化或顺应。

### 5.1 偏差回顾

{{deviations}}

### 5.2 归因回顾

{{attributions}}

### 5.3 调节建议

基于上述偏差与归因，建议 Agent 思考以下问题：

1. **同化**：本次成功经验是否与现有自我认知一致？是否需要在 MEMORY.md 中强化相关 If-Then 规则？
2. **顺应**：是否遭遇能力盲区或价值观冲突？是否需要更新 SOUL.md 或 IDENTITY.md？
3. **技能更新**：是否获得新技能或发现技能短板？是否需要在 skills/README.md 中记录？

下一步行动：
- 查询完整事件：`event.query({ runId: "{{runId}}" })`
- 自主决定是否及如何更新人格文件

---

*本文件由 Agent Self-Development 插件自动生成*
