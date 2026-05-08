import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Heartbeat } from '../src/common/heartbeat.js';
import {
  createMockApi, createMockCtx, createMockLogger,
  createMockLog, createMockState, createMockMemory
} from './helper.js';

describe('Heartbeat', () => {
  async function createHeartbeat(stateData = {}, sessionData = {}, eventLogs = []) {
    const api = createMockApi();
    const state = createMockState();
    for (const [k, v] of Object.entries(stateData)) await state.saveTask(k, v);
    for (const [k, v] of Object.entries(sessionData)) await state.saveSession(k, v);
    const memory = createMockMemory();
    const date = new Date().toISOString().slice(0, 10);
    for (const log of eventLogs) {
      await memory.appendEventLog(date, log);
    }
    const hb = new Heartbeat({
      api, config: {}, state, memory,
      logger: createMockLogger(), log: createMockLog()
    });
    hb.register();
    return { api, state, memory, hb };
  }

  it('heartbeat_prompt_contribution 返回 prependContext', async () => {
    const { api } = await createHeartbeat({
      't1': { runId: 't1', status: 'active' },
      't2': { runId: 't2', status: 'draft' }
    }, {
      's1': { sessionId: 's1', status: 'active' },
      's2': { sessionId: 's2', status: 'idle' }
    });
    const [result] = await api._emit('heartbeat_prompt_contribution', {}, createMockCtx());
    assert.ok(result);
    assert.ok(result.prependContext);
    assert.ok(result.prependContext.includes('活跃任务：1 个'));
    assert.ok(result.prependContext.includes('草稿任务：1 个'));
    assert.ok(result.prependContext.includes('活跃会话：1 个'));
    assert.ok(result.prependContext.includes('idle 会话：1 个'));
  });

  it('统计今日事件数', async () => {
    const { api } = await createHeartbeat({}, {}, [{ runId: 'r1' }, { runId: 'r2' }]);
    const [result] = await api._emit('heartbeat_prompt_contribution', {}, createMockCtx());
    assert.ok(result.prependContext.includes('今日事件：2 条'));
  });

  it('禁用时注册为空', async () => {
    const api = createMockApi();
    const hb = new Heartbeat({
      api, config: { enabled: false }, state: createMockState(), memory: createMockMemory(),
      logger: createMockLogger(), log: createMockLog()
    });
    hb.register();
    assert.strictEqual(api._hooks.get('heartbeat_prompt_contribution'), undefined);
  });
});
