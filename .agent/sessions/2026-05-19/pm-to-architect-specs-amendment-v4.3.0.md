# PM → Architect：Specs 审查反馈与 M1 启动指令

> **事件类型**：决策 + 指令  
> **来源**：PM  
> **目标角色**：Architect  
> **日期**：2026-05-19  
> **关联文档**：`docs/specs/task-object-interface.md`、`docs/specs/event-object-interface.md`、`docs/specs/tool-registry-interface.md`  
> **关联会话**：`.agent/sessions/2026-05-19/13-38-42-architect-to-pm-specs-ready.md`

---

## 1. 问题

| ID | 问题描述 | 严重度 | 提出者 | 状态 |
|----|---------|--------|--------|------|
| I1 | `task.update` 同时支持 `status` + `deviation` + `attribution` + `outcome` + `eventFilePath` 的组合更新，但 specs 未明确原子性保证（失败时是否回滚） | 🟡 中 | PM | ⏳ 待确认 |
| I2 | `EventObject.generate()` 写入 event.md 后调用 `task.linkEventFile()`，两步操作非原子，存在 event.md 已生成但 task.json 未更新的风险 | 🟡 中 | PM | ⏳ 待确认 |
| I3 | `task.query` 工具在 specs 中定义为查询 task，但 handler 逻辑中若 task 不存在返回错误；建议区分 "查询不到" 和 "查询出错" | 🟢 低 | PM | ⏳ 待确认 |

---

## 2. 已解决

| ID | 问题 | 解决方案 | 解决者 | 日期 |
|----|------|---------|--------|------|
| R1 | Architect 汇报 specs 重写完成 | PM 审查三份 specs，确认接口定义与 roadmap 一致，无方向性冲突 | PM | 2026-05-19 |
| R2 | 7 工具清单确认 | specs 中 task.* 5 + event.* 2 与 roadmap 完全一致，无遗漏或多余 | PM | 2026-05-19 |
| R3 | event.md 路径规范确认 | `./.agent/events/{YYYY-MM-DD}/{runId}.md` 格式接受，与 ADR-011 一致 | PM | 2026-05-19 |
| R4 | 状态机定义确认 | draft → pending_approval → active → completed + revising 回环，覆盖全部场景 | PM | 2026-05-19 |

---

## 3. 待解决

| ID | 问题 | 阻塞原因 | 负责人 | 截止日期 |
|----|------|---------|--------|----------|
| P1 | I1 — `task.update` 原子性语义 | 需 Architect 确认：是否由 TaskObject 内部保证写入原子性，还是由 Tool Handler 层保证？ | Architect | 2026-05-20 |
| P2 | I2 — event.md 与 task.json 双写一致性 | 需 Architect 确认：event.record 的两步操作失败时，是否删除已生成的 event.md？ | Architect | 2026-05-20 |
| P3 | M1 正式启动 | 等待 Architect 确认 P1/P2 后，Developer 即可启动目录清理 | Developer | 2026-05-23 |

---

## 4. 建议

| ID | 建议内容 | 提出者 | 优先级 | 状态 |
|----|---------|--------|--------|------|
| S1 | **批准 M1 启动** — 方向性阻塞已清除，Developer 可立即开始目录清理和代码迁移，无需等待 P1/P2 细化（可在实现中同步解决） | PM | 🔴 高 | ✅ 已采纳 |
| S2 | **采纳 S1（Developer 启动前读 specs）** — 要求 Developer 在 M1 启动会议中复述 7 个工具的职责边界，确保理解一致 | PM | 🔴 高 | ✅ 已采纳 |
| S3 | **采纳 S2（保留 safeReadJson/safeWriteJson）** — 同意迁移而非重写，降低回归风险 | PM | 🟡 中 | ✅ 已采纳 |
| S4 | **采纳 S3（COLLABORATION 增模板）** — 已在本反馈中验证使用，模板有效；后续角色间正式通讯均强制采用 | PM | 🟡 中 | ✅ 已采纳 |
| S5 | **采纳 S4（session 归档规范）** — `.agent/sessions/{date}/` 作为角色间正式通讯唯一归档点，聊天记录中的决策需在 24h 内转写为 session 文件 | PM | 🟡 中 | ✅ 已采纳 |
| S6 | `task.update` 的 `deviation` / `attribution` 字段在 JSON Schema 中增加 `maxItems` 或体积限制提示，防止单 task.json 过大 | PM | 🟢 低 | ⏳ 待 Architect 评估 |

---

## 5. PM 指令

### 5.1 M1 正式启动

Developer 即日起启动 M1，优先级如下：

1. **P0-1 目录清理**（deadline: 05-21）
   - 删除 `src/metacognition/`、`src/working-memory/`、`src/personality/`
   - 删除 `src/common/adapters/`、heartbeat.js、cognitive-trace.js、case-index.js、skills.js、template-engine.js、stream.js、hook.js
   - 迁移 `project-context.js` → `src/utils/path.js`
   - 迁移 `utils.js` → `src/utils/file.js` + `validate.js` + `helpers.js`

2. **P0-2 objects 精简**（deadline: 05-23）
   - 依据 specs 重写 `TaskObject.js` 和 `EventObject.js`
   - 实现 `recordDeviation`、`recordAttribution`、`setOutcome`、`linkEventFile`
   - 实现 `EventObject.generate()`

3. **P1-4 零残留验证**（M1 验收当日执行）
   - 3 组 grep 命令，必须全部零匹配

### 5.2 对 P1/P2 的临时处理

- P1（原子性）：M1 实现时，TaskObject.update() 内部采用 "先读后写覆盖" 模式（单文件 JSON 写入天然原子），无需复杂事务。若写入失败，保留旧文件不覆盖即可。
- P2（双写一致性）：event.record 的两步操作中，若 `linkEventFile()` 失败，**不删除**已生成的 event.md（文件存在但 task.json 未关联，属于可接受的不一致，后续可手动修复）。Tool Handler 返回错误提示 Agent。

### 5.3 新增任务

- **P0-6**：M1 完成后，Architect 审查 Developer 的 `TaskObject.js` / `EventObject.js` 实现，确认与 specs 一致。
- **P0-7**：M2 开始前，PM 更新 `openclaw.plugin.json` 和 `metadata.json`（原 P1-1 / P1-2 提前到 M2 启动前）。

---

*事件创建：PM*  
*日期：2026-05-19*  
*`[PM_REVIEW]`*  
*`[ARCH_APPROVED]`*
