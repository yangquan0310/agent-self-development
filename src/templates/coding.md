# Planning — 编码任务：评估、设计与实现

元认知子模块 - 计划阶段（编码任务专用）
Plan 不是步骤列表，而是一套完整的上下文语境
核心原则：Plugin asks, Agent decides, User confirms —— 插件不替 Agent 判断

注入上下文：本 skill 在 before_prompt_build 触发时注入。根据当前 task 是否存在，你的职责不同。

无 task：首次评估 — 评估编码任务复杂度，询问用户是否需要 Plan
task=draft：Plan 草稿已创建 — 制定完整 Plan 并汇报
task=pending_approval：等待用户确认 — 处理用户反馈（确认/修改/取消）
task=active：执行中 — 按 phases 推进开发
task=revising：修订中 — 重新制定 Plan

核心对象：Plan（统一 task JSON 中的 plan 字段）

存储位置：task:{runId}.plan（统一 task JSON 内）
读取方式：插件在注入时已通过 state.getTask(runId) 获取并附加在上下文里

Plan JSON 结构：
- runId: string（本次运行唯一标识，插件注入）
- status: string（draft / pending_approval / active / completed / revising，由 Agent 决策后通知插件更新）
- plan.prompt: string（用户原始输入前500字，插件创建 task 时填充）
- plan.context.goal: string（任务目标：最终交付什么功能/模块）
- plan.context.constraints: string[]（约束条件，如语言、框架、性能、兼容性）
- plan.context.successCriteria: string[]（验收标准，如测试通过、API 兼容、代码审查通过）
- plan.workspace.tools: string[]（可用工具列表，如 linter、test runner、git）
- plan.workspace.artifacts: string[]（预期产出物，如源码文件、测试文件、API 文档）
- plan.execution.phases: object[]（阶段列表，默认：需求理解 → 技术方案 → 编码实现 → 测试验证 → 代码审查 → 交付）
- plan.execution.currentPhase: number（当前阶段索引，插件在阶段推进时维护）

Agent 职责 A：任务评估（无 task 时）
触发条件：当前 runId 尚无 task JSON

步骤：
1. 阅读用户当前 prompt，理解编码需求
2. 评估任务复杂度
   - 简单任务：单文件修改、bug 修复、变量重命名 → 直接回答用户或给出代码，不创建 Plan
   - 中等任务：新增函数/模块、接口调整、小型重构 → 向用户说明复杂度，询问是否需要 Plan
   - 复杂任务：跨模块开发、架构调整、性能优化、大型重构 → 向用户说明复杂度，询问是否需要 Plan
3. 向用户汇报评估结果
   - 中等/复杂任务模板：
     这个编码任务涉及 [N] 个模块，预计需要 [工具/操作]。
     必须制定一个执行计划，明确各阶段目标和产出。
     是否需要我制定 Plan？（回复"是"或"否"）
4. 用户确认后：如果用户确认需要 Plan → 调用 create_plan tool 创建 Plan

Agent 职责 B：制定 Plan 并汇报（task=draft）
触发条件：当前 task.status === draft

步骤：
1. 理解需求：阅读用户 prompt，识别功能需求、非功能需求（性能、安全、兼容）
2. 读取项目上下文：读取 metadata.json 了解项目结构、技术栈；读取相关源码了解现有实现
3. 完善 task.plan.context：
   - goal：用一句话明确最终交付的功能/模块
   - constraints：列出技术约束（语言版本、框架限制、依赖版本、性能指标）
   - successCriteria：定义可验证的验收标准（单元测试通过、集成测试通过、代码审查 checklist 完成）
4. 审视并调整 task.plan.execution.phases（编码任务默认阶段）：
   - 需求理解：明确功能边界、输入输出、异常场景
   - 技术方案：设计接口、数据流、模块划分、选择算法/数据结构
   - 编码实现：按模块编写代码，保持代码风格一致
   - 测试验证：单元测试、集成测试、边界条件覆盖
   - 代码审查：自审 checklist（见下文）、静态分析
   - 交付：提交代码、更新文档、通知用户
   - 每个阶段必须有明确的 goal（"达成XX"而非"做XX"）
   - 定义每阶段的预期 outputs（源码路径、测试报告、审查记录）
5. 文件上下文提示：制定 Plan 前读取 .agent/tasks/{runId}.json，如该任务已有历史文件，在 Plan 中引用已有文件，子代理协作改为文件交接（产出文件 → 下阶段读取文件）
6. 向用户汇报（模板）：
   任务目标：[goal]
   技术约束：[constraints]
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

编码任务强制检查清单（每次回复前必须自检，严禁跳过）

任务评估阶段（无 task）：
- 用户任务是否可以在 1-2 轮对话内完成？（是 → 简单任务，直接给出代码）
- 任务是否涉及多文件修改或复杂逻辑？（是 → 必须询问是否需要 Plan）
- 是否已向用户说明复杂度并询问是否需要 Plan？（中等/复杂任务必做，禁止跳过）
- 用户确认后是否已调用 create_plan tool？（严禁遗漏）

Plan 制定阶段（task=draft）：
- plan.context.goal 是否用一句话明确了最终交付的功能/模块？
- plan.context.constraints 是否列出了所有技术约束（语言版本、框架、性能）？
- plan.context.successCriteria 是否包含测试通过标准？
- 每个阶段的 goal 是否以"达成"开头？
- 技术方案阶段是否考虑了异常处理和边界条件？
- 是否已读取项目源码了解现有实现风格？
- 是否已向用户汇报并请求确认？

编码实现阶段（task=active）：
- 是否遵循现有代码风格（缩进、命名、注释规范）？
- 新增代码是否有对应的单元测试？
- 是否处理了异常路径和错误返回？
- 是否引入了不必要的依赖？
- 敏感操作（文件读写、网络请求）是否有安全检查？

状态流转：
用户提问 → 无 task → 注入 planning skill（评估阶段）
  → 简单任务 → 直接给出代码（结束）
  → 中等/复杂 → 询问用户 → 用户确认 → 调用 create_plan tool
    → 插件创建 task → 重新注入 planning skill（制定阶段）
    → draft（Agent 制定 Plan）
    → pending_approval（等待用户确认）
      → 用户确认 → active
      → 用户修改 → revising → 回到 pending_approval
      → 用户取消 → completed
    → active（执行中：需求理解 → 技术方案 → 编码实现 → 测试验证 → 代码审查 → 交付）
      → 正常完成 → completed
      → 重大偏差 → revising → 回到 pending_approval

版本历史：
v4.2.0（2026-05-28）：新增编码任务专用模板，定制默认阶段和编码检查清单
