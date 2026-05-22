# 技术参考手册 · 目录

> **版本**：v1.0.0
> **日期**：2026-05-22

---

## 章节索引

### [preface.md](preface.md) · 前言

本书定位、读者对象、章节导航。

---

### [ch01-architecture.md](ch01-architecture.md) · 第一章：架构设计

**内容**：v4.3.0 扁平工具架构：Agent / Tool / 文件系统三层 + 8 个命名空间工具

**阅读时机**：理解模块职责划分时

---

### [ch02-data-model.md](ch02-data-model.md) · 第二章：数据模型

**内容**：Task / Deviation / Attribution / Outcome / Event JSON 结构 + 状态转换规则 + 8 个工具示例

**阅读时机**：操作数据对象或更新 SKILL.md 时

---

### [ch03-design-philosophy.md](ch03-design-philosophy.md) · 第三章：设计哲学

**内容**：从"代劳"到"赋能"——拉取式、显式接口、被动响应、扁平架构

**阅读时机**：理解架构决策时

---

### [ch04-distributed-autobiographical-memory-architecture.md](ch04-distributed-autobiographical-memory-architecture.md) · 第四章：分布式自传体记忆架构

**内容**：自传体记忆、工作自我、六维度平衡（基于博士论文）→ Agent 架构映射

**阅读时机**：理解框架为何这样设计时

---

### [ch05-hook-reference.md](ch05-hook-reference.md) · 第五章：Hook 机制

**内容**：v4.5.0 Hook 机制——三事件触发 + 条件触发

**阅读时机**：了解 Hook 注入时机时

---

### [ch06-piaget-development-algorithm.md](ch06-piaget-development-algorithm.md) · 第六章：皮亚杰发展算法

**内容**：六维度形式化定义、同化/顺应/平衡的数学建模、李雅普诺夫函数

**阅读时机**：理解自我调节算法时

---

### [ch07-object-model.md](ch07-object-model.md) · 第七章：对象模型

**内容**：v4.3.0 函数模块模型——对象层裸函数 + 工具层薄适配 + 基础设施原子 IO

**阅读时机**：开发新模块或修改现有模块时

---

### [ch08-project-structure.md](ch08-project-structure.md) · 第八章：项目结构

**内容**：被管理项目的标准目录结构（四文件契约 / .agents / archive / 业务目录）

**阅读时机**：初始化新项目或查阅目录规范时

---

### [ch09-state-keys.md](ch09-state-keys.md) · 第九章：状态键

**内容**：项目级文件系统键空间、task.json 字段规范

**阅读时机**：查阅数据存储位置时

---

## 快速定位

**新开发者入门**
→ 按顺序阅读：ch03 → ch04 → ch01 → ch07 → ch02

**添加新 tool**
→ ch01（架构约束）+ ch07（函数模块模板）+ ch02（数据模型）

**修改数据模型**
→ ch02（当前结构）+ ch09（文件路径规范）

**更新 SKILL.md**
→ ch02（JSON 示例 + 工具调用示例）+ ch01（工具列表）

**了解 Hook 机制**
→ ch05（v4.5.0 新设计）

**了解皮亚杰发展算法**
→ ch06（六维度形式化 + 六维度平衡算法）

---

## 外部参考

- [项目协作协议](../../COLLABORATION.md) — 多角色协作规范、边界定义、沟通模板
- [项目规范](../../CONVENTIONS.md) — 编码规范、目录结构、命名规则
- [版本路线图](../roadmap/) — v4.0 → v4.5 架构演进

---

*目录版本：v1.0.0*
*最后更新：2026-05-22*
