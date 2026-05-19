/**
 * Handlers Test — v4.3.0 M1 基础验证
 *
 * 覆盖 6 个 objects 层 Handler 的核心流程。
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  create,
  update,
  advance,
  get,
  archive
} from '../src/objects/task.js';
import {
  report
} from '../src/objects/event.js';

describe('handlers', () => {
  const tmpDir = join(tmpdir(), 'asd-test-' + Date.now());
  const origCwd = process.cwd();

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function ctx() {
    return { baseDir: process.cwd() };
  }

  describe('create', () => {
    it('should create a draft task with auto runId', async () => {
      const result = await create({ prompt: 'Write a test' }, ctx());
      assert.ok(!result.error);
      assert.ok(result.runId);
      assert.strictEqual(result.status, 'draft');
      assert.ok(result.createdAt);
    });

    it('should create a task with explicit runId', async () => {
      const result = await create({ runId: 'abc-123', prompt: 'Test' }, ctx());
      assert.ok(!result.error);
      assert.strictEqual(result.runId, 'abc-123');
    });

    it('should reject duplicate runId', async () => {
      await create({ runId: 'dup', prompt: 'First' }, ctx());
      const result = await create({ runId: 'dup', prompt: 'Second' }, ctx());
      assert.ok(result.error);
      assert.ok(result.error.includes('已存在'));
    });

    it('should infer coding plan', async () => {
      const result = await create({ prompt: '实现一个代码功能' }, ctx());
      const task = await get({ runId: result.runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.plan.execution.phases[0].name, '需求分析');
    });

    it('should accept custom planInput', async () => {
      const result = await create({
        prompt: 'Custom',
        planInput: {
          goal: 'G1',
          phases: [{ id: 'x1', name: 'Phase X' }]
        }
      }, ctx());
      const task = await get({ runId: result.runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.plan.context.goal, 'G1');
      assert.strictEqual(task.plan.execution.phases[0].id, 'x1');
    });
  });

  describe('update', () => {
    it('should update status', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const r = await update({ runId, status: 'pending_approval' }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.status, 'pending_approval');
      assert.strictEqual(r.changed, true);
    });

    it('should reject invalid status transition', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const r = await update({ runId, status: 'completed' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('无效状态转换'));
    });

    it('should append deviation', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, deviation: { type: 'scope_creep', description: 'Scope grew' } }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.deviations.length, 1);
      assert.strictEqual(task.deviations[0].type, 'scope_creep');
    });

    it('should append attribution', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, attribution: { rootCause: 'R1', strategy: 'S1' } }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.attributions.length, 1);
    });

    it('should update outcome', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, outcome: { summary: 'Done' } }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.outcome.summary, 'Done');
    });

    it('should return changed=false when no update', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const r = await update({ runId }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.changed, false);
    });
  });

  describe('advance', () => {
    it('should advance to next phase', async () => {
      const { runId } = await create({ prompt: '实现代码' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      const r = await advance({ runId }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.currentPhase, 1);
    });

    it('should advance to specific phaseId', async () => {
      const { runId } = await create({ prompt: '实现代码' }, ctx());
      const r = await advance({ runId, phaseId: 'p3' }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.phaseId, 'p3');
    });

    it('should reject non-existent phaseId', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const r = await advance({ runId, phaseId: 'xyz' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('阶段不存在'));
    });
  });

  describe('get', () => {
    it('should return full task object', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.runId, runId);
      assert.ok(task.plan);
    });

    it('should reject missing task', async () => {
      const r = await get({ runId: 'non-existent' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('不存在'));
    });
  });

  describe('archive', () => {
    it('should archive completed task and move file', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      const originalPath = join('.agent', 'tasks', `${runId}.json`);
      const r = await archive({ runId }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.status, 'archived');
      assert.ok(r.archivedAt);
      assert.ok(r.archivePath);
      assert.ok(r.archivePath.includes('archive'));
      assert.strictEqual(existsSync(join(tmpDir, originalPath)), false);
      assert.ok(existsSync(r.archivePath));
    });

    it('should reject archiving non-completed', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const r = await archive({ runId }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('只能归档 completed'));
    });
  });

  describe('report', () => {
    it('should generate event.md from task', async () => {
      const { runId } = await create({ prompt: '测试报告' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, deviation: { type: 'x', description: 'desc' } }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      const r = await report({ runId }, ctx());
      assert.ok(!r.error);
      assert.ok(r.eventFilePath);
      assert.ok(existsSync(r.eventFilePath));
    });

    it('preserves existing eventFilePath in task', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      const r1 = await report({ runId }, ctx());
      const r2 = await report({ runId }, ctx());
      assert.strictEqual(r1.eventFilePath, r2.eventFilePath);
    });
  });
});
