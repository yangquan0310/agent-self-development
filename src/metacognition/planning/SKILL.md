# Planning — 任务评估、计划制定与确认

元认知子模块 - 计划阶段
Plan 不是步骤列表，而是一套完整的上下文语境
核心原则：Plugin asks, Agent decides, User confirms —— 插件不替 Agent 判断

注入上下文：本 skill 在 before_prompt_build 触发时注入。根据当前 task 是否存在，你的职责不同。

无 task：首次评估 — 评估任务复杂度，询问用户是否需要 Plan
task=draft：Plan 草稿已创建 — 制定完整 Plan 并汇报
task=pending_approval：等待用户确认 — 处理用户反馈（确认/修改/取消）
task=active：执行中 — 接收执行上下文，按阶段推进
task=revising：修订中 — 重新制定 Plan

核心对象：Plan（统一 task JSON 中的 plan 字段）

存储位置：task:{runId}.plan（统一 task JSON 内）
读取方式：插件在注入时已通过 state.getTask(runId) 获取并附加在上下文里

Plan JSON 结构：
- runId: string（本次运行唯一标识，插件注入）
- status: string（draft / pending_approval / active / completed / revising，由 Agent 决策后通知插件更新）
- plan.prompt: string（用户原始输入前500字，插件创建 task 时填充）
- plan.context.goal: string（任务目标：最终要达成什么，Agent 制定 Plan 时填写）
- plan.context.constraints: string[]（约束条件，Agent 制定 Plan 时填写）
- plan.context.successCriteria: string[]（验收标准，Agent 制定 Plan 时填写）
- plan.workspace.tools: string[]（可用工具列表，Agent 根据任务类型选择）
- plan.workspace.artifacts: string[]（预期产出物列表）
- plan.execution.phases: object[]（阶段列表，每个阶段包含 id, name, goal, outputs, status）
- plan.execution.currentPhase: number（当前阶段索引，插件在阶段推进时维护）

Agent 职责 A：任务评估（无 task 时）
触发条件：当前 runId 尚无 task JSON

步骤：
1. 阅读用户当前 prompt，理解用户意图
2. 评估任务复杂度
   - 简单任务：单步骤、无需工具、即时可回答（查询、翻译、计算、总结、闲聊）→ 直接回答用户，不创建 Plan
   - 中等任务：2-3 个步骤、可能需工具、有明确产出（写一段代码、分析一个文件）→ 向用户说明复杂度，询问是否需要 Plan
   - 复杂任务：多步骤、需要多个工具、涉及子任务（开发功能、重构项目、写论文）→ 向用户说明复杂度，询问是否需要 Plan
3. 向用户汇报评估结果
   - 中等/复杂任务模板：
     这个任务涉及 [N] 个步骤，预计需要 [工具/操作]。
     必须制定一个执行计划，明确各阶段目标和产出。
     是否需要我制定 Plan？（回复"是"或"否"）
4. 用户确认后：如果用户确认需要 Plan → 调用 create_plan tool 创建 Plan（v4.1.0 推荐），或输出 [NEED_PLAN] 标记（deprecated）

Agent 职责 B：制定 Plan 并汇报（task=draft）
触发条件：当前 task.status === draft

步骤：
1. 理解用户意图：阅读用户当前 prompt 中的任务需求，识别核心诉求和隐含需求
2. 读取项目上下文：读取 metadata.json 了解项目结构，读取 .agent/tasks/{runId}.json 了解该任务已涉及的文件（如有）
3. 完善 task.plan.context：
   - goal：用一句话明确最终交付物
   - constraints：列出所有已知约束
   - successCriteria：定义可验证的验收标准
4. 审视并调整 task.plan.execution.phases：
   - 每个阶段必须有明确的 goal（"达成XX"而非"做XX"）
   - 定义每阶段的预期 outputs
   - 如需增删改阶段，说明理由
   - 如有前置文件，在阶段描述中标注文件路径
