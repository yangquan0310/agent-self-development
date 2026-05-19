/**
 * TaskObject 测试 — v4.3.0
 *
 * 覆盖 TaskObject 的 create/get/update/advance/archive/diagnose/validate/getFiles。
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TaskObject } from '../src/objects/TaskObject.js';
import { createMockLogger, createMockLog, createMockState, createMockSkills } from './helper.js';

describe('TaskObject', () => {
  function setup() {
    const state = createMockState();
    const logger = createMockLogger();
    const log = createMockLog();
    const skills = createMockSkills({
      planning: '【Planning Skill】',
      monitoring: '【Monitoring Skill】',
      regulation: '【Regulation Skill】',
      development: '【Development Skill】'
    });
    const taskObject = new TaskObject({ state, logger, log, skills });
    return { state, logger, log, taskObject };
  }

  // ── create ──

  describe('create', () => {
    it('创建 task 成功', async () => {
      const { taskObject } = setup();
      const result = await taskObject.create({ runId: 'test-001', prompt: '编写一个 API' });
      assert.ok(result.task);
      assert.strictEqual(result.task.runId, 'test-001');
      assert.strictEqual(result.task.status, 'draft');
      assert.ok(result.task.plan.execution.phases.length > 0);
    });

    it('runId 缺失返回校验错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.create({ prompt: 'test' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('runId')));
    });

    it('prompt 缺失返回校验错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.create({ runId: 'test-001' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('prompt')));
    });

    it('重复 runId 返回错误', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'first' });
      const result = await taskObject.create({ runId: 'test-001', prompt: 'second' });
      assert.ok(result.error);
      assert.ok(result.error.includes('已存在'));
    });

    it('planInput 自定义阶段', async () => {
      const { taskObject } = setup();
      const result = await taskObject.create({
        runId: 'test-002',
        prompt: 'test',
        planInput: {
          goal: '目标',
          phases: [
            { id: 'p1', name: '阶段1', goal: 'g1' },
            { id: 'p2', name: '阶段2', goal: 'g2' }
          ]
        }
      });
      assert.strictEqual(result.task.plan.execution.phases.length, 2);
      assert.strictEqual(result.task.plan.execution.phases[0].id, 'p1');
    });

    it('taskType 被正确设置', async () => {
      const { taskObject } = setup();
      const result = await taskObject.create({
        runId: 'test-003', prompt: 'test', taskType: 'coding'
      });
      assert.strictEqual(result.task.taskType, 'coding');
    });

    it('无效 taskType 被忽略', async () => {
      const { taskObject } = setup();
      const result = await taskObject.create({
        runId: 'test-004', prompt: 'test', taskType: 'invalid'
      });
      assert.strictEqual(result.task.taskType, undefined);
    });
  });

  // ── get ──

  describe('get', () => {
    it('获取存在的 task', async () => {
      const { taskObject, state } = setup();
      await state.saveTask('test-001', { runId: 'test-001', status: 'draft' });
      const result = await taskObject.get('test-001');
      assert.ok(result.task);
      assert.strictEqual(result.task.runId, 'test-001');
    });

    it('获取不存在的 task 返回 null', async () => {
      const { taskObject } = setup();
      const result = await taskObject.get('nonexistent');
      assert.strictEqual(result.task, null);
    });

    it('runId 缺失返回错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.get();
      assert.ok(result.error);
    });
  });

  // ── getFiles ──

  describe('getFiles', () => {
    it('无项目级文件索引返回空数组', async () => {
      const { taskObject } = setup();
      const result = await taskObject.getFiles('test-001');
      assert.deepStrictEqual(result.files, []);
      assert.strictEqual(result.count, 0);
      assert.ok(result.note);
    });

    it('runId 缺失返回错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.getFiles();
      assert.ok(result.error);
    });
  });

  // ── update ──

  describe('update', () => {
    it('更新状态成功', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.update({ runId: 'test-001', status: 'pending_approval' });
      assert.strictEqual(result.task.status, 'pending_approval');
      assert.strictEqual(result.previousStatus, 'draft');
    });

    it('状态机拒绝非法转换', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      await taskObject.update({ runId: 'test-001', status: 'completed' });
      const result = await taskObject.update({ runId: 'test-001', status: 'active' });
      assert.ok(result.error);
      assert.ok(result.error.includes('不允许'));
    });

    it('无效状态返回错误', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.update({ runId: 'test-001', status: 'invalid' });
      assert.ok(result.error);
      assert.ok(result.error.includes('无效状态'));
    });

    it('不存在的 task 返回错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.update({ runId: 'nonexistent', status: 'active' });
      assert.ok(result.error);
      assert.ok(result.error.includes('不存在'));
    });

    it('reason 被记录到 revisionReason', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.update({ runId: 'test-001', status: 'pending_approval', reason: '需求变更' });
      assert.strictEqual(result.task.revisionReason, '需求变更');
    });
  });

  // ── advance ──

  describe('advance', () => {
    it('推进到下一阶段', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.advance({ runId: 'test-001' });
      assert.strictEqual(result.previousPhase, 0);
      assert.strictEqual(result.nextPhase, 1);
      assert.strictEqual(result.isComplete, false);
    });

    it('推进完成所有阶段后状态变为 completed', async () => {
      const { taskObject } = setup();
      await taskObject.create({
        runId: 'test-001',
        prompt: 'test',
        planInput: { phases: [{ id: 'p1', name: '唯一阶段' }] }
      });
      const result = await taskObject.advance({ runId: 'test-001' });
      assert.strictEqual(result.isComplete, true);
      assert.strictEqual(result.task.status, 'completed');
    });

    it('指定 phaseId 推进', async () => {
      const { taskObject } = setup();
      await taskObject.create({
        runId: 'test-001',
        prompt: 'test',
        planInput: {
          phases: [
            { id: 'p1', name: '阶段1' },
            { id: 'p2', name: '阶段2' },
            { id: 'p3', name: '阶段3' }
          ]
        }
      });
      const result = await taskObject.advance({ runId: 'test-001', phaseId: 'p2' });
      assert.strictEqual(result.nextPhase, 1);
      assert.strictEqual(result.task.plan.execution.phases[0].status, 'completed');
      assert.strictEqual(result.task.plan.execution.phases[1].status, 'completed');
    });

    it('不存在的 phaseId 返回错误', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.advance({ runId: 'test-001', phaseId: 'p99' });
      assert.ok(result.error);
    });

    it('不存在的 task 返回错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.advance({ runId: 'nonexistent' });
      assert.ok(result.error);
    });
  });

  // ── archive ──

  describe('archive', () => {
    it('归档 completed task 成功', async () => {
      const { taskObject, state } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      await taskObject.update({ runId: 'test-001', status: 'completed' });
      const result = await taskObject.archive('test-001');
      assert.strictEqual(result.archived, true);
      assert.ok(result.archivedAt);
      const task = await state.getTask('test-001');
      assert.strictEqual(task, null);
    });

    it('非 completed 状态拒绝归档', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.archive('test-001');
      assert.ok(result.error);
      assert.ok(result.error.includes('completed'));
    });

    it('不存在的 task 返回错误', async () => {
      const { taskObject } = setup();
      const result = await taskObject.archive('nonexistent');
      assert.ok(result.error);
    });
  });

  // ── diagnose ──

  describe('diagnose', () => {
    it('任务级诊断', async () => {
      const { taskObject } = setup();
      await taskObject.create({ runId: 'test-001', prompt: 'test' });
      const result = await taskObject.diagnose('test-001');
      assert.ok(result.diagnosis);
      assert.strictEqual(result.diagnosis.plugin, 'agent-self-development');
      assert.strictEqual(result.diagnosis.version, '4.3.0');
      assert.strictEqual(result.diagnosis.mode, 'task');
      assert.strictEqual(result.diagnosis.taskStatus, 'draft');
    });

    it('全局诊断', async () => {
      const { taskObject } = setup();
      const result = await taskObject.diagnose();
      assert.ok(result.diagnosis);
      assert.strictEqual(result.diagnosis.mode, 'global');
    });

    it('不存在的任务返回 none', async () => {
      const { taskObject } = setup();
      const result = await taskObject.diagnose('nonexistent');
      assert.strictEqual(result.diagnosis.taskStatus, 'none');
    });
  });

  // ── validate ──

  describe('validate', () => {
    it('有效 task 返回 valid', () => {
      const { taskObject } = setup();
      const task = {
        runId: 'test-001',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        plan: {
          prompt: 'test',
          context: { goal: '', constraints: [], successCriteria: [] },
          workspace: { artifacts: [], tools: [], skills: [] },
          execution: {
            phases: [{ id: 'p1', name: '阶段1', goal: '', outputs: [], status: 'pending' }],
            currentPhase: 0
          }
        },
        deviations: [],
        attributions: []
      };
      const result = taskObject.validate(task);
      assert.strictEqual(result.valid, true);
    });

    it('缺少 runId 返回错误', () => {
      const { taskObject } = setup();
      const result = taskObject.validate({ status: 'draft' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('runId')));
    });

    it('无效 status 返回错误', () => {
      const { taskObject } = setup();
      const result = taskObject.validate({ runId: 'test', status: 'invalid', createdAt: 1, updatedAt: 1, plan: { prompt: '', context: {}, workspace: {}, execution: { phases: [{ id: 'p1', name: 'n', status: 'pending' }], currentPhase: 0 } }, deviations: [], attributions: [] });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('status')));
    });

    it('空 phases 返回错误', () => {
      const { taskObject } = setup();
      const result = taskObject.validate({ runId: 'test', status: 'draft', createdAt: 1, updatedAt: 1, plan: { prompt: '', context: {}, workspace: {}, execution: { phases: [], currentPhase: 0 } }, deviations: [], attributions: [] });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('phases')));
    });
  });
});
