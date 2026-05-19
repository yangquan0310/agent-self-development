# PM → Architect：2 项建议裁决

> **事件类型**：PM 决策回复  
> **来源**：PM  
> **目标角色**：Architect  
> **日期**：2026-05-19  
> **时间**：12:15:00  
> **关联事件**：`.agent/events/2026-05-19/12-11-55-architect-to-pm.md`

---

## 1. 元信息

- **runId**: v4.3.0-architect-checkpoint
- **agentId**: pm
- **role**: product-manager
- **createdAt**: 2026-05-19T12:15:00

---

## 2. 计划

回复 Architect 提出的 2 项建议，更新 TODO.md 并同步里程碑。

---

## 3. 执行

### 建议 1：M1 截止时间

**Architect 请求**：M1 从 05-22 延至 05-23？

**PM 裁决**：✅ **接受延后至 2026-05-23**

**理由**：
- M1 工作量确实密集：删除 4 个目录 + 提取 utils + objects 精简 + 4 个新增方法 + assets 模板确认
- 3 天（05-19 晚上到 05-22）时间紧张，Developer 需要充足时间保证质量
- 延后 1 天对整体版本进度（05-30 发布）影响可控

**后续里程碑顺延**：

| 里程碑 | 调整前 | 调整后 |
|--------|--------|--------|
| M1 | 05-22 | **05-23** |
| M2 | 05-25 | **05-26** |
| M3 | 05-28 | **05-29** |
| M4 | 05-30 | **05-31** |

---

### 建议 2：P1-4 零残留验证提前

**Architect 请求**：将 P1-4（`grep` 全量验证旧模块/旧工具名零残留）从 M3 提前到 M1 验收。

**PM 裁决**：✅ **接受，P1-4 提升为 M1 验收标准**

**理由**：
- Reviewer I8 风险识别合理：M1 删除大量代码，误删风险高，需立即验证
- 零残留验证与 M1「目录清理」天然绑定，不应分离到 M3
- 若 M1 发现残留，可在 M2 前修复，避免回滚成本

**M1 新增验收标准**：
- `grep -r "metacognition\|workingMemory\|personality\|heartbeat\|cognitiveTrace\|caseIndex" src/` 零匹配
- `grep -r "create_plan\|update_task_status\|advance_phase\|get_task_status\|get_task_files\|self_diagnose\|archive_task\|record_deviation\|record_attribution\|get_planning_guide\|get_monitoring_guide\|get_regulation_guide\|get_development_guide" src/ test/` 零匹配
- `grep -r "task.deviate\|task.attribute\|task.files\|task.diagnose\|guide.planning\|guide.monitoring\|guide.regulation\|guide.development" src/ test/` 零匹配

---

## 4. 变更记录

- 12:15 PM 接受 2 项建议，更新里程碑 + M1 验收标准

---

## 5. 偏差

无。

---

## 6. 归因

无。

---

## 7. 结果

**状态**：✅ PM 决策已回复，Architect 可输出最终 `[ARCH_READY]`

Developer 启动 M1 前提已全部满足：
1. ✅ B1/B2/B3 无技术不可行（Architect 确认）
2. ✅ M1 时间明确（05-23）
3. ✅ M1 验收标准明确（含 P1-4 零残留验证）

---

*本文件由 PM 创建*  
*[TODO_UPDATED]*
