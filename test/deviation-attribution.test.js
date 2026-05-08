import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Deviation } from '../src/metacognition/deviation.js';
import { Attribution } from '../src/metacognition/attribution.js';
import { createMockState } from './helper.js';

describe('Deviation & Attribution', () => {
  describe('Deviation', () => {
    it('创建偏差记录到 task.deviations（顶层字段）', async () => {
      const state = createMockState();
      const dev = new Deviation(state);
      await state.saveTask('r1', { runId: 'r1', status: 'active', plan: {} });

      const result = await dev.createDeviation('r1', 'p1', {
        type: 'progress', description: '进度落后', severity: 'major'
      });

      assert.ok(result.deviationId);
      const task = await state.getTask('r1');
      assert.ok(Array.isArray(task.deviations));
      assert.strictEqual(task.deviations.length, 1);
      assert.strictEqual(task.deviations[0].type, 'progress');
      assert.strictEqual(task.deviations[0].status, 'detected');
      assert.strictEqual(task.deviations[0].severity, 'major');
      assert.strictEqual(task.deviations[0].description, '进度落后');
    });

    it('确认偏差更新状态', async () => {
      const state = createMockState();
      const dev = new Deviation(state);
      await state.saveTask('r1', { runId: 'r1', status: 'active', plan: {}, deviations: [] });
      const d = await dev.createDeviation('r1', 'p1', { type: 'quality' });

      const result = await dev.acknowledgeDeviation('r1', d.deviationId, '已确认');
      assert.ok(result);
      assert.strictEqual(result.status, 'acknowledged');
    });

    it('task.event 不再存在', async () => {
      const state = createMockState();
      const dev = new Deviation(state);
      await state.saveTask('r1', { runId: 'r1', status: 'active', plan: {} });
      await dev.createDeviation('r1', 'p1', { type: 'resource' });
      const task = await state.getTask('r1');
      assert.strictEqual(task.event, undefined);
    });
  });

  describe('Attribution', () => {
    it('创建归因记录到 task.attributions（顶层字段）', async () => {
      const state = createMockState();
      const attr = new Attribution(state, null);
      await state.saveTask('r1', { runId: 'r1', status: 'active', plan: {} });

      const result = await attr.analyzeAttribution('r1', 'dev-1', {
        rootCause: '计划不合理'
      });

      assert.ok(result.attributionId);
      const task = await state.getTask('r1');
      assert.ok(Array.isArray(task.attributions));
      assert.strictEqual(task.attributions.length, 1);
      assert.strictEqual(task.attributions[0].status, 'analyzing');
    });

    it('完成归因分析', async () => {
      const state = createMockState();
      const attr = new Attribution(state, null);
      await state.saveTask('r1', { runId: 'r1', status: 'active', plan: {}, attributions: [] });
      const a = await attr.analyzeAttribution('r1', 'dev-1', {});

      const result = await attr.completeAttribution('r1', a.attributionId, '根因', { strategy: '调整计划' });
      assert.ok(result);
      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.rootCause, '根因');
    });
  });
});
