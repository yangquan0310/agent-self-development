---
name: collaboration-protocol
description: >
  agent-self-development 多智能体协作协议。
  当你扮演 PM、Developer 或 Reviewer 角色，需要执行以下操作时参考本文档：
  (1) 与其他智能体协调工作，
  (2) 在输出中应用协作标记，
  (3) 解决角色冲突或范围分歧，
  (4) 判断某项变更是否需要更新文档，
  (5) 使用四段式模板格式化跨角色通讯。
---

# 多智能体协作协议

在与其他智能体协作时，应用正确的角色行为和标记。

## 角色选择

根据任务分配确定你当前的角色，然后遵循下方对应规则。

| 角色 | 权限 | 决策范围 |
|------|------|----------|
| **PM** | 架构、需求、发布 | 任务优先级、模块划分、版本规划 |
| **Developer** | 实现、工具、测试 | 代码方案、技术选型、实现细节 |
| **Reviewer** | 审批、合规、风险 | 合并审批、合规红线（最终决定权） |

---

## PM 规则

1. **任何实现开始前**，在架构设计完成后输出 `[ARCH_APPROVED]`
2. **维护任务看板**：每次阶段转换后更新 `TODO.md`
3. **为每个任务定义验收标准**，然后才交给 Developer
4. **解决冲突**：当 Developer 与 Reviewer 在可行性与质量上产生分歧时进行仲裁
5. **输出 `[PM_REVIEW]`**：完成需求分析并等待反馈时
6. **输出 `[SCOPE_CHANGE]`**：开发启动后需求发生变更时

## Developer 规则

1. **开始任何任务前先阅读 `TODO.md`** — 确认任务及其验收标准
2. **遵循 `skills/project-conventions/SKILL.md`** 中的编码标准与 Hook 合规要求
3. **完成任务后**，在最终回复末尾添加以下标记之一：
   - `[DOC_UPDATE: README]` — 若变更影响项目概览、安装说明或架构
   - `[DOC_UPDATE: SKILL]` — 若变更新增/修改了工具或工作流
   - `[DOC_UPDATE: TODO]` — 若任务看板需要同步
   - `[DOC_UPDATE: metadata]` — 若模块结构或依赖发生变更
   - `[DOC_SKIP]` — 若变更纯内部，无需更新文档
4. **输出 `[TEST_PASS]`**：所有测试通过时；或输出 `[TEST_FAIL: reason]`：测试失败时
5. **输出 `[FIXED: description]`**：处理完审查意见时
6. **输出 `[DISCUSS: reason]`**：不同意审查意见、需要升级时
7. **输出 `[TECH_BLOCKER]`**：发现架构在技术上不可行时

## Reviewer 规则

1. **对每次提交执行审查清单**：
   - 功能：变更是否完成了任务要求？
   - 合规：是否遵循 Hook 规则与编码标准？
   - 文档：`[DOC_UPDATE]` / `[DOC_SKIP]` 标记是否存在且正确？
   - 测试：测试是否通过？是否为新增行为补充了测试？
2. **在审查末尾输出裁决**：
   - `[APPROVED]` — 允许合并
   - `[CONDITIONAL_APPROVED: condition]` — 修复指定问题后允许合并
   - `[REJECTED: reason]` — 必须重新实现
3. **对发现进行分类**：
   - `[BLOCKER]` — 严重问题，必须修复
   - `[WARNING]` — 潜在问题，建议修复
   - `[SUGGESTION]` — 改进建议，可选
   - `[DOC_MISSING]` — 文档与代码不同步

## 协作标记速查表

| 标记 | 含义 | 使用者 |
|------|------|--------|
| `[PM_REVIEW]` | PM 完成需求审查，等待反馈 | PM |
| `[ARCH_APPROVED]` | 架构已确认，可以开始实现 | PM |
| `[TODO_UPDATED]` | 任务看板已更新 | PM |
| `[SCOPE_CHANGE]` | 需求变更，需要重新评估 | PM |
| `[RISK]` | 识别到风险，需要关注 | PM |
| `[TECH_BLOCKER]` | 发现技术不可行 | Developer |
| `[DOC_UPDATE: name]` | 代码变更需要同步文档 | Developer |
| `[DOC_SKIP]` | 本次变更无需更新文档 | Developer |
| `[FIXED: desc]` | 审查问题已修复 | Developer |
| `[DISCUSS: reason]` | 不同意审查意见，请求升级 | Developer |
| `[TEST_PASS]` | 全部测试通过 | Developer |
| `[TEST_FAIL: reason]` | 测试失败 | Developer |
| `[APPROVED]` | 审查通过 | Reviewer |
| `[CONDITIONAL_APPROVED: cond]` | 有条件通过 | Reviewer |
| `[REJECTED: reason]` | 审查未通过 | Reviewer |
| `[BLOCKER]` | 严重问题 | Reviewer |
| `[WARNING]` | 潜在问题 | Reviewer |
| `[SUGGESTION]` | 可选改进 | Reviewer |
| `[DOC_MISSING]` | 文档不同步 | Reviewer |

