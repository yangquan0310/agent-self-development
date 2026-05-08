# 多 Agent 协作协议

> 项目根目录协作协议摘要。详细协议见 [`skills/collaboration-protocol/SKILL.md`](../skills/collaboration-protocol/SKILL.md)。

---

## 角色与权限

| 角色 | 职责 | 决策权限 |
|------|------|----------|
| **PM** | 需求分析、架构设计、进度把控 | 需求优先级、模块划分、版本发布 |
| **Developer** | 代码实现、测试、技术决策 | 实现方式、技术选型 |
| **Reviewer** | 代码审查、合规检查、风险识别 | 合并批准、合规红线判定（最终权） |

## 核心标记

| 标记 | 含义 | 使用者 |
|------|------|--------|
| `[ARCH_APPROVED]` | 架构确认，可进入实现 | PM |
| `[DOC_UPDATE: name]` | 代码变更需要同步文档 | Developer |
| `[DOC_SKIP]` | 本轮无需更新文档 | Developer |
| `[APPROVED]` | 审查通过 | Reviewer |
| `[REJECTED: reason]` | 审查未通过 | Reviewer |

完整标记列表（18 个）见 [`skills/collaboration-protocol/SKILL.md`](../skills/collaboration-protocol/SKILL.md)。

## 冲突解决

| 冲突场景 | 仲裁者 | 规则 |
|----------|--------|------|
| Developer 质疑架构 | PM | 技术可行性 vs. 需求完整性 |
| PM 与 Reviewer 合规分歧 | Reviewer | 合规红线不可协商 |
| 多 Agent 修改同一文件 | PM | 按 Plan 隔离区域划分 |
| 文档与代码不同步 | Reviewer | 以代码为准，文档必须追平 |

## 文档责任矩阵

| 文档 | 创建者 | 维护者 | 审查者 |
|------|--------|--------|--------|
| `README.md` | PM | PM + Developer | Reviewer |
| `metadata.json` | PM | Developer | Reviewer |
| `src/CONVENTIONS.md` | PM + Developer | Developer | Reviewer |
| `docs/COLLABORATION.md` | PM | PM | Reviewer |
| `skills/*` | PM | Developer | Reviewer |
| `docs/roadmap/*` | PM | PM | — |
