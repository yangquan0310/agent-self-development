# 扁平工具架构的数学形式化

> **版本**：v1.0.0
> **日期**：2026-05-22
> **基于**：architecture.md
> **作者**：数学家

---

## 1. 架构的形式化定义

### 1.1 三层架构范畴

定义**扁平工具架构**为三层范畴 $\mathbf{FlatTool}$：

$$
\mathbf{FlatTool} = \left\langle \mathcal{A}gent, \mathcal{T}ool, \mathcal{FS} \right\rangle
$$

其中每层是**集合**（或类型）：

| 层 | 符号 | 定义 | Agent 对应 |
|----|------|------|------------|
| **Agent 层** | $\mathcal{A}gent$ | 自主决策智能体集合 | OpenClaw Agent |
| **Tool 层** | $\mathcal{T}ool$ | 8 个工具函数集合 | task.* / event.* |
| **文件系统层** | $\mathcal{FS}$ | 持久化文件状态集合 | JSON / Markdown 文件 |

### 1.2 层间映射（Functors）

定义**层间函子**描述数据流动：

$$
F_{AT}: \mathcal{A}gent \to \mathcal{T}ool \quad \text{(Agent 调用 Tool)}
$$
$$
F_{TF}: \mathcal{T}ool \to \mathcal{FS} \quad \text{(Tool 操作文件)}
$$
$$
F_{FA}: \mathcal{FS} \to \mathcal{A}gent \quad \text{(Agent 读取文件)}
$$

### 1.3 架构的范畴论性质

**平坦性（Flatness）**：

$$
\forall T \in \mathcal{T}ool: \text{dep}(T) \subseteq \mathcal{F} \cup \mathbb{F}
$$

即每个 Tool 仅依赖：
- 文件系统 $\mathcal{F}$（纯粹的 IO 操作）
- 数学函数 $\mathbb{F}$（无副作用的纯函数）

**无状态性（Statelessness）**：