---

## 跨角色通讯协议

当一个角色需要向另一个角色正式传达状态、阻塞项或决策时，使用下方的**四段式模板**。这替代了非正式的聊天式更新，确保所有关键信息结构化且可执行。

### 何时使用

- Architect 完成设计交付物并向 PM 汇报
- Developer 完成里程碑并向 PM / Reviewer 汇报
- PM 向任何角色发布范围变更或决策
- Reviewer 发布需要跟进的发现在
- 任何角色发现需要升级的阻塞项

### 发布位置

1. **首选**：在 `.agent/sessions/{YYYY-MM-DD}/` 目录下创建文件，命名规范：
   ```
   {HH-MM-SS}-{source-role}-to-{target-role}-{topic}.md
   ```
   示例：`13-38-42-architect-to-pm-specs-ready.md`
2. **次选**：在 `TODO.md` 或聊天中引用该会话文件，通知目标角色。

### 四段式模板

每次正式跨角色通讯复制此模板：

```markdown
# {源角色} → {目标角色}：{主题}

> **事件类型**：{status-report | scope-change | blocker | decision | review}  
> **来源**：{角色}  
> **目标角色**：{角色}  
> **日期**：{YYYY-MM-DD}  
> **关联文档**：`path/to/doc.md`

---

## 1. 问题（Issues）

当前已识别的问题列表。每条问题需说明严重度和当前状态。

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | {一句话描述} | 🔴 阻塞 / 🟡 中 / 🟢 低 | {角色} | ✅ 已解决 / 🚧 进行中 / ⏳ 待处理 |

---

## 2. 已解决（Resolved）

本周期内已关闭的问题及其解决方案。

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | {引用问题 ID 或简述} | {具体做法} | {角色} | {YYYY-MM-DD} |

---

## 3. 待解决（Pending）

需要目标角色关注或决策的开放事项。

| ID | 问题 | 阻塞原因 | 负责人 | 截止日期 |
|----|------|---------|--------|----------|
| P1 | {简述} | {为什么还没做} | {角色} | {YYYY-MM-DD} |

---

## 4. 建议（Suggestions）

非阻塞性的改进建议，供目标角色参考。

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | {具体建议} | {角色} | 🔴 高 / 🟡 中 / 🟢 低 | 待确认 / 已采纳 / 已否决 |

---

*事件创建：{角色}*  
*日期：{YYYY-MM-DD}*  
*`{[MARKER]}`*
```

### 严重度图例

| 图标 | 含义 | 响应时限 |
|------|------|----------|
| 🔴 | 阻塞 — 当前工作无法继续 | 立即响应 |
| 🟡 | 中 — 影响进度或质量，但有绕行方案 | 24 小时内 |
| 🟢 | 低 — 建议或优化，不阻塞任何工作 | 下次同步时 |

### 状态图例

| 图标 | 含义 |
|------|------|
| ✅ | 已解决 / 已完成 / 已采纳 |
| 🚧 | 进行中 |
| ⏳ | 待处理 / 待确认 |
| ❌ | 已否决 / 已关闭但不解决 |

---

## 冲突解决

出现分歧时，按以下规则仲裁：

| 冲突场景 | 仲裁者 | 规则 |
|----------|--------|------|
| Developer 质疑架构 | PM | 技术可行性 vs. 需求完整性 |
| Developer 质疑审查 | PM | 代码质量 vs. 实现效率 |
| PM 与 Reviewer 在合规上分歧 | Reviewer | 合规红线不可谈判 |
| 多个智能体编辑同一文件 | PM | 规划隔离区避免此情况；若发生，后写者胜，手动合并 |
| 文档与代码不同步 | Reviewer | 代码是真理来源；文档必须跟上 |

## 文档所有权

| 文档 | 创建者 | 维护者 | 审查者 |
|------|--------|--------|--------|
| `README.md` | PM | PM + Developer | Reviewer |
| `metadata.json` | PM | Developer | Reviewer |
| `skills/project-context/SKILL.md` | PM | Developer | Reviewer |
| `TODO.md` | PM | 所有角色 | — |
| 路线图 (`docs/roadmap/`) | PM | PM | — |
| `skills/project-conventions/SKILL.md` | PM + Developer | Developer | Reviewer |

## 外部参考

- `../../docs/COLLABORATION.md` — 根级协作协议摘要
- `../../docs/reference/architecture.md` — 四层架构与权限边界
- `../../skills/project-context/SKILL.md` — 项目上下文与任务看板管理
