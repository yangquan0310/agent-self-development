/**
 * Hook 调用链可视化测试 — v4.1.0-M4
 *
 * 验证 HookRegistry 的 chain 累积、flush、日志格式。
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { HookRegistry, HookType } from '../src/common/hook.js';
import { createMockLogger } from './helper.js';

describe('Hook Chain Visualization', () => {
  let tmpDir;
  let logFile;
  let logger;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `asd-chain-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    logFile = join(tmpDir, 'agent-self-development-hooks.log');
    logger = createMockLogger();
  });

  afterEach(async () => {
    // 强制清理所有 registry 定时器（如果测试中忘记 stop）
    for (const [key, timer] of Object.entries(global)) {
      if (timer && typeof timer.unref === 'function' && timer[Symbol.toStringTag] === 'Timeout') {
        // 无法安全清理全局 timer，依赖 unref
      }
    }
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('flushChain 写入单条可还原日志', async () => {
    const registry = new HookRegistry({
      api: null,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    // 模拟累积 chain 记录
    registry._addToChain('run-001', { hookName: 'before_prompt_build', status: 'returned', elapsedMs: 2 });
    registry._addToChain('run-001', { hookName: 'llm_output', status: 'ok', elapsedMs: 1 });
    registry._addToChain('run-001', { hookName: 'before_agent_finalize', status: 'returned', elapsedMs: 3 });
    registry._addToChain('run-001', { hookName: 'agent_end', status: 'ok', elapsedMs: 1 });

    registry.flushChain('run-001', 'complete');

    const content = await fs.readFile(logFile, 'utf-8');
    assert.ok(content.includes('hookChain='));
    assert.ok(content.includes('before_prompt_build:returned:2ms'));
    assert.ok(content.includes('llm_output:ok:1ms'));
    assert.ok(content.includes('before_agent_finalize:returned:3ms'));
    assert.ok(content.includes('agent_end:ok:1ms'));
    assert.ok(content.includes('[complete]'));
    assert.ok(content.includes('total=4'));
  });

  it('错误 hook 记录包含 error 信息', async () => {
    const registry = new HookRegistry({
      api: null,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    registry._addToChain('run-002', { hookName: 'before_prompt_build', status: 'error', elapsedMs: 5, error: 'skill缺失' });
    registry._addToChain('run-002', { hookName: 'agent_end', status: 'ok', elapsedMs: 1 });

    registry.flushChain('run-002', 'error');

    const content = await fs.readFile(logFile, 'utf-8');
    assert.ok(content.includes('before_prompt_build:error:5ms:skill缺失'));
    assert.ok(content.includes('[error]'));
  });

  it('多个 runId 的 chain 互不干扰', async () => {
    const registry = new HookRegistry({
      api: null,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    registry._addToChain('run-A', { hookName: 'before_prompt_build', status: 'ok', elapsedMs: 1 });
    registry._addToChain('run-B', { hookName: 'before_prompt_build', status: 'ok', elapsedMs: 2 });

    registry.flushChain('run-A', 'complete');
    registry.flushChain('run-B', 'complete');

    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    assert.strictEqual(lines.length, 2);
    assert.ok(lines[0].includes('run-A'));
    assert.ok(lines[1].includes('run-B'));
  });

  it('stop() flush 所有剩余 chain', async () => {
    const registry = new HookRegistry({
      api: null,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    registry._addToChain('run-003', { hookName: 'before_prompt_build', status: 'ok', elapsedMs: 1 });
    registry._addToChain('run-004', { hookName: 'llm_output', status: 'ok', elapsedMs: 2 });

    registry.stop();

    const content = await fs.readFile(logFile, 'utf-8');
    assert.ok(content.includes('[flushed]'));
    assert.ok(content.includes('run-003'));
    assert.ok(content.includes('run-004'));
  });

  it('wrapHandler 自动累积 chain 记录', async () => {
    const api = {
      on: (name, handler) => {
        api._handlers = api._handlers || {};
        api._handlers[name] = handler;
      }
    };

    const registry = new HookRegistry({
      api,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    const handler = async () => ({ prependSystemContext: 'test' });
    registry.register('before_prompt_build', handler, null);

    // 模拟调用
    await api._handlers.before_prompt_build({}, { runId: 'run-005' });
    registry.flushChain('run-005', 'complete');

    const content = await fs.readFile(logFile, 'utf-8');
    assert.ok(content.includes('hookChain='));
    assert.ok(content.includes('before_prompt_build:returned'));
  });

  it('wrapHandler 错误时累积 error 状态', async () => {
    const api = {
      on: (name, handler) => {
        api._handlers = api._handlers || {};
        api._handlers[name] = handler;
      }
    };

    const registry = new HookRegistry({
      api,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    const handler = async () => { throw new Error('handler失败'); };
    registry.register('before_prompt_build', handler, null);

    await api._handlers.before_prompt_build({}, { runId: 'run-006' });
    registry.flushChain('run-006', 'complete');

    const content = await fs.readFile(logFile, 'utf-8');
    assert.ok(content.includes('before_prompt_build:error'));
    assert.ok(content.includes('handler失败'));
  });

  it('无 chain 时 flushChain 不写入日志', async () => {
    const registry = new HookRegistry({
      api: null,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    registry.flushChain('no-chain', 'complete');

    try {
      await fs.readFile(logFile, 'utf-8');
      assert.fail('日志文件不应存在');
    } catch (err) {
      assert.ok(err.code === 'ENOENT' || err.message.includes('ENOENT'));
    }
  });

  it('chain 日志格式可解析还原', async () => {
    const registry = new HookRegistry({
      api: null,
      logger,
      logDir: tmpDir,
      timeoutMs: 5000
    });

    registry._addToChain('run-007', { hookName: 'before_prompt_build', status: 'ok', elapsedMs: 2 });
    registry._addToChain('run-007', { hookName: 'llm_output', status: 'ok', elapsedMs: 1 });
    registry._addToChain('run-007', { hookName: 'before_agent_finalize', status: 'timeout', elapsedMs: 5000, error: 'Hook handler 超时' });

    registry.flushChain('run-007', 'timeout');

    const content = await fs.readFile(logFile, 'utf-8');
    const line = content.trim();

    // 解析验证
    const match = line.match(/\[hookChain=([^\]]+)\]/);
    assert.ok(match, '应包含 hookChain 字段');
    const chainEntries = match[1].split(',');
    assert.strictEqual(chainEntries.length, 3);

    assert.ok(chainEntries[0].includes('before_prompt_build:ok:2ms'));
    assert.ok(chainEntries[1].includes('llm_output:ok:1ms'));
    assert.ok(chainEntries[2].includes('before_agent_finalize:timeout:5000ms'));
    assert.ok(chainEntries[2].includes('Hook handler 超时'));
  });
});
