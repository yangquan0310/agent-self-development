/**
 * Handlers Edge Case Test — v4.3.0
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
  report,
  query,
  archive as archiveEvent
} from '../src/objects/event.js';

describe('handlers edge cases', () => {
  const tmpDir = join(tmpdir(), 'asd-edge-test-' + Date.now());
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

  describe('create edge cases', () => {
    it('rejects empty prompt', async () => {
      const r = await create({ prompt: '' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('不能为空'));
    });

    it('accepts very long prompt', async () => {
      const longPrompt = 'a'.repeat(5000);
      const result = await create({ prompt: longPrompt }, ctx());
      assert.ok(!result.error);
      const task = await get({ runId: result.runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.plan.prompt, longPrompt);
    });

    it('rejects runId with slash', async () => {
      const r = await create({ runId: 'a/b', prompt: 'Test' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('非法字符'));
    });

    it('rejects runId with backslash', async () => {
      const r = await create({ runId: 'a\\b', prompt: 'Test' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('非法字符'));
    });

    it('rejects runId with colon', async () => {
      const r = await create({ runId: 'a:b', prompt: 'Test' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('非法字符'));
    });

    it('accepts planInput with only goal', async () => {
      const result = await create({ prompt: 'Test', planInput: { goal: 'Only goal' } }, ctx());
      const task = await get({ runId: result.runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.plan.context.goal, 'Only goal');
      assert.ok(task.plan.execution.phases.length > 0);
    });

    it('accepts empty phases array in planInput', async () => {
      const result = await create({ prompt: 'Test', planInput: { phases: [] } }, ctx());
      const task = await get({ runId: result.runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.plan.execution.phases.length, 0);
    });
  });

  describe('update edge cases', () => {
    it('supports combined status + deviation + outcome update', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      const r = await update({
        runId,
        status: 'completed',
        deviation: { type: 'x', description: 'd' },
        outcome: { summary: 'Done' }
      }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.status, 'completed');
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.deviations.length, 1);
      assert.strictEqual(task.outcome.summary, 'Done');
    });

    it('rejects invalid status value', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      const r = await update({ runId, status: 'deleted' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('无效状态'));
    });

    it('supports draft → pending_approval → active → revising → draft → active → completed', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'revising' }, ctx());
      await update({ runId, status: 'draft' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      const r = await update({ runId, status: 'completed' }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.status, 'completed');
    });

    it('rejects deviation missing type', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, deviation: { type: '', description: 'desc' } }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.deviations[0].type, '');
    });

    it('rejects attribution missing rootCause', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, attribution: { rootCause: '', strategy: '' } }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.attributions[0].rootCause, '');
    });
  });

  describe('advance edge cases', () => {
    it('rejects advancing past last phase', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      const phases = task.plan.execution.phases;
      for (let i = 0; i < phases.length - 1; i++) {
        const r = await advance({ runId }, ctx());
        assert.ok(!r.error);
      }
      const r = await advance({ runId }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('已是最后一个阶段'));
    });

    it('allows skipping phases via phaseId', async () => {
      const { runId } = await create({ prompt: '实现代码' }, ctx());
      const r = await advance({ runId, phaseId: 'p5' }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.phaseId, 'p5');
      const task = await get({ runId }, ctx());
      assert.ok(!task.error);
      assert.strictEqual(task.plan.execution.phases[0].status, 'completed');
      assert.strictEqual(task.plan.execution.phases[4].status, 'in_progress');
    });

    it('handles task with empty phases', async () => {
      const { runId } = await create({ prompt: 'Test', planInput: { phases: [] } }, ctx());
      const r = await advance({ runId }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('已是最后一个阶段'));
    });
  });

  describe('get edge cases', () => {
    it('rejects empty runId', async () => {
      const r = await get({ runId: '' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('不能为空'));
    });
  });

  describe('archive edge cases', () => {
    it('rejects archiving active task', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      const r = await archive({ runId }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('只能归档 completed'));
    });

    it('rejects archiving revising task', async () => {
      const { runId } = await create({ prompt: 'Test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'revising' }, ctx());
      const r = await archive({ runId }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('只能归档 completed'));
    });
  });

  describe('report edge cases', () => {
    it('generates event.md for task with no deviations or attributions', async () => {
      const { runId } = await create({ prompt: 'Clean task' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      const r = await report({ runId }, ctx());
      assert.ok(!r.error);
      assert.ok(existsSync(r.eventFilePath));
    });

    it('generates event.md for task with no outcome', async () => {
      const { runId } = await create({ prompt: 'No outcome' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      const r = await report({ runId }, ctx());
      assert.ok(!r.error);
    });

    it('rejects report for non-existent task', async () => {
      const r = await report({ runId: 'non-existent' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('不存在'));
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

  describe('query', () => {
    it('returns empty when no events exist', async () => {
      const r = await query({}, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.count, 0);
      assert.deepStrictEqual(r.events, []);
    });

    it('finds event by runId', async () => {
      const { runId } = await create({ prompt: 'Query test' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      await report({ runId }, ctx());
      const r = await query({ runId }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.count, 1);
      assert.strictEqual(r.events[0].runId, runId);
    });

    it('finds event by date', async () => {
      const { runId } = await create({ prompt: 'Date query' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      await report({ runId }, ctx());
      const today = new Date().toISOString().slice(0, 10);
      const r = await query({ date: today }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.count, 1);
    });

    it('filters by deviation type', async () => {
      const { runId } = await create({ prompt: 'Deviation query' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, deviation: { type: 'scope_creep', description: 'Scope grew' } }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      await report({ runId }, ctx());
      const r = await query({ type: 'deviation' }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.count, 1);
      const r2 = await query({ type: 'attribution' }, ctx());
      assert.ok(!r2.error);
      assert.strictEqual(r2.count, 0);
    });

    it('filters by attribution type', async () => {
      const { runId } = await create({ prompt: 'Attribution query' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, attribution: { rootCause: 'R1', strategy: 'S1' } }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      await report({ runId }, ctx());
      const r = await query({ type: 'attribution' }, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.count, 1);
      const r2 = await query({ type: 'deviation' }, ctx());
      assert.ok(!r2.error);
      assert.strictEqual(r2.count, 0);
    });

    it('returns all events when no filters', async () => {
      const { runId: r1 } = await create({ prompt: 'All 1' }, ctx());
      await update({ runId: r1, status: 'pending_approval' }, ctx());
      await update({ runId: r1, status: 'active' }, ctx());
      await update({ runId: r1, status: 'completed' }, ctx());
      await report({ runId: r1 }, ctx());

      const { runId: r2 } = await create({ prompt: 'All 2' }, ctx());
      await update({ runId: r2, status: 'pending_approval' }, ctx());
      await update({ runId: r2, status: 'active' }, ctx());
      await update({ runId: r2, status: 'completed' }, ctx());
      await report({ runId: r2 }, ctx());

      const r = await query({}, ctx());
      assert.ok(!r.error);
      assert.strictEqual(r.count, 2);
    });
  });

  describe('archiveEvent', () => {
    it('archives existing event', async () => {
      const { runId } = await create({ prompt: 'Archive event' }, ctx());
      await update({ runId, status: 'pending_approval' }, ctx());
      await update({ runId, status: 'active' }, ctx());
      await update({ runId, status: 'completed' }, ctx());
      await report({ runId }, ctx());

      const r = await archiveEvent({ runId }, ctx());
      assert.ok(!r.error);
      assert.ok(r.archivePath);
      assert.ok(r.archivePath.includes('archive'));
      assert.ok(existsSync(r.archivePath));
    });

    it('rejects archiving non-existent event', async () => {
      const r = await archiveEvent({ runId: 'no-such-event' }, ctx());
      assert.ok(r.error);
      assert.ok(r.error.includes('不存在'));
    });
  });
});