$$
\forall T \in \mathcal{T}ool: \text{state}(T, t) = \text{state}(T, t') \quad \forall t, t'
$$

Tool 层本身不维护运行时状态。

---

## 2. Tool 层的数学描述

### 2.1 工具函数签名

每个工具 $T \in \mathcal{T}ool$ 可表示为函数：

$$
T: \mathcal{I} \to \mathcal{O}
$$

其中 $\mathcal{I}$ 是输入类型，$\mathcal{O}$ 是输出类型。

**8 个工具函数**：

| 工具 | 符号 | 签名 |
|------|------|------|
| task.create | $T_{\text{create}}$ | $\mathcal{P} \to \mathcal{R}$ |
| task.update | $T_{\text{update}}$ | $\mathcal{R} \times \mathcal{U} \to \mathcal{R}$ |
| task.advance | $T_{\text{advance}}$ | $\mathcal{R} \to \mathcal{R}$ |
| task.get | $T_{\text{get}}$ | $\mathcal{R} \to \mathcal{T}\mathcal{J}$ |
| task.archive | $T_{\text{archive}}$ | $\mathcal{R} \to \mathcal{R}_{\text{arch}}$ |
| event.report | $E_{\text{report}}$ | $\mathcal{R} \to \mathcal{E}\mathcal{M}$ |
| event.query | $E_{\text{query}}$ | $\mathcal{Q} \to \mathcal{E}\mathcal{M}^*$ |
| event.archive | $E_{\text{archive}}$ | $\mathcal{E}\mathcal{M} \to \mathcal{E}\mathcal{M}_{\text{arch}}$ |

其中：
- $\mathcal{P}$：Plan 输入
- $\mathcal{R}$：runId
- $\mathcal{U}$：更新参数
- $\mathcal{T}\mathcal{J}$：Task JSON
- $\mathcal{E}\mathcal{M}$：Event Markdown
- $\mathcal{Q}$：查询条件

### 2.2 工具组合代数

Tool 层支持**顺序组合**（ Semicolon operator）：

$$
(T_1; T_2)(\vec{x}) = T_2(T_1(\vec{x}))
$$

**幂等性**：每个 Tool 是幂等的：

$$
\forall T \in \mathcal{T}ool: T \circ T = T
$$

（重复调用产生相同结果）

### 2.3 返回值范畴

所有工具返回**结果范畴** $\mathcal{R}esult$：

$$
\mathcal{R}esult = \mathcal{S}uccess \oplus \mathcal{E}rror
$$

- $\mathcal{S}uccess = \{ (s, d) : s = \text{true}, d \in \mathcal{D} \}$
- $\mathcal{E}rror = \{ (s, e) : s = \text{false}, e \in \mathcal{E} \}$

---

## 3. 文件系统层的数学描述

### 3.1 状态空间

定义**文件系统状态** $\Sigma$：

$$
\Sigma = \bigcup_{\text{path} \in \mathcal{P}ath} \mathcal{V}_{\text{path}}
$$

其中 $\mathcal{V}_{\text{path}}$ 是路径对应的值域（如 JSON、Markdown）。

### 3.2 原子操作

文件系统支持**原子操作**集合 $\mathcal{A}tom$：

| 操作 | 符号 | 类型 |
|------|------|------|
| 读 JSON | $\text{readJson}$ | $\mathcal{P}ath \to \mathcal{V}$ |
| 写 JSON | $\text{writeJson}$ | $\mathcal{P}ath \times \mathcal{V} \to \Sigma$ |
| 写 Markdown | $\text{writeMd}$ | $\mathcal{P}ath \times \mathcal{M} \to \Sigma$ |
| 确保目录 | $\text{ensureDir}$ | $\mathcal{P}ath \to \Sigma$ |

### 3.3 路径映射函数

定义**路径解析函数**：

$$
\rho: \mathcal{R} \to \mathcal{P}ath
$$

$$
\begin{aligned}
\rho_{\text{task}}(r) &= \text{.agentstasks/}\{r\}\text{.json} \\
\rho_{\text{taskArch}}(r) &= \text{.agentstasks/archive/}\{r\}\text{.json} \\
\rho_{\text{event}}(r) &= \text{.agentsevents/}\{date\}\{r\}\text{.md} \\
\rho_{\text{eventArch}}(r) &= \text{.agentsevents/archive/}\{date\}\{r\}\text{.md}
\end{aligned}
$$

---

## 4. 数据流的形式化

### 4.1 Task 创建流程

```
Agent                    Plugin Tool                File System
  │                           │                          │
  ├─ T_create({prompt}) ────→│                          │
  │                           ├─ readJson(template) ────→│
  │                           │←───────────── TJ ───────│
  │                           ├─ writeJson(runId, TJ) ──→│
  │                           │←─── {success} ──────────│
  │←─── {success, runId} ────│                          │
```

**数学表示**：

$$
T_{\text{create}}(\text{prompt}) = \pi_1 \circ \text{writeJson} \circ (\rho_{\text{task}}, \text{fill}(\text{template}, \text{prompt}))
$$

### 4.2 Task 更新流程

**数学表示**：

$$
T_{\text{update}}(r, u) = \pi_1 \circ \text{writeJson} \circ (\rho_{\text{task}}(r), \text{merge}(\text{readJson}(\rho_{\text{task}}(r)), u))
$$

其中 $\text{merge}$ 是**浅合并**操作：

$$
\text{merge}(J_1, J_2)(k) = \begin{cases}
J_2(k) & k \in \text{keys}(J_2) \\
J_1(k) & k \notin \text{keys}(J_2)
\end{cases}
$$

### 4.3 Event Report 流程

**数学表示**：

$$
E_{\text{report}}(r) = \text{writeMd} \circ (\rho_{\text{event}}(r), \text{render}(\text{template}, \text{readJson}(\rho_{\text{task}}(r))))
$$

其中 $\text{render}$ 是模板渲染函数：

$$
\text{render}: \mathcal{T}emplate \times \mathcal{T}\mathcal{J} \to \mathcal{M}
$$

---

## 5. 状态转换系统

### 5.1 Task 状态机

定义**任务状态**集合 $\mathcal{S}tate$：

$$
\mathcal{S}tate = \{ \text{draft}, \text{active}, \text{revising}, \text{completed} \}
$$

定义**状态转移函数**：

$$
\delta: \mathcal{S}tate \times \mathcal{A} \to \mathcal{S}tate
$$

$$
\begin{array}{c|cccc}
\delta      & \text{draft} & \text{active} & \text{revising} & \text{completed} \\
\hline
\text{create} & \text{active} & - & - & - \\
\text{advance} & - & \text{completed} & \text{completed} & - \\
\text{revise}  & - & \text{revising} & - & - \\
\text{archive} & - & - & - & \text{archived}
\end{array}
$$

### 5.2 状态不变量

**不变量**（Invariants）：

1. **存在性**：$\forall r \in \mathcal{R}: \text{exists}(\rho_{\text{task}}(r)) \lor \text{exists}(\rho_{\text{taskArch}}(r))$
2. **唯一性**：$\forall r \neq r': \rho_{\text{task}}(r) \neq \rho_{\text{task}}(r')$
3. **状态一致性**：$\text{readJson}(\rho_{\text{task}}(r)).\text{status} \in \mathcal{S}tate$

---

