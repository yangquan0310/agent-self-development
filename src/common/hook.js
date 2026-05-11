import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_HOOKS_LOG_DIR = join(homedir(), '.agent', 'logs');
const HOOK_LOG_FILE = 'agent-self-development-hooks.log';
const CHAIN_MAX_AGE_MS = 5 * 60 * 1000; // 5 分钟清理旧 chain

/**
 * Hook 类型枚举
 * - MODIFYING: 可修改系统上下文（before_prompt_build, heartbeat_prompt_contribution）
 * - CLAIMING: 可返回 action（before_agent_finalize）
 * - VOID: 纯观察型，禁止注入/返回 action（llm_output, agent_end, tool_call, subagent_* 等）
 */
export const HookType = {
  MODIFYING: 'modifying',
  CLAIMING: 'claiming',
  VOID: 'void'
};

/**
 * 官方 Hook 类型映射表
 * 基于 CONVENTIONS.md 和 OpenClaw 官方文档
 */
const HOOK_CLASSIFICATION = {
  before_prompt_build: HookType.MODIFYING,
  heartbeat_prompt_contribution: HookType.MODIFYING,
  before_agent_finalize: HookType.CLAIMING,
  llm_output: HookType.VOID,
  agent_end: HookType.VOID,
  before_tool_call: HookType.VOID,
  after_tool_call: HookType.VOID,
  subagent_spawning: HookType.VOID,
  subagent_spawned: HookType.VOID,
  subagent_ended: HookType.VOID,
  gateway_stop: HookType.VOID
};

/**
 * Hook 抽象层基类
 *
 * v4.1.0 新增：统一 Hook 注册、错误捕获、超时策略和日志输出。
 * 设计目标：
 * 1. 封装 api.on() 注册，移除模块中的 .bind(this)
 * 2. 按官方文档区分 modifying / claiming / void 三种 hook 类型
 * 3. 统一错误捕获：try/catch → 日志 → 不抛异常中断 hook 链
 * 4. 统一超时策略：Promise.race + setTimeout
 * 5. 统一日志输出到 logs/agent-self-development-hooks.log
 * 6. 格式: [timestamp] [hookName] [pluginId] [runId] [status] message
 *
 * v4.1.0-M4 新增：钩子调用链可视化
 * - 按 runId（conversationId）累积 hook 执行记录
 * - 支持 flushChain 输出单条可还原日志
 * - 格式: [timestamp] [runId] [hookChain=a:ok,b:error] [complete|timeout|error]
 *
 * 使用方式（模块内）：
 *   this.hookRegistry.register('before_prompt_build', this.onBeforePromptBuild, this, { priority: 55 });
 */
export class HookRegistry {
  constructor({ api, logger, pluginId, logDir, timeoutMs = 5000 }) {
    this.api = api;
    this.logger = logger;
    this.pluginId = pluginId || 'agent-self-development';
    this.timeoutMs = timeoutMs;
    this.logFile = join(logDir || DEFAULT_HOOKS_LOG_DIR, HOOK_LOG_FILE);
    this._ensureLogFile();

    // v4.1.0-M4: 钩子调用链累积器
    this._chainBuffer = new Map(); // runId -> Array<{hookName, status, elapsedMs, error?, ts}>
    this._chainCleanupTimer = setInterval(() => this._cleanupOldChains(), CHAIN_MAX_AGE_MS);
    // 不阻止进程退出（测试场景需要）
    if (this._chainCleanupTimer && typeof this._chainCleanupTimer.unref === 'function') {
      this._chainCleanupTimer.unref();
    }
  }

