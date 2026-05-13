# Planning — 文档任务：受众分析、撰写与审校

元认知子模块 - 计划阶段（文档任务专用）
Plan 不是步骤列表，而是一套完整的上下文语境
核心原则：Plugin asks, Agent decides, User confirms —— 插件不替 Agent 判断

注入上下文：本 skill 在 before_prompt_build 触发时注入。根据当前 task 是否存在，你的职责不同。

无 task：首次评估 — 评估文档任务复杂度，询问用户是否需要 Plan
task=draft：Plan 草稿已创建 — 制定完整 Plan 并汇报
task=pending_approval：等待用户确认 — 处理用户反馈（确认/修改/取消）
task=active：执行中 — 按 phases 推进文档撰写
task=revising：修订中 — 重新制定 Plan

核心对象：Plan（统一 task JSON 中的 plan 字段）

存储位置：task:{runId}.plan（统一 task JSON 内）
读取方式：插件在注入时已通过 state.getTask(runId) 获取并附加在上下文里

Plan JSON 结构：
- runId: string（本次运行唯一标识，插件注入）
- status: string（draft / pending_approval / active / completed / revising，由 Agent 决策后通知插件更新）
- plan.prompt: string（用户原始输入前500字，插件创建 task 时填充）
- plan.context.goal: string（任务目标：最终交付什么文档，解决什么问题）
- plan.context.constraints: string[]（约束条件，如格式规范、字数限制、术语表）
- plan.context.successCriteria: string[]（验收标准，如结构清晰、术语一致、示例正确）
- plan.workspace.tools: string[]（可用工具列表，如 Markdown linter、拼写检查、图表生成）
- plan.workspace.artifacts: string[]（预期产出物，如 README、API 文档、架构图、用户手册）
- plan.execution.phases: object[]（阶段列表，默认：需求理解 → 结构设计 → 内容撰写 → 示例验证 → 审校修订 → 发布交付）
- plan.execution.currentPhase: number（当前阶段索引，插件在阶段推进时维护）

Agent 职责 A：任务评估（无 task 时）
触发条件：当前 runId 尚无 task JSON

步骤：
1. 阅读用户当前 prompt，理解文档需求
2. 评估任务复杂度
   - 简单任务：修改一句话、添加一个参数说明 → 直接修改，不创建 Plan
   - 中等任务：新增一个章节、更新 API 文档 → 向用户说明复杂度，询问是否需要 Plan
   - 复杂任务：编写完整用户手册、架构文档重构 → 向用户说明复杂度，询问是否需要 Plan
3. 向用户汇报评估结果
   - 中等/复杂任务模板：
     这个文档任务涉及 [N] 个章节/模块，预计需要 [工具/操作]。
     必须制定一个执行计划，明确文档结构和审校流程。
     是否需要我制定 Plan？（回复"是"或"否"）
4. 用户确认后：如果用户确认需要 Plan → 调用 create_plan tool 创建 Plan

Agent 职责 B：制定 Plan 并汇报（task=draft）
触发条件：当前 task.status === draft

步骤：
1. 理解需求：阅读用户 prompt，识别目标读者、文档类型、核心信息
2. 读取项目上下文：读取 metadata.json 了解项目结构；读取现有文档了解风格和术语
3. 完善 task.plan.context：
   - goal：用一句话明确最终交付的文档及其用途
   - constraints：列出文档约束（格式规范、字数、语言、术语一致性要求）
   - successCriteria：定义可验证的验收标准（结构完整、示例可运行、术语统一、无死链）
4. 审视并调整 task.plan.execution.phases（文档任务默认阶段）：
   - 需求理解：明确目标读者、文档类型、核心信息、现有文档差距
   - 结构设计：确定章节大纲、信息架构、导航结构、模板选择
   - 内容撰写：按章节撰写，保持语气一致，定义术语，添加交叉引用
   - 示例验证：运行/检查所有代码示例、命令、配置，确保可复制
   - 审校修订：检查一致性、准确性、可读性、拼写/语法、格式规范
   - 发布交付：更新目录/索引、处理链接、通知用户
   - 每个阶段必须有明确的 goal（"达成XX"而非"做XX"）
   - 定义每阶段的预期 outputs（大纲文档、章节草稿、审校记录、最终文档）
5. 文件上下文提示：制定 Plan 前读取 .agent/tasks/{runId}.json，如该任务已有历史文件，在 Plan 中引用已有文件，子代理协作改为文件交接（产出文件 → 下阶段读取文件）
6. 向用户汇报（模板）：
   文档目标：[goal]
   文档约束：[constraints]
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

文档任务强制检查清单（每次回复前必须自检，严禁跳过）

任务评估阶段（无 task）：
- 用户任务是否只是修改一两句话？（是 → 直接修改）
- 任务是否涉及多章节或新文档创建？（是 → 必须询问是否需要 Plan）
- 是否已向用户说明复杂度并询问是否需要 Plan？（中等/复杂任务必做，禁止跳过）
- 用户确认后是否已调用 create_plan tool？（严禁遗漏）

Plan 制定阶段（task=draft）：
- plan.context.goal 是否用一句话明确了目标读者和文档用途？
- plan.context.constraints 是否列出了格式规范和术语要求？
- plan.context.successCriteria 是否包含示例可运行和术语一致性？
- 每个阶段的 goal 是否以"达成"开头？
- 结构设计阶段是否考虑了信息架构和导航？
- 是否已读取现有文档了解风格指南？
- 是否已向用户汇报并请求确认？

内容撰写阶段（task=active）：
- 是否使用了项目统一的术语和命名规范？
- 代码示例是否经过验证（可复制粘贴运行）？
- 是否添加了足够的上下文和解释（避免只是罗列）？
- 链接和交叉引用是否有效？
- 是否考虑了目标读者的技术水平？

状态流转：
用户提问 → 无 task → 注入 planning skill（评估阶段）
  → 简单任务 → 直接修改（结束）
  → 中等/复杂 → 询问用户 → 用户确认 → 调用 create_plan tool
    → 插件创建 task → 重新注入 planning skill（制定阶段）
    → draft（Agent 制定 Plan）
    → pending_approval（等待用户确认）
      → 用户确认 → active
      → 用户修改 → revising → 回到 pending_approval
      → 用户取消 → completed
    → active（执行中：需求理解 → 结构设计 → 内容撰写 → 示例验证 → 审校修订 → 发布交付）
      → 正常完成 → completed
      → 重大偏差 → revising → 回到 pending_approval

版本历史：
v4.2.0（2026-05-28）：新增文档任务专用模板，定制默认阶段和文档检查清单
