# Technical Documentation Index

> 面向开发者和 Agent 的技术参考文档

---

## 文档导航

| 文档 | 内容 | 阅读时机 |
|------|------|---------|
| [design-philosophy.md](design-philosophy.md) | **v4.3.0 设计哲学**：从"代劳"到"赋能"，拉取式、显式接口、被动响应、扁平架构 | 理解架构决策时 |
| [theory.md](theory.md) | **认知科学理论基础**：自传体记忆、工作自我、同化/顺应（基于博士论文）→ Agent 架构映射 | 理解框架为何这样设计时 |
| [architecture.md](architecture.md) | **v4.3.0 扁平工具架构**：Agent / Tool / 文件系统三层 + 8 个命名空间工具 | 理解模块职责划分时 |
| [project-structure.md](project-structure.md) | 被管理项目的标准目录结构（四文件契约 / .agents / archive/ / 业务目录） | 初始化新项目或查阅目录规范时 |
| [object-model.md](object-model.md) | **v4.3.0 函数模块模型**：对象层裸函数 + 工具层薄适配 + 基础设施原子 IO | 开发新模块或修改现有模块时 |
| [data-model.md](data-model.md) | Task / Deviation / Attribution / Outcome / Event JSON 结构 + 状态转换规则 + 8 个工具示例 | 操作数据对象或更新 SKILL.md 时 |
| [state-keys.md](state-keys.md) | **v4.3.0** 项目级文件系统键空间、task.json 字段规范、已移除系统级键清单 | 查阅数据存储位置时 |
| [hook-reference.md](hook-reference.md) | ⚠️ **已废弃（v4.3.0）**：v4.2.x Hook + Tool 混合架构参考，仅作历史存档 | 了解历史架构时 |

## 快速定位

**我是新开发者，第一次接触本项目**
→ 按顺序阅读：`design-philosophy.md` → `theory.md` → `architecture.md` → `object-model.md` → `data-model.md`

**我要添加一个新 tool**
→ 重点阅读：`architecture.md`（架构约束）+ `object-model.md`（函数模块模板）+ `data-model.md`（数据模型）

**我要修改数据模型**
→ 重点阅读：`data-model.md`（当前结构）+ `state-keys.md`（文件路径规范）

**我要更新 SKILL.md**
→ 重点阅读：`data-model.md`（JSON 示例 + 工具调用示例）+ `architecture.md`（工具列表）

**我要了解历史架构**
→ 阅读：`hook-reference.md`（v4.2.x 已废弃）

## 外部参考

- [项目协作协议](../../COLLABORATION.md) — 多角色协作规范、边界定义、沟通模板
- [项目规范](../../CONVENTIONS.md) — 编码规范、目录结构、命名规则
- [版本路线图](../roadmap/) — v4.0 → v4.3 架构演进

---

*文档版本：v4.3.0*
*最后更新：2026-05-19*
