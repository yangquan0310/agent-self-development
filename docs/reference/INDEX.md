# Technical Documentation Index

> 面向开发者和 Agent 的技术参考文档

---

## 文档导航

| 文档 | 内容 | 阅读时机 |
|------|------|---------|
| [theory.md](theory.md) | 认知科学理论基础（Baddeley / Bandura / Piaget）→ Agent 架构映射 | 理解框架设计哲学时 |
| [architecture.md](architecture.md) | 四层架构（用户/Agent/插件/系统）与权力边界 | 理解模块职责划分时 |
| [project-structure.md](project-structure.md) | 被管理项目的标准目录结构（四文件契约 / .agent/ / 业务目录） | 初始化新项目或查阅目录规范时 |
| [object-model.md](object-model.md) | 适配器层、管理器层、模块层类设计 + 源码结构 | 开发新模块或修改现有模块时 |
| [data-model.md](data-model.md) | Plan / Deviation / Attribution / Session / Event JSON 结构 + 状态转换规则 | 操作数据对象或更新 SKILL.md 时 |
| [hook-reference.md](hook-reference.md) | 所有钩子的注入映射表、返回值规范、副作用清单 | 注册新钩子或修改 hook 逻辑时 |
| [state-keys.md](state-keys.md) | `ctx.state` 键空间完整列表、命名规则、生命周期 | 使用 state API 或调试数据流时 |

## 快速定位

**我是新开发者，第一次接触本项目**
→ 按顺序阅读：`theory.md` → `architecture.md` → `object-model.md` → `data-model.md`

**我要添加一个新模块**
→ 重点阅读：`architecture.md`（权力边界）+ `object-model.md`（模块结构模板）+ `hook-reference.md`（钩子注册规范）

**我要修改数据模型**
→ 重点阅读：`data-model.md`（当前结构）+ `state-keys.md`（键命名规则）

**我要更新 SKILL.md**
→ 重点阅读：`data-model.md`（JSON 示例）+ `hook-reference.md`（注入时机）

## 外部参考

- [项目技术规范](../../skills/project-conventions/SKILL.md) — 编码规范、钩子合规、命名规则
- [项目协作协议](../../skills/collaboration-protocol/SKILL.md) — 多 Agent 协作标记规范
- [版本路线图](../roadmap/) — v3.x → v4.0 架构演进
