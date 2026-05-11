# Working Memory — 文件系统上下文管理

工作记忆模块 - 文件系统上下文保持
上下文通过文件读取，不依赖 Session 内存复用
v4.0.0 职责重定义：从"Session 生命周期管理"改为"文件系统上下文管理"

注入上下文：本 skill 在 before_prompt_build 时条件注入。
触发条件：
- task.status === active
- 该任务已有历史文件（.agent/tasks/{runId}.json 存在且 files 非空）

核心原则：文件驱动上下文

v4.0.0 中，上下文保持从「Session 内存复用」转向「文件系统读取」：
- v3.x：上下文来源为 Session 内存，子代理关联为 Session ID，全局索引为 working_memory:active_sessions
- v4.0.0：上下文来源为文件系统（tasks/{runId}.json），子代理关联为文件路径，全局索引已移除，上下文注入时机为 before_prompt_build（条件注入文件列表）

Agent 职责：文件系统上下文管理
触发条件：收到 WM 文件上下文注入

步骤：
1. 阅读文件列表
   - 插件已提供当前任务已涉及的文件列表（从 .agent/tasks/{runId}.json 读取）
   - 根据文件列表选择性读取相关文件以保持上下文
2. 每次写入文件后更新任务索引
   - 使用 write/edit 工具修改文件后
   - 自行更新 .agent/tasks/{runId}.json，追加新文件路径：
     {
       "files": [
         {"path": "manuscripts/plan.md", "agentId": "main", "role": "primary", "type": "draft"}
       ]
     }
   - Agent 是唯一写入者，插件只读取
3. 子代理产出关联
   - 子代理产出通过文件路径关联到主任务
   - 不追踪 Session ID
   - 子代理完成后，将产出文件路径追加到 .agent/tasks/{runId}.json
4. 如需了解更多文件
   - 读取 .agent/tasks/{runId}.json 获取完整文件列表
   - 读取 .agent/tasks/INDEX.md 查看所有任务摘要

文件上下文注入的响应方式：
收到文件列表后：
1. 判断哪些文件与当前阶段相关
2. 选择性读取相关文件内容
3. 将文件内容纳入本轮决策
4. 如需写入新文件，完成后更新 tasks/{runId}.json

决策检查点（每次收到本 skill 注入时确认）：
- 当前任务已涉及的文件列表是否已阅读？
- 哪些文件与当前阶段目标相关？
- 上次写入文件后是否已更新 .agent/tasks/{runId}.json？
- 子代理产出是否已通过文件路径关联到主任务？

与其他 Skill 的关系：
- planning：before_prompt_build — 制定 Plan，在 phases 中标注前置文件
- monitoring：before_prompt_build（task=active）— 偏差预防提醒 + 自我监控指引
- working_memory：before_prompt_build（条件：有历史文件）— 文件系统上下文管理（本 skill）

版本历史：
v4.1.0（2026-05-16）：SKILL.md 去除 frontmatter 和 Markdown 表格，改为纯文本格式
v4.0.0（2026-05-08）：职责重定义：从"Session 管理"改为"文件系统上下文管理"；移除 Session 生命周期、全局索引、idle/active/paused 状态流转；新增文件上下文注入规则
v3.3.0（2026-04-29）：适配统一 task JSON：session 列表从 task.sessionIds 读取；移除 wm:{runId}:tools 和 session_list:{runId} 引用
v3.0.0（2026-04-29）：v3 重构：对象操作移交插件层，skill 变为纯 Agent 指导文档
