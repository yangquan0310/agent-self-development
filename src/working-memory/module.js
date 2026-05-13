/**
 * 工作记忆 —— 面向对象封装
 *
 * v4.0.0 变更：
 * - 注册 before_prompt_build 注入 WM 文件上下文（替代 Session 内存复用）
 * - 移除 _updateActiveSession / _removeActiveSession（清理全局索引 working_memory:active_sessions）
 * - 调整 onAgentEnd 归档逻辑：读取项目级 .agent/tasks/{runId}.json 和事件文件归档
 * - onAfterToolCall 扩展文件变更审计追踪（读取事件文件变更记录 → 系统层日志）
 * - 添加 getTaskFilePaths 静态方法
 *
 * 核心概念：
 * - 上下文通过文件系统保持，不依赖 Session 内存复用
 * - Agent 是唯一写入者，插件只读取项目文件
 */

import { promises as fs } from 'fs';
import { getToday, getNow, inferTaskFamily } from '../common/utils.js';
import { HookRegistry } from '../common/hook.js';
import { resolveEventFilePath, resolveTaskFilePath, resolveEventFilePathFromComponents } from '../common/project-context.js';

export class WorkingMemory {
  constructor({ api, config, state, skills, logger, log, session, events }) {
    this.api = api;
    this.config = config || {};
    this.state = state;
    this.skills = skills;
    this.logger = logger;
    this.log = log;
    this.session = session;
    this.events = events;
    this.enabled = this.config.enabled !== false;
    this.trackSubagents = this.enabled && this.config.trackSubagents !== false;
    this.autoArchive = this.enabled && this.config.autoArchive !== false;
    // v3.5.0: 标记 subagent hooks 是否可用，避免与 before_tool_call 重复处理
    this._subagentHooksAvailable = false;

    // v4.1.0: Hook 抽象层基类
    this.hookRegistry = new HookRegistry({
      api: this.api,
      logger: this.logger,
      pluginId: 'agent-self-development'
    });
  }

  /**
   * 注册所有工作记忆相关的 hooks
   */
  register() {
    if (!this.enabled) {
      this.logger.info('[WM] 工作记忆模块已禁用');
      return;
    }

    this.logger.info('[WM] 注册工作记忆 Hooks');
    this._registerPromptBuild();
    this._registerSessionTracking();
    this._registerSubagentHooks();
    this._registerToolResult();
    this._registerArchive();
  }

  // v4.0.0: 文件上下文注入: before_prompt_build
  _registerPromptBuild() {
    this.hookRegistry.register('before_prompt_build', this.onBeforePromptBuild, this, { priority: 45 });
  }

  // ── 任务空间追踪: before_tool_call ──
  _registerSessionTracking() {
    if (!this.trackSubagents) return;
    this.hookRegistry.register('before_tool_call', this.onBeforeToolCall, this);
  }

  // ── 工具结果记录: after_tool_call ──
  _registerToolResult() {
    this.hookRegistry.register('after_tool_call', this.onAfterToolCall, this);
  }

  // ── 子代理追踪: subagent_* ──
  _registerSubagentHooks() {
    if (!this.trackSubagents) return;
    // v3.5.0: 优先使用原生 subagent hooks，回退到 before_tool_call
    try {
      this.hookRegistry.register('subagent_spawning', this.onSubagentSpawning, this);
      this.hookRegistry.register('subagent_spawned', this.onSubagentSpawned, this);
      this.hookRegistry.register('subagent_ended', this.onSubagentEnded, this);
      this._subagentHooksAvailable = true;
      this.logger.debug('[WM] 已注册 subagent_* hooks');
    } catch {
      this.logger.warn('[WM] subagent_* hooks 不可用，回退到 before_tool_call');
      this._subagentHooksAvailable = false;
    }
  }

  // ── 归档与状态更新: agent_end ──
  _registerArchive() {
    if (!this.autoArchive) return;
    // v3.5.0: WM 在 agent_end 只做清理，不返回注入
    this.hookRegistry.register('agent_end', this.onAgentEnd, this, { priority: 40 });
  }

  // ── 辅助：获取 task JSON（不自动创建）──
  async _getTask(runId) {
    return this.state.getTask(runId);
  }

  async _saveTask(task) {
    task.updatedAt = getNow();
    await this.state.saveTask(task.runId, task);
  }

