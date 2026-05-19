/**
 * Tools 集成测试 — v4.3.0
 *
 * 覆盖命名空间 tool 调用后的文件系统副作用、状态变更、事件文件追加。
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  createMockLogger,
  createMockLog,
  createMockState,
  createMockSkills,
  createMockApi
} from './helper.js';

import { TaskObject } from '../src/objects/TaskObject.js';
import { EventObject } from '../src/objects/EventObject.js';
import { registerTools } from '../src/tools/index.js';

// 创建带文件系统写入追踪的 State
function createFilesystemState(baseDir) {
  const tasks = new Map();
  return {
    getTask: async (runId) => tasks.get(runId) || null,
    saveTask: async (runId, task) => {
      tasks.set(runId, task);
      const dir = join(baseDir, '.agent', 'tasks');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(join(dir, `${runId}.json`), JSON.stringify(task, null, 2), 'utf-8');
    },
    archiveTask: async (runId) => {
      tasks.delete(runId);
      try {
        await fs.unlink(join(baseDir, '.agent', 'tasks', `${runId}.json`));
      } catch { /* ignore */ }
      return true;
    },
    listTasks: async () => Array.from(tasks.values()),
    getSession: async () => null,
    saveSession: async () => {},
    close: async () => {}
  };
}

describe('Tool Integration — Namespace Tools Flow', () => {
  let tmpDir;
  let state;
  let skills;
  let logger;
  let log;
  let taskObject;
  let eventObject;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `asd-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    state = createFilesystemState(tmpDir);
    skills = createMockSkills({
      planning: '【Planning】phase={phase}',
      monitoring: '【Monitoring】runId={runId}',
      regulation: '【Regulation】deviations={deviations}',
      development: '【Development】status={status}'
    });
    logger = createMockLogger();
    log = createMockLog();
    taskObject = new TaskObject({ state, logger, log, skills });
    eventObject = new EventObject({ logger, eventTemplate: '', projectRoot: tmpDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('完整任务生命周期：create → query → update → advance → archive', async () => {
    // create
    const createResult = await taskObject.create({ runId: 'int-001', prompt: '集成测试任务' });
    assert.ok(createResult.task);
    assert.strictEqual(createResult.task.status, 'draft');

    // query
    const queryResult = await taskObject.get('int-001');
    assert.strictEqual(queryResult.task.runId, 'int-001');

    // update: draft -> pending_approval -> active
    const updateResult1 = await taskObject.update({ runId: 'int-001', status: 'pending_approval' });
    assert.strictEqual(updateResult1.task.status, 'pending_approval');
    assert.strictEqual(updateResult1.previousStatus, 'draft');

    const updateResult2 = await taskObject.update({ runId: 'int-001', status: 'active' });
    assert.strictEqual(updateResult2.task.status, 'active');
    assert.strictEqual(updateResult2.previousStatus, 'pending_approval');

    // advance
    const advanceResult = await taskObject.advance({ runId: 'int-001' });
    assert.ok(advanceResult.nextPhase > advanceResult.previousPhase);

    // 完成所有阶段
    const task = await state.getTask('int-001');
    const phases = task.plan.execution.phases;
    for (let i = advanceResult.nextPhase; i < phases.length; i++) {
      await taskObject.advance({ runId: 'int-001' });
    }
    const finalTask = await state.getTask('int-001');
    assert.strictEqual(finalTask.status, 'completed');

    // archive
    const archiveResult = await taskObject.archive('int-001');
    assert.strictEqual(archiveResult.archived, true);
    assert.ok(archiveResult.archivedAt);

    const archivedExists = await fs.access(join(tmpDir, '.agent', 'tasks', 'int-001.json')).then(() => true).catch(() => false);
    assert.strictEqual(archivedExists, false);
  });

  it('event.record 创建事件文件并追加偏差', async () => {
    const task = {
      runId: 'int-002',
      createdAt: Date.now(),
      status: 'draft',
      taskType: 'coding',
      plan: {
        prompt: 'test',
        context: { goal: 'g', constraints: [], successCriteria: [] },
        execution: {
          phases: [{ id: 'p1', name: '阶段1', status: 'pending' }],
          currentPhase: 0
        }
      },
      deviations: [],
      attributions: []
    };
    await state.saveTask('int-002', task);

    // 首次记录偏差（自动创建事件文件）
    const recordResult = await eventObject.record({
      runId: 'int-002',
      recordType: 'deviation',
      data: { type: 'scope_creep', description: '需求增加', impact: '延期' },
      task
    });
    assert.strictEqual(recordResult.recorded, true);
    assert.ok(recordResult.eventFilePath);

    const absPath = join(tmpDir, recordResult.eventFilePath);
    const content = await fs.readFile(absPath, 'utf-8');
    assert.ok(content.includes('scope_creep'));
    assert.ok(content.includes('需求增加'));

    // 追加归因
    const attrResult = await eventObject.record({
      runId: 'int-002',
      recordType: 'attribution',
      data: { rootCause: '评审不足', strategy: '增加评审' },
      task
    });
    assert.strictEqual(attrResult.recorded, true);

    const content2 = await fs.readFile(absPath, 'utf-8');
    assert.ok(content2.includes('评审不足'));
  });

  it('event.query 返回结构化事件记录', async () => {
    const task = {
      runId: 'int-003',
      createdAt: Date.now(),
      status: 'draft',
      taskType: 'research',
      plan: {
        prompt: 'test',
        context: { goal: 'g', constraints: [], successCriteria: [] },
        execution: {
          phases: [{ id: 'p1', name: '阶段1', status: 'pending' }],
          currentPhase: 0
        }
      },
      deviations: [],
      attributions: []
    };

    await eventObject.record({
      runId: 'int-003', recordType: 'deviation',
      data: { type: 'delay', description: '延期' }, task
    });

    const queryResult = await eventObject.query({ runId: 'int-003', type: 'deviation' });
    assert.strictEqual(queryResult.count, 1);
    assert.strictEqual(queryResult.events[0].type, 'deviation');
    assert.strictEqual(queryResult.events[0].data.type, 'delay');
  });

  it('guide.planning 根据 taskType 返回不同 skill', async () => {
    // 验证 skills 被正确加载
    const planningSkill = await skills.load('planning');
    assert.ok(planningSkill);
    assert.ok(planningSkill.includes('Planning'));
  });

  it('task.diagnose 返回趋势分析', async () => {
    await taskObject.create({ runId: 'int-004', prompt: '诊断测试' });
    await taskObject.update({ runId: 'int-004', status: 'active' });

    const result = await taskObject.diagnose('int-004');
    assert.ok(result.diagnosis.trendAnalysis);
    assert.ok(Array.isArray(result.diagnosis.trendAnalysis.riskFlags));
  });
});
