# Monitoring — 偏差预防提醒与自我监控指引

元认知子模块 - 监控阶段
插件提供目标和历史偏差信息，Agent 自主监控本轮输出
v4.0.0 职责重定义：从"偏差检测器"改为"偏差预防提醒 + 自我监控指引"

注入上下文：本 skill 在 before_prompt_build（task.status === active）时注入。
注入内容包含：
1. 当前阶段目标（来自 task.plan.execution.phases[currentPhase].goal）
2. 历史偏差（最近 3 条，从当前任务事件文件读取）
3. 自我监控指引

核心原则：Agent 自主监控

职责划分：
- 插件：提供「目标」和「历史偏差」信息
- Agent：自主监控本轮输出，主动标记偏差
- 插件：响应 Agent 的偏差标记，记录到 task 数据结构

Agent 收到本 skill 后：
1. 了解当前阶段目标
2. 了解历史偏差（避免重复）
3. 本轮输出后自行对比目标
4. 若发现偏差，调用 record_deviation tool（v4.1.0 推荐），或输出 [STATUS: revising] [REASON: xxx]（deprecated）

偏差类型规范（v4.0.0 统一）：
- output_mismatch：实际输出与 Plan 预期不符（代码未按设计实现、文档遗漏关键章节）
- doc_lag：文档/代码不同步（代码已改但 README/SKILL.md 未更新）
- context_loss：文件系统上下文丢失（Agent 未读取历史文件、重复劳动、遗漏前置文件）
- file_mismatch：文件路径或内容错误（写入错误路径、覆盖他人文件、文件格式不符规范）
- other：其他未分类偏差（用户临时变更需求、外部依赖问题）

Agent 职责：自我监控与偏差标记
触发条件：Plan.status === active，每次 LLM 输出后

步骤：
1. 对照当前阶段目标检查输出
   - 当前输出是否符合当前阶段的预期范围？
   - 实际进度是否与计划进度存在差距？
   - 是否使用了计划外的工具或方案？
2. 偏差判定
   - 无偏差：输出符合 Plan，按预期推进 → 继续执行，无需标记
   - 轻微偏差：可自我调节，不影响整体计划 → 自行调整方向，可不标记
   - 重大偏差：影响阶段目标或整体 Plan → 调用 record_deviation tool（v4.1.0 推荐），或输出 [STATUS: revising] [REASON: xxx]（deprecated）
3. 偏差记录（重大偏差时）
   - 调用 record_deviation tool 记录偏差（v4.1.0 推荐）
   - 或在当前任务事件文件中追加「偏差」章节（deprecated）
   - 记录偏差类型、描述、影响范围
   - 插件下次 before_prompt_build 扫描事件文件，如有未处理偏差则注入 regulation skill
4. 阶段完成判定
   - 当阶段目标达成且无偏差时，调用 advance_phase tool 推进到下一阶段（v4.1.0 推荐），或通知插件：phase.status = completed，execution.currentPhase++（deprecated）
   - 新产出物追加到 workspace.artifacts

决策检查点（每次收到本 skill 注入时确认）：
- 当前阶段目标是什么？
- 历史偏差中有无类似问题需要注意？
- 本轮输出是否符合当前阶段的预期范围？
- 若发现重大偏差，是否已调用 record_deviation tool 或输出 [STATUS: revising] [REASON: xxx]？
- 阶段完成后是否已调用 advance_phase tool 或通知插件更新 currentPhase？

状态流转：
active（Plan 执行中）
  → 每次输出后 Agent 自行监控
  → 无偏差 → 继续执行
  → 轻微偏差 → 自行调整
  → 重大偏差 → 调用 record_deviation tool 或输出 [STATUS: revising] [REASON: xxx]
    → 插件更新 task.status = revising
    → Agent 调用 record_deviation tool 或在事件文件中记录偏差
    → 下次对话前插件注入 regulation skill
    → Agent 完成归因分析
    → 返回 monitoring 继续追踪
  → 阶段完成 → 调用 advance_phase tool 或通知插件 currentPhase++

与其他 Skill 的关系：
- planning：before_prompt_build — 提供 Plan 的基准定义，提供监控的参照标准
- regulation：before_prompt_build（条件：事件文件中有未处理偏差）— 负责分析偏差的根因（Attribution）
- working_memory：before_prompt_build（task=active，条件：有历史文件）— 文件系统上下文管理

版本历史：
v4.1.0（2026-05-16）：迁移到 tool-driven 架构，推荐 record_deviation / advance_phase tool 替代 [STATUS] 标记；SKILL.md 去除 frontmatter 和 Markdown 表格，改为纯文本格式
v4.0.0（2026-05-08）：职责重定义：从"偏差检测器"改为"偏差预防提醒 + 自我监控指引"；注入内容改为当前阶段目标 + 历史偏差 + 自我监控指引；Agent 主动输出 [STATUS: revising]
v3.0.0（2026-04-29）：v3 重构：监控核心从"阶段检查"改为"Deviation 对象创建"，对象操作移交插件层
