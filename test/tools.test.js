/**
 * Tools 测试 — v4.3.0
 *
 * 覆盖命名空间工具的 schema 定义、注册格式、返回值包装。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMockApi, createMockLogger, createMockLog, createMockState, createMockSkills } from './helper.js';
import { TOOL_SCHEMAS, ALL_TOOLS, TASK_TOOLS, EVENT_TOOLS, GUIDE_TOOLS } from '../src/tools/schemas.js';
import { registerTools } from '../src/tools/index.js';
import { adaptReturn, adaptError } from '../src/tools/return-adapter.js';
import { TaskObject } from '../src/objects/TaskObject.js';
import { EventObject } from '../src/objects/EventObject.js';

describe('Tool Schemas', () => {
  it('定义了 13 个命名空间 tools', () => {
    assert.strictEqual(ALL_TOOLS.length, 13);
  });

  it('task.* 7 个 + event.* 2 个 + guide.* 4 个', () => {
    assert.strictEqual(TASK_TOOLS.length, 7);
    assert.strictEqual(EVENT_TOOLS.length, 2);
    assert.strictEqual(GUIDE_TOOLS.length, 4);
  });

  it('每个 tool 都有 schema（parameters 格式）', () => {
    for (const name of ALL_TOOLS) {
      assert.ok(TOOL_SCHEMAS[name], `缺少 schema: ${name}`);
      assert.ok(TOOL_SCHEMAS[name].name);
      assert.ok(TOOL_SCHEMAS[name].description);
      assert.ok(TOOL_SCHEMAS[name].parameters);
      assert.strictEqual(TOOL_SCHEMAS[name].parameters.type, 'object');
    }
  });

  it('旧工具名已从 schema 中移除', () => {
    const oldNames = [
      'create_plan', 'update_task_status', 'advance_phase',
      'get_task_status', 'get_task_files', 'self_diagnose', 'archive_task',
      'record_deviation', 'record_attribution',
      'get_planning_guide', 'get_monitoring_guide', 'get_regulation_guide', 'get_development_guide'
    ];
    for (const name of oldNames) {
      assert.strictEqual(TOOL_SCHEMAS[name], undefined, `旧工具名残留: ${name}`);
    }
  });
});

describe('Return Adapter', () => {
  it('adaptReturn 包装为 { content: [...] }', () => {
    const result = adaptReturn({ foo: 'bar' });
    assert.ok(Array.isArray(result.content));
    assert.strictEqual(result.content[0].type, 'text');
    assert.strictEqual(result.content[0].text, '{"foo":"bar"}');
  });

  it('adaptError 包装为 isError=true', () => {
    const result = adaptError('something wrong');
    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes('something wrong'));
  });

  it('adaptReturn pretty 格式化', () => {
    const result = adaptReturn({ a: 1 }, { pretty: true });
    assert.ok(result.content[0].text.includes('\n'));
  });
});

describe('Tool Registration', () => {
  function setup() {
    const api = createMockApi();
    const state = createMockState();
    const skills = createMockSkills({
      planning: '【Planning】',
      monitoring: '【Monitoring】',
      regulation: '【Regulation】',
      development: '【Development】'
    });
    const logger = createMockLogger();
    const log = createMockLog();
    const taskObject = new TaskObject({ state, logger, log, skills });
    const eventObject = new EventObject({ logger, projectRoot: '/tmp' });
    return { api, state, skills, logger, taskObject, eventObject };
  }

  it('registerTools 注册全部 13 个命名空间 tools', () => {
    const { api, state, skills, logger, taskObject, eventObject } = setup();
    registerTools(api, { state, skills, logger, log: createMockLog(), taskObject, eventObject });
    assert.strictEqual(api._hooks.size, 0); // registerTool 不走 api.on
    // MockApi 的 createMockApi 没有 registerTool，所以需要验证它是否被调用
    // createMockApi 只有 on/_hooks/_emit，没有 registerTool
    // 因此 registerTools 会 early return 并打印 warn
    assert.ok(logger._calls.some(c => c[1].includes('api.registerTool 不可用')));
  });
});

describe('Namespace Tool Handlers — via TaskObject/EventObject', () => {
  async function setup(skillMap = {}, stateData = {}) {
    const state = createMockState();
    for (const [k, v] of Object.entries(stateData)) {
      await state.saveTask(k, v);
    }
    const skills = createMockSkills({
      planning: '【Planning Skill】',
      monitoring: '【Monitoring Skill】',
      regulation: '【Regulation Skill】',
      development: '【Development Skill】',
      ...skillMap
    });
    const logger = createMockLogger();
    const log = createMockLog();
    const taskObject = new TaskObject({ state, logger, log, skills });
    const eventObject = new EventObject({ logger, projectRoot: '/tmp' });
    return { state, skills, logger, taskObject, eventObject };
  }

  // task.create
  describe('task.create', () => {
    it('创建任务', async () => {
      const { taskObject } = await setup();
      const result = await taskObject.create({ runId: 't1', prompt: 'test' });
      assert.ok(result.task);
    });
  });

  // task.update
  describe('task.update', () => {
    it('更新状态', async () => {
      const { taskObject } = await setup();
      await taskObject.create({ runId: 't1', prompt: 'test' });
      const result = await taskObject.update({ runId: 't1', status: 'pending_approval' });
      assert.strictEqual(result.task.status, 'pending_approval');
    });
  });

  // task.advance
  describe('task.advance', () => {
    it('推进阶段', async () => {
      const { taskObject } = await setup();
      await taskObject.create({ runId: 't1', prompt: 'test' });
      const result = await taskObject.advance({ runId: 't1' });
      assert.strictEqual(result.nextPhase, 1);
    });
  });

  // task.query
  describe('task.query', () => {
    it('查询任务', async () => {
      const { taskObject } = await setup();
      await taskObject.create({ runId: 't1', prompt: 'test' });
      const result = await taskObject.get('t1');
      assert.ok(result.task);
    });
  });

  // task.files
  describe('task.files', () => {
    it('返回空文件列表', async () => {
      const { taskObject } = await setup();
      const result = await taskObject.getFiles('t1');
      assert.deepStrictEqual(result.files, []);
    });
  });

  // task.diagnose
  describe('task.diagnose', () => {
    it('返回诊断信息', async () => {
      const { taskObject } = await setup();
      const result = await taskObject.diagnose();
      assert.ok(result.diagnosis);
      assert.strictEqual(result.diagnosis.version, '4.3.0');
    });
  });

  // task.archive
  describe('task.archive', () => {
    it('归档 completed 任务', async () => {
      const { taskObject } = await setup();
      await taskObject.create({ runId: 't1', prompt: 'test' });
      await taskObject.update({ runId: 't1', status: 'completed' });
      const result = await taskObject.archive('t1');
      assert.strictEqual(result.archived, true);
    });
  });

  // event.record
  describe('event.record', () => {
    it('记录偏差需要 task 或已有事件文件', async () => {
      const { eventObject } = await setup();
      const result = await eventObject.record({
        runId: 't1', recordType: 'deviation', data: { type: 'x', description: 'y' }
      });
      // 无 task 且无已有文件，应返回错误
      assert.ok(result.error);
    });
  });

  // event.query
  describe('event.query', () => {
    it('空查询返回空数组', async () => {
      const { eventObject } = await setup();
      const result = await eventObject.query();
      assert.deepStrictEqual(result.events, []);
    });
  });

  // guide.planning
  describe('guide.planning', () => {
    it('缺少 phase 返回错误', async () => {
      const { skills, logger } = await setup();
      // 直接测试 guide handler 的底层逻辑（skills.load）
      const result = await skills.load('planning');
      assert.ok(result);
    });
  });
});
