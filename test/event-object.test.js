/**
 * EventObject 测试 — v4.3.0
 *
 * 覆盖 EventObject 的 createEvent/record/query/archive。
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { EventObject } from '../src/objects/EventObject.js';
import { createMockLogger } from './helper.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('EventObject', () => {
  let tmpDir;
  let eventObject;
  let logger;

  function setup() {
    tmpDir = mkdtempSync(join(tmpdir(), 'event-test-'));
    logger = createMockLogger();
    eventObject = new EventObject({
      logger,
      eventTemplate: '',
      projectRoot: tmpDir
    });
  }

  function teardown() {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  beforeEach(() => {
    teardown();
    setup();
  });

  const makeTask = (runId, createdAt = Date.now()) => ({
    runId,
    createdAt,
    status: 'draft',
    taskType: 'coding',
    plan: {
      prompt: 'test',
      context: { goal: 'goal', constraints: [], successCriteria: [] },
      execution: {
        phases: [{ id: 'p1', name: '阶段1', status: 'pending' }],
        currentPhase: 0
      }
    },
    deviations: [],
    attributions: []
  });

  // ── createEvent ──

  describe('createEvent', () => {
    it('创建事件文件成功', async () => {
      const task = makeTask('test-001');
      const result = await eventObject.createEvent({ runId: 'test-001', task });
      assert.ok(result.eventFilePath);
      assert.ok(result.eventFilePath.includes('.agent/events/'));
      const absPath = join(tmpDir, result.eventFilePath);
      assert.ok(existsSync(absPath));
      const content = readFileSync(absPath, 'utf-8');
      assert.ok(content.includes('test-001'));
    });

    it('缺少 runId 返回错误', async () => {
      const result = await eventObject.createEvent({ task: makeTask('test') });
      assert.ok(result.error);
    });

    it('缺少 task 返回错误', async () => {
      const result = await eventObject.createEvent({ runId: 'test-001' });
      assert.ok(result.error);
    });
  });

  // ── record ──

  describe('record', () => {
    it('记录偏差到已有事件文件', async () => {
      const task = makeTask('test-001');
      await eventObject.createEvent({ runId: 'test-001', task });
      const result = await eventObject.record({
        runId: 'test-001',
        recordType: 'deviation',
        data: { type: 'scope_creep', description: '需求增加', impact: '延期1天' },
        task
      });
      assert.strictEqual(result.recorded, true);
      assert.ok(result.eventFilePath);
    });

    it('记录归因到已有事件文件', async () => {
      const task = makeTask('test-001');
      await eventObject.createEvent({ runId: 'test-001', task });
      const result = await eventObject.record({
        runId: 'test-001',
        recordType: 'attribution',
        data: { rootCause: '需求评审不充分', strategy: '增加评审环节', impact: '返工' },
        task
      });
      assert.strictEqual(result.recorded, true);
    });

    it('无事件文件时自动创建（提供 task）', async () => {
      const task = makeTask('test-001');
      const result = await eventObject.record({
        runId: 'test-001',
        recordType: 'deviation',
        data: { type: 'bug', description: '发现缺陷' },
        task
      });
      assert.strictEqual(result.recorded, true);
    });

    it('无事件文件且无 task 返回错误', async () => {
      const result = await eventObject.record({
        runId: 'test-001',
        recordType: 'deviation',
        data: { type: 'bug', description: '发现缺陷' }
      });
      assert.ok(result.error);
    });

    it('无效 recordType 返回错误', async () => {
      const result = await eventObject.record({
        runId: 'test-001',
        recordType: 'invalid',
        data: {}
      });
      assert.ok(result.error);
    });
  });

  // ── query ──

  describe('query', () => {
    it('查询全部返回偏差和归因', async () => {
      const task = makeTask('test-001');
      await eventObject.record({
        runId: 'test-001', recordType: 'deviation',
        data: { type: 't1', description: 'd1' }, task
      });
      await eventObject.record({
        runId: 'test-001', recordType: 'attribution',
        data: { rootCause: 'r1', strategy: 's1' }, task
      });

      const result = await eventObject.query();
      assert.strictEqual(result.count, 2);
      assert.ok(result.events.some(e => e.type === 'deviation'));
      assert.ok(result.events.some(e => e.type === 'attribution'));
    });

    it('按 runId 过滤', async () => {
      const task1 = makeTask('test-001', Date.now() - 2000);
      const task2 = makeTask('test-002', Date.now());
      await eventObject.record({ runId: 'test-001', recordType: 'deviation', data: { type: 't1', description: 'd1' }, task: task1 });
      await eventObject.record({ runId: 'test-002', recordType: 'deviation', data: { type: 't2', description: 'd2' }, task: task2 });

      const result = await eventObject.query({ runId: 'test-001' });
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.events[0].runId, 'test-001');
    });

    it('按 type 过滤', async () => {
      const task = makeTask('test-001');
      await eventObject.record({ runId: 'test-001', recordType: 'deviation', data: { type: 't1', description: 'd1' }, task });
      await eventObject.record({ runId: 'test-001', recordType: 'attribution', data: { rootCause: 'r1', strategy: 's1' }, task });

      const result = await eventObject.query({ type: 'deviation' });
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.events[0].type, 'deviation');
    });

    it('空查询返回空数组', async () => {
      const result = await eventObject.query();
      // 无事件文件时返回空
      assert.strictEqual(result.count, 0);
    });
  });

  // ── archive ──

  describe('archive', () => {
    it('归档指定 runId 的事件文件', async () => {
      const task = makeTask('test-001');
      await eventObject.createEvent({ runId: 'test-001', task });
      const result = await eventObject.archive('test-001');
      assert.strictEqual(result.archived, true);
      assert.strictEqual(result.archivedCount, 1);
    });

    it('归档不存在的 runId', async () => {
      const result = await eventObject.archive('nonexistent');
      assert.strictEqual(result.archived, false);
      assert.strictEqual(result.archivedCount, 0);
    });

    it('runId 缺失返回错误', async () => {
      const result = await eventObject.archive();
      assert.ok(result.error);
    });
  });
});