  // v4.0.0: 从项目级 tasks/{runId}.json 读取文件列表
  static async getTaskFilePaths(runId, projectRoot = '.') {
    try {
      const content = await fs.readFile(`${projectRoot}/${resolveTaskFilePath(runId)}`, 'utf-8');
      const taskIndex = JSON.parse(content);
      return taskIndex.files ? taskIndex.files.map(f => f.path) : [];
    } catch {
      return [];
    }
  }

  // v4.0.0: before_prompt_build —— 注入 WM 文件上下文
  async onBeforePromptBuild(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const task = await this._getTask(runId);
    if (!task || task.status !== 'active') return;

    // v4.0.0: 注入条件：task.status === 'active' 且该任务已有历史文件
    const filePaths = await WorkingMemory.getTaskFilePaths(runId);
    if (filePaths.length === 0) return;

    const wmSkill = await this.skills.load('working_memory');
    if (!wmSkill) return;

    const fileContext = `
【文件系统上下文保持规则】
1. 上下文通过文件系统保持，不依赖 Session 内存复用
2. 当前任务已涉及的文件列表：
${filePaths.map(p => `   - ${p}`).join('\n')}
3. 子代理产出通过文件路径关联到主任务，不追踪 Session ID
4. 每次写入文件后，Agent 自行更新 .agent/tasks/${runId}.json（Agent 是唯一写入者）
5. 如需了解任务涉及的所有文件，请读取 .agent/tasks/${runId}.json
`;

    this.logger.debug(`[WM] 注入文件上下文: runId=${runId}, files=${filePaths.length}`);
    return {
      prependSystemContext: `${wmSkill}\n${fileContext}`
    };
  }

