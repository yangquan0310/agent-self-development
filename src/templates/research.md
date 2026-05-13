# Planning — 调研任务：问题定义、分析与结论

元认知子模块 - 计划阶段（调研任务专用）
Plan 不是步骤列表，而是一套完整的上下文语境
核心原则：Plugin asks, Agent decides, User confirms —— 插件不替 Agent 判断

注入上下文：本 skill 在 before_prompt_build 触发时注入。根据当前 task 是否存在，你的职责不同。

无 task：首次评估 — 评估调研任务复杂度，询问用户是否需要 Plan
task=draft：Plan 草稿已创建 — 制定完整 Plan 并汇报
task=pending_approval：等待用户确认 — 处理用户反馈（确认/修改/取消）
task=active：执行中 — 按 phases 推进调研
task=revising：修订中 — 重新制定 Plan

核心对象：Plan（统一 task JSON 中的 plan 字段）

存储位置：task:{runId}.plan（统一 task JSON 内）
读取方式：插件在注入时已通过 state.getTask(runId) 获取并附加在上下文里

Plan JSON 结构：
- runId: string（本次运行唯一标识，插件注入）
- status: string（draft / pending_approval / active / completed / revising，由 Agent 决策后通知插件更新）
- plan.prompt: string（用户原始输入前500字，插件创建 task 时填充）
- plan.context.goal: string（任务目标：最终回答什么问题/验证什么假设）
- plan.context.constraints: string[]（约束条件，如时间范围、来源类型、深度要求）
- plan.context.successCriteria: string[]（验收标准，如结论可验证、来源可靠、覆盖全面）
- plan.workspace.tools: string[]（可用工具列表，如搜索引擎、文档解析、数据可视化）
- plan.workspace.artifacts: string[]（预期产出物，如调研报告、对比矩阵、数据来源列表）
- plan.execution.phases: object[]（阶段列表，默认：问题定义 → 资料搜集 → 分析评估 → 结论形成 → 报告撰写 → 审校交付）
- plan.execution.currentPhase: number（当前阶段索引，插件在阶段推进时维护）

Agent 职责 A：任务评估（无 task 时）
触发条件：当前 runId 尚无 task JSON

步骤：
1. 阅读用户当前 prompt，理解调研问题
2. 评估任务复杂度
   - 简单任务：单一事实查询、已有明确答案 → 直接回答用户，不创建 Plan
   - 中等任务：需要多来源交叉验证、技术选型对比 → 向用户说明复杂度，询问是否需要 Plan
   - 复杂任务：系统性调研、竞品分析、技术趋势研究 → 向用户说明复杂度，询问是否需要 Plan
3. 向用户汇报评估结果
   - 中等/复杂任务模板：
     这个调研任务涉及 [N] 个维度，预计需要查阅 [来源类型/数量]。
     必须制定一个执行计划，明确调研范围和深度。
     是否需要我制定 Plan？（回复"是"或"否"）
4. 用户确认后：如果用户确认需要 Plan → 调用 create_plan tool 创建 Plan

Agent 职责 B：制定 Plan 并汇报（task=draft）
触发条件：当前 task.status === draft

步骤：
1. 理解问题：阅读用户 prompt，识别核心问题、隐含假设、预期深度
2. 读取项目上下文：读取 metadata.json 了解项目背景；如有相关历史调研，引用已有结论
3. 完善 task.plan.context：
   - goal：用一句话明确最终要回答的问题或验证的假设
   - constraints：列出调研约束（时间范围、来源偏好、语言、输出格式）
   - successCriteria：定义可验证的验收标准（覆盖 N 个维度、来源可靠度、结论可追溯）
