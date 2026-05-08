import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Metacognition } from '../src/metacognition/module.js';
import {
  createMockApi, createMockCtx, createMockLogger,
  createMockLog, createMockState, createMockSkills
} from './helper.js';

describe('Metacognition', () => {
  async function createMeta(skillMap = {}, stateData = {}) {
    const api = createMockApi();
    const state = createMockState();
    for (const [k, v] of Object.entries(stateData)) {
      await state.saveTask(k, v);
    }
    const skills = createMockSkills({
      planning: '【Planning Skill 内容】',
      monitoring: '【Monitoring Skill 内容】',
      ...skillMap
    });
    const meta = new Metacognition({
      api, config: {}, state, skills,
      logger: createMockLogger(), log: createMockLog()
    });
    meta.register();
    return { api, state, meta };
  }

  describe('before_prompt_build', () => {
    it('无 task 时注入 planning skill（首次）', async () => {
      const { api } = await createMeta();
      const ctx = createMockCtx();
      const [result] = await api._emit('before_prompt_build', { prompt: 'test prompt' }, ctx);
      assert.ok(result);
      assert.ok(result.prependSystemContext.includes('Planning Skill'));
      assert.ok(result.prependSystemContext.includes('尚无 task'));
    });

    it('无 task 时保存 prompt 到 ctx.state', async () => {
      const { api } = await createMeta();
      const ctx = createMockCtx();
      await api._emit('before_prompt_build', { prompt: 'hello world' }, ctx);
      assert.strictEqual(ctx.state['prompt:test-run'], 'hello world');
    });

    it('task=draft 时注入 planning skill（制定阶段）', async () => {
      const { api } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'draft',
          plan: { execution: { phases: [] }, workspace: { tools: [] } }
        }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
      assert.ok(result);
      assert.ok(result.prependSystemContext.includes('draft'));
    });

    it('task=active 时注入 monitoring skill + 执行上下文', async () => {
      const { api } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'active',
          plan: {
            execution: { phases: [{ id: 'p1', sessionId: 's1' }], currentPhase: 0 },
            workspace: { artifacts: [] }
          }
        }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
      assert.ok(result);
      assert.ok(result.prependSystemContext.includes('Monitoring Skill'));
      assert.ok(result.prependSystemContext.includes('active'));
    });

    it('task=revising 时注入 planning skill + 修订上下文', async () => {
      const { api } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'revising',
          revisionReason: '用户要求拆分阶段',
          plan: { execution: { phases: [] }, workspace: { tools: [] } }
        }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
      assert.ok(result);
      assert.ok(result.prependSystemContext.includes('Plan 修订'));
    });

    it('task=pending_approval 时注入 planning skill', async () => {
      const { api } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'pending_approval',
          plan: { execution: { phases: [] }, workspace: { tools: [] } }
        }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
      assert.ok(result);
      assert.ok(result.prependSystemContext.includes('pending_approval'));
    });
  });

  describe('before_agent_finalize', () => {
    it('解析 [STATUS: active] 标记并更新 task', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': { runId: 'test-run', status: 'pending_approval', plan: {} }
      });
      const [result] = await api._emit('before_agent_finalize',
        { output: '计划已制定完成。[STATUS: active]' }, createMockCtx());
      const task = await state.getTask('test-run');
      assert.strictEqual(task.status, 'active');
    });

    it('解析 [STATUS: revising] [REASON: xxx] 并记录原因', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': { runId: 'test-run', status: 'active', plan: {} }
      });
      await api._emit('before_agent_finalize',
        { output: '[STATUS: revising] [REASON: 需要拆分阶段]' }, createMockCtx());
      const task = await state.getTask('test-run');
      assert.strictEqual(task.status, 'revising');
      assert.strictEqual(task.revisionReason, '需要拆分阶段');
    });

    it('检测 [NEED_PLAN] 创建 draft task 并返回 revise', async () => {
      const { api, state } = await createMeta();
      const ctx = createMockCtx();
      ctx.state['prompt:test-run'] = '帮我设计一个系统';
      const [result] = await api._emit('before_agent_finalize',
        { output: '这个任务比较复杂，需要制定 Plan。[NEED_PLAN]' }, ctx);
      assert.ok(result);
      assert.strictEqual(result.action, 'revise');
      assert.ok(result.retry);
      const task = await state.getTask('test-run');
      assert.ok(task);
      assert.strictEqual(task.status, 'draft');
    });

    it('检测 TODO 标记返回 revise', async () => {
      const { api } = await createMeta();
      const [result] = await api._emit('before_agent_finalize',
        { output: 'TODO: 还需要完成接口设计' }, createMockCtx());
      assert.ok(result);
      assert.strictEqual(result.action, 'revise');
    });

    it('正常输出返回 finalize', async () => {
      const { api } = await createMeta();
      const [result] = await api._emit('before_agent_finalize',
        { output: '任务已完成。' }, createMockCtx());
      assert.ok(result);
      assert.strictEqual(result.action, 'finalize');
    });
  });

  describe('llm_output', () => {
    it('纯观察：保存 output 到 task.plan.output', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': { runId: 'test-run', status: 'active', plan: {} }
      });
      await api._emit('llm_output', { output: '这是模型输出' }, createMockCtx());
      const task = await state.getTask('test-run');
      assert.strictEqual(task.plan.output, '这是模型输出');
    });

    it('纯观察：不返回任何值', async () => {
      const { api } = await createMeta({}, {
        'test-run': { runId: 'test-run', status: 'active', plan: {} }
      });
      const [result] = await api._emit('llm_output', { output: 'test' }, createMockCtx());
      assert.strictEqual(result, undefined);
    });
  });
});