  /**
   * 追踪任务空间创建
   */
  async onBeforeToolCall(event, ctx) {
    const toolName = event.toolName;
    const isSpawnTool = toolName === 'sessions_spawn' || toolName === 'agent' || toolName === 'subagent';
    if (!isSpawnTool) return;

    // v3.5.0: 如果 subagent hooks 可用，跳过 tool_call 中的子代理处理，避免重复
    if (this._subagentHooksAvailable) return;

    const runId = ctx.runId;
    const sessionId = event.params?.id || event.params?.name || `sub-${Date.now()}`;
    const purpose = event.params?.purpose || event.params?.instruction || '';
    const taskFamily = inferTaskFamily(purpose);

    // 保存 Session 到全局
    await this.state.saveSession(sessionId, {
      sessionId,
      taskFamily,
      role: event.params?.role || '助手',
      task: purpose,
      status: 'active',
      createdAt: getNow(),
      lastActive: getNow()
    });

    // 把 sessionId 关联到当前 task（如果 task 存在）
    const task = await this._getTask(runId);
    if (task && !task.sessionIds.includes(sessionId)) {
      task.sessionIds.push(sessionId);
      await this._saveTask(task);
    }

    this.logger.debug(`[WM] 创建任务空间: ${sessionId} (taskFamily=${taskFamily}, parent=${runId})`);
    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'WM',
        runId,
        message: `Session created: ${sessionId}`,
        extra: { sessionId, taskFamily, role: event.params?.role || '助手', status: 'active' }
      });
    }
  }

  /**
   * 记录工具错误和任务空间完成状态
   *
   * v4.0.0: 扩展文件变更审计追踪
   * - 触发条件：after_tool_call + 工具为 write/edit + 文件路径匹配 *.md
   * - 执行动作：读取当前任务事件文件的「变更记录」章节，将新记录转存到系统层日志
   */
  async onAfterToolCall(event, ctx) {
    const runId = ctx.runId;
    const result = event.result;
    const toolName = event.toolName;

    const task = await this._getTask(runId);
    if (!task) return;

    const isError = result && (result.error || result.status === 'error');
    if (isError) {
      task.tools.push({
        time: getNow(),
        type: 'tool_error',
        toolName,
        summary: String(result.error || 'unknown error').slice(0, 200)
      });
    }

    const isSpawnTool = toolName === 'sessions_spawn' || toolName === 'agent' || toolName === 'subagent';
    if (isSpawnTool) {
      const sessionId = event.params?.id || event.params?.name;
      const status = isError ? 'killed' : 'completed';

      task.tools.push({
        type: 'subagent_complete',
        sessionId,
        resultSummary: this.summarizeResult(result),
        status,
        timestamp: getNow()
      });

      // 更新 Session 状态
      const session = await this.state.getSession(sessionId);
      if (session) {
        session.status = status;
        session.lastActive = getNow();
        await this.state.saveSession(sessionId, session);
      }
    }

    // v4.0.0: 文件变更审计追踪
    const filePath = event.params?.file || event.params?.path || '';
    const isWriteEdit = toolName === 'write' || toolName === 'edit';
    if (isWriteEdit && filePath.endsWith('.md')) {
      await this._auditFileChange(runId, toolName, filePath, event.params?.description || '');
    }

    await this._saveTask(task);
    if (isError && this.log) {
      await this.log.write({
        level: 'ERROR',
        module: 'WM',
        runId,
        message: `Tool error: ${toolName}`,
        extra: { toolName, error: String(result.error || 'unknown error').slice(0, 200) }
      });
    }
  }

  // v4.0.0: 读取事件文件变更记录，转存到系统层日志
  async _auditFileChange(runId, toolName, filePath, description) {
    try {
      const task = await this._getTask(runId);
      if (!task || !task.createdAt) return;

      const date = new Date(task.createdAt).toISOString().slice(0, 10);
      const hh = String(new Date(task.createdAt).getHours()).padStart(2, '0');
      const mm = String(new Date(task.createdAt).getMinutes()).padStart(2, '0');
      const ss = String(new Date(task.createdAt).getSeconds()).padStart(2, '0');
      const eventFilePath = resolveEventFilePathFromComponents(date, hh, mm, ss);

      // 读取事件文件的「变更记录」章节
      let eventContent = '';
      try {
        eventContent = await fs.readFile(eventFilePath, 'utf-8');
      } catch {
        return; // 事件文件不存在，跳过
      }

      const changeLogMatch = eventContent.match(/## 4\. 变更记录[\s\S]*?(?=## 5\. |## 6\. |$)/);
      if (changeLogMatch) {
        const lines = changeLogMatch[0].split('\n').filter(l => l.trim().startsWith('-'));
        const lastLine = lines[lines.length - 1] || '';
        if (lastLine.includes(filePath)) {
          // 转存到系统层日志
          if (this.log) {
            await this.log.write({
              level: 'INFO',
              module: 'WM',
              runId,
              message: `File audit: ${toolName} ${filePath}`,
              extra: { toolName, filePath, description: description.slice(0, 50) }
            });
          }
        }
      }
    } catch (err) {
      this.logger.debug(`[WM] 文件变更审计失败: ${err.message}`);
    }
  }

  /**
   * subagent_spawning: 子代理即将创建
   */
  async onSubagentSpawning(event, ctx) {
    const runId = ctx.runId;
    const sessionId = event.sessionId || event.id || `sub-${Date.now()}`;
    this.logger.debug(`[WM] subagent_spawning: ${sessionId}, parent=${runId}`);
  }

  /**
   * subagent_spawned: 子代理已创建
   */
  async onSubagentSpawned(event, ctx) {
    const runId = ctx.runId;
    const sessionId = event.sessionId || event.id || `sub-${Date.now()}`;
    const purpose = event.purpose || event.instruction || '';
    const taskFamily = inferTaskFamily(purpose);

    await this.state.saveSession(sessionId, {
      sessionId,
      taskFamily,
      role: event.role || '助手',
      task: purpose,
      status: 'active',
      createdAt: getNow(),
      lastActive: getNow()
    });

    const task = await this._getTask(runId);
    if (task && !task.sessionIds.includes(sessionId)) {
      task.sessionIds.push(sessionId);
      await this._saveTask(task);
    }

    this.logger.debug(`[WM] subagent_spawned: ${sessionId} (taskFamily=${taskFamily}, parent=${runId})`);
  }

  /**
   * subagent_ended: 子代理已结束
   */
  async onSubagentEnded(event, ctx) {
    const runId = ctx.runId;
    const sessionId = event.sessionId || event.id;
    const status = event.status || 'completed';

    const session = await this.state.getSession(sessionId);
    if (session) {
      session.status = status;
      session.lastActive = getNow();
      await this.state.saveSession(sessionId, session);
    }

    const task = await this._getTask(runId);
    if (task) {
      task.tools.push({
        type: 'subagent_complete',
        sessionId,
        resultSummary: this.summarizeResult(event.result),
        status,
        timestamp: getNow()
      });
      await this._saveTask(task);
    }

    this.logger.debug(`[WM] subagent_ended: ${sessionId}, status=${status}`);
  }

  /**
   * 归档 completed 任务空间，更新 task JSON 状态
   *
   * v4.0.0: 调整归档逻辑
   * - 读取项目级 .agent/tasks/{runId}.json 和事件文件
   * - 写入系统层 Memory 数据库
   * - 不再维护 working_memory:active_sessions 全局索引
   */
  async onAgentEnd(event, ctx) {
    const runId = ctx.runId;
    if (!runId) return;

    const task = await this._getTask(runId);
    if (!task) {
      this.logger.debug(`[WM] runId=${runId} 无 task，跳过归档`);
      return;
    }

    // v3.5.0: 状态转换由 Agent 标记决定，WM 只在 completed 时归档
    if (task.status !== 'completed') {
      this.logger.debug(`[WM] runId=${runId}, task.status=${task.status}，不归档，等待 Agent 标记 [STATUS: completed]`);
      if (this.log) {
        await this.log.write({
          level: 'INFO',
          module: 'WM',
          runId,
          message: `Agent ended, task.status=${task.status}, skip archive`,
          extra: { taskStatus: task.status }
        });
      }
      return;
    }

    // 遍历本次任务关联的 sessions
    const completedSessions = [];
    const killedSessions = [];
    const pausedSessions = [];

    for (const sessionId of task.sessionIds || []) {
      const session = await this.state.getSession(sessionId);
      if (!session) continue;

      if (session.status === 'completed') {
        completedSessions.push(session);
      } else if (session.status === 'killed') {
        killedSessions.push(session);
      } else if (session.status === 'paused') {
        pausedSessions.push(session);
      }
    }

    // v3.5.0: 任务归档记录
    task.outcome = {
      archivedAt: getNow(),
      completedSessions: completedSessions.map(s => s.sessionId),
      killedSessions: killedSessions.map(s => s.sessionId),
      pausedSessions: pausedSessions.map(s => s.sessionId),
      toolCount: (task.tools || []).length
    };
    await this._saveTask(task);

    // v4.0.0: 读取项目级事件文件和 tasks/{runId}.json，归档到系统层 Memory
    try {
      const eventFilePath = resolveEventFilePath(task);
      let eventContent = '';
      if (eventFilePath) {
        try {
          eventContent = await fs.readFile(eventFilePath, 'utf-8');
        } catch {
          // 事件文件不存在
        }
      }

      // 读取项目级 tasks/{runId}.json
      let projectTaskIndex = null;
      try {
        const taskIndexContent = await fs.readFile(resolveTaskFilePath(runId), 'utf-8');
        projectTaskIndex = JSON.parse(taskIndexContent);
      } catch {
        // 项目级 task 索引不存在
      }

      const archivePayload = {
        runId,
        status: task.status,
        deviations: task.deviations || [],
        attributions: task.attributions || [],
        outcome: task.outcome || {},
        eventContent: eventContent.slice(0, 5000), // 限制大小
        projectTaskIndex,
        archivedAt: Date.now()
      };

      if (this.events) {
        await this.events.archiveTask(archivePayload);
      }
    } catch (err) {
      this.logger.warn(`[WM] 项目级归档失败: runId=${runId}, error=${err.message}`);
    }

    this.logger.debug(`[WM] 任务归档: runId=${runId}, completed=${completedSessions.length}, killed=${killedSessions.length}`);

    if (this.log) {
      await this.log.write({
        level: 'INFO',
        module: 'WM',
        runId,
        message: 'Task archived',
        extra: {
          completedSessions: completedSessions.length,
          killedSessions: killedSessions.length,
          pausedSessions: pausedSessions.length,
          toolCount: (task.tools || []).length,
          taskStatus: task.status
        }
      });
    }

    // 将 completed task 移至 archive，保留最近 50 个
    const archived = await this.state.archiveTask(runId);
    if (archived) {
      this.logger.debug(`[WM] Task 已归档: runId=${runId} → archive/tasks_archive.json`);
    }

    // v3.5.0: agent_end 纯观察，禁止返回注入
    this.logger.debug(`[WM] 任务归档完成: runId=${runId}`);
  }

  /**
   * 将工具结果摘要化为短字符串
   */
  summarizeResult(result) {
    if (!result) return '无结果';
    if (typeof result === 'string') return result.slice(0, 200);
    if (result.summary) return result.summary;
    if (result.status) return `status=${result.status}`;
    return JSON.stringify(result).slice(0, 200);
  }

  /**
   * v3.5.0: Gateway 停止时清理资源
   */
  stop() {
    this.logger.info('[WM] 工作记忆模块停止');
  }
}