4. 审视并调整 task.plan.execution.phases（调研任务默认阶段）：
   - 问题定义：明确调研边界、核心问题、子问题分解
   - 资料搜集：检索文献/文档/代码/数据，记录来源和获取时间
   - 分析评估：对比不同来源观点，评估可靠性、适用性、时效性
   - 结论形成：综合证据形成结论，标注置信度和局限性
   - 报告撰写：结构化输出（摘要、方法、发现、结论、建议）
   - 审校交付：检查引用完整性、逻辑一致性、格式规范
   - 每个阶段必须有明确的 goal（"达成XX"而非"做XX"）
   - 定义每阶段的预期 outputs（来源列表、分析笔记、对比矩阵、报告草稿）
5. 文件上下文提示：制定 Plan 前读取 .agent/tasks/{runId}.json，如该任务已有历史文件，在 Plan 中引用已有文件，子代理协作改为文件交接（产出文件 → 下阶段读取文件）
6. 向用户汇报（模板）：
   调研目标：[goal]
   调研约束：[constraints]
   验收标准：[successCriteria]
   执行阶段：
   1. [阶段名] — [目标] [前置文件]
   2. [阶段名] — [目标] [前置文件]
   ...
   预期产出：[artifacts]
   计划已制定完毕，请确认或提出修改意见。
7. 通知插件状态变更：汇报完成后，调用 update_task_status tool 将 status 更新为 pending_approval

Agent 职责 C：处理用户确认/修改/取消（task=pending_approval / revising）
触发条件：当前 task.status === pending_approval 或 revising

步骤：
1. 读取用户反馈内容
2. 如果用户确认（"确认"、"可以"、"开始执行"等）：
   - 调用 update_task_status tool 将 status 更新为 active
   - 开始按 phases 执行
3. 如果用户要求修改：
   - 修改 task.plan.context / task.plan.execution.phases
   - 重新向用户汇报修改后的 Plan
   - 保持 task.status 为 pending_approval（或 revising）
4. 如果用户取消任务：
   - 调用 update_task_status tool 将 status 更新为 completed
   - 说明取消原因

调研任务强制检查清单（每次回复前必须自检，严禁跳过）

任务评估阶段（无 task）：
- 用户问题是否已有明确答案？（是 → 直接回答）
- 任务是否需要多来源交叉验证？（是 → 必须询问是否需要 Plan）
- 是否已向用户说明复杂度并询问是否需要 Plan？（中等/复杂任务必做，禁止跳过）
- 用户确认后是否已调用 create_plan tool？（严禁遗漏）

Plan 制定阶段（task=draft）：
- plan.context.goal 是否用一句话明确了最终要回答的问题？
- plan.context.constraints 是否列出了来源偏好和深度要求？
- plan.context.successCriteria 是否包含来源可靠性和结论可验证性？
- 每个阶段的 goal 是否以"达成"开头？
- 资料搜集阶段是否明确了来源类型和检索策略？
- 是否已读取项目背景了解已有相关调研？
- 是否已向用户汇报并请求确认？

分析评估阶段（task=active）：
- 每条关键信息是否标注了来源？
- 是否评估了来源的可靠性和时效性？
- 是否存在观点冲突？如有，是否说明了各方立场？
- 结论是否基于证据而非主观判断？
- 是否标注了结论的置信度和局限性？

状态流转：
用户提问 → 无 task → 注入 planning skill（评估阶段）
  → 简单任务 → 直接回答（结束）
  → 中等/复杂 → 询问用户 → 用户确认 → 调用 create_plan tool
    → 插件创建 task → 重新注入 planning skill（制定阶段）
    → draft（Agent 制定 Plan）
    → pending_approval（等待用户确认）
      → 用户确认 → active
      → 用户修改 → revising → 回到 pending_approval
      → 用户取消 → completed
    → active（执行中：问题定义 → 资料搜集 → 分析评估 → 结论形成 → 报告撰写 → 审校交付）
      → 正常完成 → completed
      → 重大偏差 → revising → 回到 pending_approval

版本历史：
v4.2.0（2026-05-28）：新增调研任务专用模板，定制默认阶段和调研检查清单