## 6. 异常处理的形式化

### 6.1 错误类型集合

定义**错误类型** $\mathcal{E}rror$：

$$
\mathcal{E}rror = \mathcal{E}_{\text{path}} \cup \mathcal{E}_{\text{state}} \cup \mathcal{E}_{\text{validate}} \cup \mathcal{E}_{\text{io}}
$$

| 错误类型 | 描述 | 处理策略 |
|----------|------|----------|
| $\mathcal{E}_{\text{path}}$ | 路径不存在/无效 | 创建目录 |
| $\mathcal{E}_{\text{state}}$ | 状态转换非法 | 返回错误，不操作 |
| $\mathcal{E}_{\text{validate}}$ | 输入验证失败 | 返回验证错误 |
| $\mathcal{E}_{\text{io}}$ | 文件 IO 失败 | 返回 IO 错误 |

### 6.2 异常安全（Exception Safety）

Tool 函数满足**强异常安全**：

$$
\forall T \in \mathcal{T}ool: \text{io}(\sigma) = \sigma' \Rightarrow T(\sigma) = \perp \lor T(\sigma) = \sigma'
$$

即：要么完全成功（$\sigma \to \sigma'$），要么失败回滚（$\perp$），不存在部分修改状态。

---

## 7. 并发模型

### 7.1 并发假设

由于事件文件采用**延迟生成**策略（任务完成后一次性生成），不存在执行期间的文件竞争。

### 7.2 并发安全条件

对于任意两个操作 $T_1, T_2 \in \mathcal{T}ool$：

$$
\text{concurrent\_safe}(T_1, T_2) = \begin{cases}
\text{true} & \text{若 } \text{paths}(T_1) \cap \text{paths}(T_2) = \emptyset \\
\text{false} & \text{否则}
\end{cases}
$$

**验证**：由于 runId 是唯一标识，同一 runId 的操作是串行的，不同 runId 的操作互不影响。

---

## 8. 复杂度分析

### 8.1 时间复杂度

| 操作 | 时间复杂度 |
|------|------------|
| $T_{\text{create}}$ | $O(1)$ |
| $T_{\text{update}}$ | $O(1)$ |
| $T_{\text{advance}}$ | $O(1)$ |
| $T_{\text{get}}$ | $O(1)$ |
| $T_{\text{archive}}$ | $O(1)$ |
| $E_{\text{report}}$ | $O(1)$ |
| $E_{\text{query}}$ | $O(n)$（扫描归档目录） |
| $E_{\text{archive}}$ | $O(1)$ |

### 8.2 空间复杂度

文件系统空间使用：

$$
\text{space}(n) = n \cdot (|\text{TaskJSON}| + |\text{EventMD}|)
$$

其中 $n$ 是任务/事件数量。

---

## 9. 架构对比数学形式

### 9.1 v4.2.0 vs v4.3.0

**v4.2.0（类架构）**：

$$
\mathbf{v42} = \left\langle \mathcal{O}, \mathcal{M}, \mathcal{H} \right\rangle
$$

- $\mathcal{O}$：对象集合（TaskObject, EventObject, ...）
- $\mathcal{M}$：管理器集合（TaskManager, HookManager, ...）
- $\mathcal{H}$：Hook 系统

**v4.3.0（扁平架构）**：

$$
\mathbf{v43} = \left\langle \mathcal{F}, \mathbb{F} \right\rangle
$$

- $\mathcal{F}$：文件系统（唯一状态）
- $\mathbb{F}$：纯函数集合（无状态）

### 9.2 转换函数

$$
\text{Simplify}: \mathbf{v42} \to \mathbf{v43}
$$

$$
\text{Simplify}(\text{Manager.method}) = \text{纯函数}
$$

$$
\text{Simplify}(\text{Hook}) = \text{直接 IO}
$$

---

## 10. 理论对应表

| 架构概念 | 数学表示 | 性质 |
|----------|----------|------|
| Agent 层 | $\mathcal{A}gent$ | 自主决策 |
| Tool 层 | $\mathcal{T}ool$ | 纯函数、无状态 |
| 文件系统层 | $\mathcal{FS}$ | 唯一状态源 |
| 状态转换 | $\delta: \mathcal{S} \times \mathcal{A} \to \mathcal{S}$ | 确定有限状态机 |
| 异常处理 | $\mathcal{E}rror$ | 强异常安全 |
| 并发安全 | $\text{concurrent\_safe}$ | runId 隔离 |
| 复杂度 | $O(1)$（大部分操作） | 高效 |

---

## 11. 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0.0 | 2026-05-22 | 初始版本：扁平工具架构的数学形式化 |

---

*文档版本：v1.0.0*