5. 文件上下文提示：制定 Plan 前读取 .agent/tasks/{runId}.json，如该任务已有历史文件，在 Plan 中引用已有文件，子代理协作改为文件交接（产出文件 → 下阶段读取文件）
6. 向用户汇报（模板）：
   任务目标：[goal]
   约束条件：[constraints]
   验收标准：[successCriteria]
   执行阶段：
   1. [阶段名] — [目标] [前置文件]
   2. [阶段名] — [目标] [前置文件]
   ...
   预期产出：[artifacts]
   计划已制定完毕，请确认或提出修改意见。
7. 通知插件状态变更：汇报完成后，调用 update_task_status tool 将 status 更新为 pending_approval（v4.1.0 推荐），或告知插件更新（deprecated）

Agent 职责 C：处理用户确认/修改/取消（task=pending_approval / revising）
触发条件：当前 task.status === pending_approval 或 revising

步骤：
1. 读取用户反馈内容
2. 如果用户确认（"确认"、"可以"、"开始执行"等）：
   - 调用 update_task_status tool 将 status 更新为 active（v4.1.0 推荐），或告知插件更新（deprecated）
   - 开始按 phases 执行
3. 如果用户要求修改：
   - 修改 task.plan.context / task.plan.execution.phases
   - 重新向用户汇报修改后的 Plan
   - 保持 task.status 为 pending_approval（或 revising）
4. 如果用户取消任务：
   - 调用 update_task_status tool 将 status 更新为 completed（v4.1.0 推荐），或告知插件更新（deprecated）
   - 说明取消原因

强制检查清单（每次回复前必须自检，严禁跳过）：

任务评估阶段（无 task）：
- 用户任务是否可以在 1-2 轮对话内完成？（是 → 简单任务，直接回答）
- 任务是否需要调用外部工具或读写文件？（是 → 必须询问是否需要 Plan）
- 是否已向用户说明复杂度并询问是否需要 Plan？（中等/复杂任务必做，禁止跳过）
- 用户确认后是否已调用 create_plan tool 或输出 [NEED_PLAN] 标记？（严禁遗漏）

Plan 制定阶段（task=draft）：
- plan.context.goal 是否用一句话明确了最终交付物？
- plan.context.constraints 是否列出了所有已知限制？
- plan.context.successCriteria 是否可验证？
- 每个阶段的 goal 是否以"达成"开头？
- 是否已读取 .agent/tasks/{runId}.json 了解已有文件？
- 是否已向用户汇报并请求确认？

状态流转：
用户提问 → 无 task → 注入 planning skill（评估阶段）
  → 简单任务 → 直接回答（结束）
  → 中等/复杂 → 询问用户 → 用户确认 → 调用 create_plan tool（或 [NEED_PLAN] deprecated）
    → 插件创建 task → 重新注入 planning skill（制定阶段）
    → draft（Agent 制定 Plan）
    → pending_approval（等待用户确认）
      → 用户确认 → active
      → 用户修改 → revising → 回到 pending_approval
      → 用户取消 → completed
    → active（执行中）
      → 正常完成 → completed
      → 重大偏差 → revising → 回到 pending_approval

与其他 Skill 的关系：
- planning：before_prompt_build — 评估任务 → 制定 Plan → 处理确认
- monitoring：before_prompt_build（task=active）— 偏差预防提醒 + 自我监控指引
- regulation：before_prompt_build（条件：事件文件中有未处理偏差）— 归因分析
- working_memory：before_prompt_build（task=active，条件：有历史文件）— 文件系统上下文管理
- development：before_prompt_build（task=completed）— 人格更新

版本历史：
v4.1.0（2026-05-16）：迁移到 tool-driven 架构，推荐 create_plan / update_task_status tool 替代 [NEED_PLAN]/[STATUS] 标记；SKILL.md 去除 frontmatter 和 Markdown 表格，改为纯文本格式
v4.0.0（2026-05-08）：移除 Session 分配规则；新增文件上下文提示；子代理协作改为文件交接；planning skill 与文件系统协作协议对齐
v3.4.0（2026-04-29）：合并 assessment + planning；延迟创建 task；Agent 评估 + 用户确认后才创建 task
v3.3.0（2026-04-29）：适配统一 task JSON；状态流转增加 revising
v3.0.0（2026-04-29）：v3 重构
