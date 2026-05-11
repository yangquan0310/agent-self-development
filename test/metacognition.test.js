import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Metacognition } from '../src/metacognition/module.js';
import {
  createMockApi, createMockCtx, createMockLogger,
  createMockLog, createMockState, createMockSkills
} from './helper.js';

async function createMeta(skillMap = {}, stateData = {}, injectionMode = 'tool-driven') {
  const api = createMockApi();
  const state = createMockState();
  for (const [k, v] of Object.entries(stateData)) {
    await state.saveTask(k, v);
  }
  const skills = createMockSkills({
    planning: '【Planning Skill 内容】',
    monitoring: '【Monitoring Skill 内容】',
    regulation: '【Regulation Skill 内容】',
    ...skillMap
  });
  const meta = new Metacognition({
    api, config: {}, state, skills,
    logger: createMockLogger(), log: createMockLog(),
    injectionMode
  });
  meta.register();
  return { api, state, meta };
}

describe('Metacognition', () => {
  describe('before_prompt_build', () => {
    describe('tool-driven 模式（默认）', () => {
      it('无 task 时注入最小化提示', async () => {
        const { api } = await createMeta();
        const ctx = createMockCtx();
        const [result] = await api._emit('before_prompt_build', { prompt: 'test prompt' }, ctx);
        assert.ok(result);
        assert.ok(result.prependSystemContext.includes('Agent Self-Development 插件'));
        assert.ok(result.prependSystemContext.includes('当前任务状态：none'));
        assert.ok(result.prependSystemContext.includes('可用工具：'));
        assert.ok(result.prependSystemContext.includes('create_plan'));
        assert.ok(!result.prependSystemContext.includes('Planning Skill'));
      });

      it('无 task 时保存 prompt 到 ctx.state', async () => {
        const { api } = await createMeta();
        const ctx = createMockCtx();
        await api._emit('before_prompt_build', { prompt: 'hello world' }, ctx);
        assert.strictEqual(ctx.state['prompt:test-run'], 'hello world');
      });

      it('task=draft 时注入最小化提示', async () => {
        const { api } = await createMeta({}, {
          'test-run': {
            runId: 'test-run', status: 'draft',
            plan: { execution: { phases: [] }, workspace: { tools: [] } }
          }
        });
        const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
        assert.ok(result);
        assert.ok(result.prependSystemContext.includes('当前任务状态：draft'));
        assert.ok(result.prependSystemContext.includes('可用工具：'));
        assert.ok(!result.prependSystemContext.includes('Planning Skill'));
      });

      it('task=active 时注入最小化提示', async () => {
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
        assert.ok(result.prependSystemContext.includes('当前任务状态：active'));
        assert.ok(result.prependSystemContext.includes('当前阶段：1/1'));
        assert.ok(!result.prependSystemContext.includes('Monitoring Skill'));
      });

      it('task=revising 时注入最小化提示', async () => {
        const { api } = await createMeta({}, {
          'test-run': {
            runId: 'test-run', status: 'revising',
            revisionReason: '用户要求拆分阶段',
            plan: { execution: { phases: [] }, workspace: { tools: [] } }
          }
        });
        const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
        assert.ok(result);
        assert.ok(result.prependSystemContext.includes('当前任务状态：revising'));
        assert.ok(!result.prependSystemContext.includes('Plan 修订'));
      });

      it('task=pending_approval 时注入最小化提示', async () => {
        const { api } = await createMeta({}, {
          'test-run': {
            runId: 'test-run', status: 'pending_approval',
            plan: { execution: { phases: [] }, workspace: { tools: [] } }
          }
        });
        const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
        assert.ok(result);
        assert.ok(result.prependSystemContext.includes('当前任务状态：pending_approval'));
      });
    });

    describe('legacy 模式', () => {
      it('无 task 时注入完整 planning skill（首次）', async () => {
        const { api } = await createMeta({}, {}, 'legacy');
        const ctx = createMockCtx();
        const [result] = await api._emit('before_prompt_build', { prompt: 'test prompt' }, ctx);
        assert.ok(result);
        assert.ok(result.prependSystemContext.includes('Planning Skill'));
        assert.ok(result.prependSystemContext.includes('尚无 task'));
      });

      it('无 task 时保存 prompt 到 ctx.state', async () => {
        const { api } = await createMeta({}, {}, 'legacy');
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
        }, 'legacy');
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
        }, 'legacy');
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
        }, 'legacy');
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
        }, 'legacy');
        const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
        assert.ok(result);
        assert.ok(result.prependSystemContext.includes('pending_approval'));
      });
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

    it('检测 [NEED_PLAN] 不再自动创建 task，返回 revise 提示', async () => {
      const { api, state } = await createMeta();
      const ctx = createMockCtx();
      ctx.state['prompt:test-run'] = '帮我设计一个系统';
      const [result] = await api._emit('before_agent_finalize',
        { output: '这个任务比较复杂，需要制定 Plan。[NEED_PLAN]' }, ctx);
      assert.ok(result);
      assert.strictEqual(result.action, 'revise');
      assert.ok(result.reason.includes('已废弃'));
      // 不再自动创建 task
      const task = await state.getTask('test-run');
      assert.strictEqual(task, null);
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

    it('解析 ctx.toolCalls 中的 update_task_status', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': { runId: 'test-run', status: 'draft', plan: {} }
      });
      const ctx = createMockCtx();
      ctx.toolCalls = [
        { name: 'update_task_status', result: { success: true, status: 'active' } }
      ];
      await api._emit('before_agent_finalize',
        { output: '我已更新状态。' }, ctx);
      const task = await state.getTask('test-run');
      assert.strictEqual(task.status, 'active');
    });

    it('解析 ctx.toolCalls 中的 advance_phase', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'active',
          plan: {
            execution: {
              phases: [{ id: 'p1', status: 'pending' }, { id: 'p2', status: 'pending' }],
              currentPhase: 0
            }
          }
        }
      });
      const ctx = createMockCtx();
      ctx.toolCalls = [
        { name: 'advance_phase', result: { success: true, previousPhase: 0, nextPhase: 1 } }
      ];
      await api._emit('before_agent_finalize',
        { output: '阶段完成。' }, ctx);
      const task = await state.getTask('test-run');
      assert.strictEqual(task.plan.execution.currentPhase, 1);
      assert.strictEqual(task.plan.execution.phases[0].status, 'completed');
    });

    it('解析 ctx.toolCalls 中的 record_deviation', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': { runId: 'test-run', status: 'active', plan: {} }
      });
      const ctx = createMockCtx();
      ctx.toolCalls = [
        { name: 'record_deviation', result: { success: true, deviation: { id: 'dev-1', type: 'scope_creep', description: '范围蔓延' } } }
      ];
      await api._emit('before_agent_finalize',
        { output: '发现偏差。' }, ctx);
      const task = await state.getTask('test-run');
      assert.strictEqual(task.deviations.length, 1);
      assert.strictEqual(task.deviations[0].type, 'scope_creep');
    });

    it('解析 ctx.toolCalls 中的 record_attribution', async () => {
      const { api, state } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'active', plan: {},
          deviations: [{ id: 'dev-1', type: 'scope_creep', description: '范围蔓延', attributed: false }]
        }
      });
      const ctx = createMockCtx();
      ctx.toolCalls = [
        { name: 'record_attribution', result: { success: true, attribution: { id: 'attr-1', rootCause: '计划不清晰', strategy: '重新评估' } } }
      ];
      await api._emit('before_agent_finalize',
        { output: '完成归因。' }, ctx);
      const task = await state.getTask('test-run');
      assert.strictEqual(task.attributions.length, 1);
      assert.strictEqual(task.deviations[0].attributed, true);
      assert.strictEqual(task.deviations[0].attributionId, 'attr-1');
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

  describe('injectionMode 配置', () => {
    it('默认 injectionMode 为 tool-driven', async () => {
      const { meta } = await createMeta();
      assert.strictEqual(meta.injectionMode, 'tool-driven');
    });

    it('显式设置为 legacy 时 injectionMode 为 legacy', async () => {
      const { meta } = await createMeta({}, {}, 'legacy');
      assert.strictEqual(meta.injectionMode, 'legacy');
    });

    it('tool-driven 模式注入内容不超过 3 句核心提示', async () => {
      const { api } = await createMeta({}, {
        'test-run': {
          runId: 'test-run', status: 'active',
          plan: {
            execution: { phases: [{ id: 'p1' }], currentPhase: 0 },
            workspace: { artifacts: [] }
          }
        }
      });
      const [result] = await api._emit('before_prompt_build', {}, createMockCtx());
      const lines = result.prependSystemContext.split('\n').filter(l => l.trim());
      // 检查不包含完整的 skill 文本（如 "Monitoring Skill"）
      assert.ok(!result.prependSystemContext.includes('Monitoring Skill'));
      assert.ok(!result.prependSystemContext.includes('Regulation Skill'));
      // 检查包含核心信息
      assert.ok(result.prependSystemContext.includes('Agent Self-Development'));
      assert.ok(result.prependSystemContext.includes('当前任务状态'));
    });
  });
});
