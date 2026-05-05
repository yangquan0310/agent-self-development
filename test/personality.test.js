import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Personality } from '../src/personality/module.js';
import {
  createMockApi, createMockCtx, createMockLogger,
  createMockLog, createMockState, createMockSkills
} from './helper.js';

describe('Personality', () => {
  function createPersonality(skillMap = {}, stateData = {}) {
    const api = createMockApi();
    const state = createMockState();
    for (const [k, v] of Object.entries(stateData)) state.saveTask(k, v);
    const skills = createMockSkills({
      development: '【Development Skill 内容】',
      ...skillMap
    });
    const p = new Personality({
      api, config: {}, state, skills,
      logger: createMockLogger(), log: createMockLog()
    });
    p.register();
    return { api, state, p };
  }

  describe('before_prompt_build', () => {
    it('task.status=completed 时注入 development skill', async () => {
      const { api } = createPersonality({}, {
        'r1': {
          runId: 'r1', status: 'completed',
          deviations: [{ deviationId: 'd1' }],
          attributions: [{ attributionId: 'a1' }],
          outcome: {}
        }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx('r1'));
      assert.ok(result);
      assert.ok(result.prependSystemContext.includes('Development Skill'));
      assert.ok(result.prependSystemContext.includes('偏差记录：1 条'));
    });

    it('task.status=active 时不注入', async () => {
      const { api } = createPersonality({}, {
        'r1': { runId: 'r1', status: 'active', plan: {} }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx('r1'));
      assert.strictEqual(result, undefined);
    });

    it('无 task 时不注入', async () => {
      const { api } = createPersonality();
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx('r1'));
      assert.strictEqual(result, undefined);
    });
  });

  describe('agent_end', () => {
    it('纯观察：记录日志，不返回注入', async () => {
      const { api } = createPersonality({}, {
        'r1': { runId: 'r1', status: 'completed', deviations: [], attributions: [] }
      });
      const [result] = await api._emit('agent_end', {}, createMockCtx('r1'));
      assert.strictEqual(result, undefined);
    });

    it('无 task 时跳过', async () => {
      const { api } = createPersonality();
      const [result] = await api._emit('agent_end', {}, createMockCtx('r1'));
      assert.strictEqual(result, undefined);
    });
  });
});