  _ensureLogFile() {
    const dir = this.logFile.slice(0, this.logFile.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 分类 hook 类型
   */
  _classify(hookName) {
    return HOOK_CLASSIFICATION[hookName] || HookType.VOID;
  }

  // ── v4.1.0-M4: 钩子调用链可视化 ──

  /**
   * 将 hook 执行记录加入调用链（内存累积，延迟 < 1ms）
   */
  _addToChain(runId, entry) {
    if (!runId || runId === 'none') return;
    const chain = this._chainBuffer.get(runId) || [];
    chain.push({ ...entry, ts: Date.now() });
    this._chainBuffer.set(runId, chain);
  }

  /**
   * 清理过期的 chain 记录（防止内存泄漏）
   */
  _cleanupOldChains() {
    const now = Date.now();
    for (const [runId, chain] of this._chainBuffer.entries()) {
      const lastTs = chain[chain.length - 1]?.ts || 0;
      if (now - lastTs > CHAIN_MAX_AGE_MS) {
        this._writeChainSummary(runId, chain, 'incomplete');
        this._chainBuffer.delete(runId);
      }
    }
  }

  /**
   * 输出单条可还原的 hook 调用链日志
   * 格式: [timestamp] [runId] [hookChain=a:ok,b:error,c:timeout] [status]
   */
  _writeChainSummary(runId, chain, status) {
    if (!chain || chain.length === 0) return;
    const timestamp = new Date().toISOString();
    const segments = chain.map(e => {
      let seg = `${e.hookName}:${e.status}`;
      if (e.elapsedMs !== undefined) seg += `:${e.elapsedMs}ms`;
      if (e.error) seg += `:${e.error}`;
      return seg;
    });
    const hookChain = segments.join(',');
    const line = `[${timestamp}] [${runId}] [hookChain=${hookChain}] [${status}] total=${chain.length}\n`;
    try {
      appendFileSync(this.logFile, line, 'utf8');
    } catch (err) {
      this.logger?.warn?.(`[HookRegistry] chain 日志写入失败: ${err.message}`);
    }
  }

  /**
   * 手动 flush 某 conversation 的 hook 调用链
   * 由 Metacognition.onAgentEnd 等调用
   */
  flushChain(runId, status = 'complete') {
    const chain = this._chainBuffer.get(runId);
    if (chain) {
      this._writeChainSummary(runId, chain, status);
      this._chainBuffer.delete(runId);
    }
  }

  /**
   * 清理资源（停止定时器、flush 剩余 chain）
   */
  stop() {
    if (this._chainCleanupTimer) {
      clearInterval(this._chainCleanupTimer);
      this._chainCleanupTimer = null;
    }
    for (const [runId, chain] of this._chainBuffer.entries()) {
      this._writeChainSummary(runId, chain, 'flushed');
    }
    this._chainBuffer.clear();
  }

  /**
   * 写入 hooks 专用日志
   * 格式: [timestamp] [hookName] [pluginId] [runId] [status] message
   */
  _writeLog(timestamp, hookName, runId, status, message) {
    const line = `[${timestamp}] [${hookName}] [${this.pluginId}] [${runId || 'none'}] [${status}] ${message}\n`;
    try {
      appendFileSync(this.logFile, line, 'utf8');
    } catch (err) {
      this.logger?.warn?.(`[HookRegistry] hooks 日志写入失败: ${err.message}`);
    }
  }

  /**
   * 注册 hook
   * @param {string} hookName - hook 名称
   * @param {Function} handler - 处理器方法（无需 bind）
   * @param {Object} context - 处理器绑定的 this（模块实例）
   * @param {Object} options - api.on() 的选项（如 priority）
   */
  register(hookName, handler, context, options = {}) {
    if (!this.api) {
      this.logger?.error(`[HookRegistry] api 不可用，无法注册 hook: ${hookName}`);
      return;
    }

    const type = this._classify(hookName);
    const wrappedHandler = this._wrapHandler(hookName, handler, context, type);
    this.api.on(hookName, wrappedHandler, options);
    this.logger?.debug(`[HookRegistry] 注册 hook: ${hookName}, type=${type}`);
  }

  /**
   * 包装处理器：错误捕获 + 超时 + 日志 + 返回值校验 + 调用链累积
   */
  _wrapHandler(hookName, handler, context, type) {
    return async (event, ctx) => {
      const runId = ctx?.runId || 'none';
      const start = Date.now();
      const timestamp = new Date(start).toISOString();

      try {
        // 超时保护
        const result = await this._runWithTimeout(
          handler.call(context, event, ctx),
          this.timeoutMs,
          hookName
        );

        const elapsed = Date.now() - start;
        const hasReturn = result !== undefined && result !== null;
        const status = type === HookType.VOID
          ? (hasReturn ? 'warn' : 'ok')
          : (hasReturn ? 'returned' : 'ok');

        this._writeLog(timestamp, hookName, runId, status, `elapsed=${elapsed}ms type=${type}`);
        // v4.1.0-M4: 累积到调用链
        this._addToChain(runId, { hookName, status, elapsedMs: elapsed });

        // VOID 型 hook：禁止返回任何值
        if (type === HookType.VOID && hasReturn) {
          this.logger?.warn(`[HookRegistry] ${hookName} 为纯观察型 hook，不应返回值，已忽略`);
          this._writeLog(timestamp, hookName, runId, 'warn', '纯观察型 hook 返回了非空值，已忽略');
          return undefined;
        }

        // MODIFYING 型 hook：校验返回值格式
        if (type === HookType.MODIFYING && hasReturn) {
          if (!result.prependSystemContext && !result.prependContext) {
            this.logger?.warn(`[HookRegistry] ${hookName} modifying hook 返回值缺少 prependSystemContext/prependContext`);
            this._writeLog(timestamp, hookName, runId, 'warn', 'modifying hook 返回值缺少注入字段');
          }
        }

        // CLAIMING 型 hook：校验返回值格式
        if (type === HookType.CLAIMING && hasReturn) {
          if (!result.action) {
            this.logger?.warn(`[HookRegistry] ${hookName} claiming hook 返回值缺少 action 字段`);
            this._writeLog(timestamp, hookName, runId, 'warn', 'claiming hook 返回值缺少 action');
          }
        }

        return result;
      } catch (err) {
        const elapsed = Date.now() - start;
        const errorMsg = err.message || String(err);
        this._writeLog(timestamp, hookName, runId, 'error', `${errorMsg} elapsed=${elapsed}ms`);
        this.logger?.error(`[HookRegistry] ${hookName} handler 错误: ${errorMsg}`);
        // v4.1.0-M4: 累积错误到调用链
        this._addToChain(runId, { hookName, status: 'error', elapsedMs: elapsed, error: errorMsg });
        // 关键：不抛异常，不中断后续 hook 链
        return undefined;
      }
    };
  }

  /**
   * 带超时的 Promise 执行
   */
  _runWithTimeout(promise, ms, hookName) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Hook handler 超时 (${ms}ms): ${hookName}`));
        }, ms);
      })
    ]);
  }
}
