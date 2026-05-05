import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkingMemory } from '../src/working-memory/module.js';
import { Event } from '../src/metacognition/event.js';
import {
  createMockApi, createMockCtx, createMockLogger,
  createMockLog, createMockState, createMockSkills, createMockMemory
} from './helper.js';

describe('WorkingMemory', () => {
  function createWM(stateData = {}, sessionData = {}) {
    const api = createMockApi();
    const state = createMockState();
    for (const [k, v] of Object.entries(stateData)) state.saveTask(k, v);
    for (const [k, v] of Object.entries(sessionData)) state.saveSession(k, v);
    const memory = createMockMemory();
    const events = new Event(state, memory);
    const wm = new WorkingMemory({
      api, config: {}, state, skills: createMockSkills(),
      logger: createMockLogger(), log: createMockLog(),
      session: null, events
    });
    wm.register();
    return { api, state, wm, memory };
  }

  describe('agent_end', () => {
    it('task.status=completed 时归档', async () => {
      const { api, state, memory } = createWM({
        'r1': {
          runId: 'r1', status: 'completed',
          deviations: [], attributions: [],
          sessionIds: ['s1'], tools: [], plan: {}
        }
      }, {
        's1': { sessionId: 's1', taskFamily: 'CODE', status: 'completed' }
      });
      const taskBefore = await state.getTask('r1');
      await api._emit('agent_end', {}, createMockCtx('r1'));
      // task 引用仍有效（archiveTask 删除了 state 中的副本）
      assert.ok(taskBefore.outcome);
      assert.ok(taskBefore.outcome.archivedAt);
      const logs = await memory.getEventLog(new Date().toISOString().slice(0, 10));
      assert.strictEqual(logs.length, 1);
    });

    it('task.status=active 时不归档', async () => {
      const { api, state } = createWM({
        'r1': { runId: 'r1', status: 'active', sessionIds: [], tools: [], plan: {} }
      });
      await api._emit('agent_end', {}, createMockCtx('r1'));
      const task = await state.getTask('r1');
      assert.strictEqual(task.status, 'active');
      assert.strictEqual(task.outcome, undefined);
    });

    it('无 task 时跳过', async () => {
      const { api } = createWM();
      const results = await api._emit('agent_end', {}, createMockCtx('r1'));
      // 不抛异常即通过
      assert.ok(results);
    });
  });

  describe('subagent hooks', () => {
    it('subagent_spawned 创建 session 并关联到 task', async () => {
      const { api, state } = createWM({
        'r1': { runId: 'r1', status: 'active', sessionIds: [], tools: [], plan: {} }
      });
      await api._emit('subagent_spawned', {
        sessionId: 'sub-1', purpose: '搜索资料'
      }, createMockCtx('r1'));
      const session = await state.getSession('sub-1');
      assert.ok(session);
      assert.strictEqual(session.status, 'active');
      const task = await state.getTask('r1');
      assert.deepStrictEqual(task.sessionIds, ['sub-1']);
    });

    it('subagent_ended 更新 session 状态', async () => {
      const { api, state } = createWM({
        'r1': { runId: 'r1', status: 'active', sessionIds: ['sub-1'], tools: [], plan: {} }
      }, {
        'sub-1': { sessionId: 'sub-1', taskFamily: 'CODE', status: 'active' }
      });
      await api._emit('subagent_ended', {
        sessionId: 'sub-1', status: 'completed', result: { summary: '完成' }
      }, createMockCtx('r1'));
      const session = await state.getSession('sub-1');
      assert.strictEqual(session.status, 'completed');
      const task = await state.getTask('r1');
      assert.strictEqual(task.tools.length, 1);
      assert.strictEqual(task.tools[0].type, 'subagent_complete');
    });
  });

  describe('before_tool_call', () => {
    it('非子代理工具不处理', async () => {
      const { api, state } = createWM({
        'r1': { runId: 'r1', status: 'active', sessionIds: [], tools: [], plan: {} }
      });
      await api._emit('before_tool_call', { toolName: 'web_search', params: {} }, createMockCtx('r1'));
      const task = await state.getTask('r1');
      assert.deepStrictEqual(task.sessionIds, []);
    });
  });
});
