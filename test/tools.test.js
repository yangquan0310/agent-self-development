/**
 * Tools 测试 — v4.1.0
 *
 * 覆盖 13 个 tools 的输入验证、正常执行、错误处理。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMockApi, createMockCtx, createMockLogger, createMockLog, createMockState, createMockSkills } from './helper.js';
import { createMetacognitionTools } from '../src/tools/metacognition-tools.js';
import { createWorkingMemoryTools } from '../src/tools/working-memory-tools.js';
import { TOOL_SCHEMAS, ALL_TOOLS, QUERY_TOOLS, ACTION_TOOLS } from '../src/tools/schemas.js';
import { registerTools } from '../src/tools/index.js';

describe('Tool Schemas', () => {
  it('定义了 13 个 tools', () => {
    assert.strictEqual(ALL_TOOLS.length, 13);
  });

  it('查询型 7 个 + 操作型 6 个', () => {
    assert.strictEqual(QUERY_TOOLS.length, 7);
    assert.strictEqual(ACTION_TOOLS.length, 6);
  });

  it('每个 tool 都有 schema', () => {
    for (const name of ALL_TOOLS) {
      assert.ok(TOOL_SCHEMAS[name], `缺少 schema: ${name}`);
      assert.ok(TOOL_SCHEMAS[name].name);
      assert.ok(TOOL_SCHEMAS[name].description);
      assert.ok(TOOL_SCHEMAS[name].inputSchema);
    }
  });
});

describe('Metacognition Tools', () => {
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
    const tools = createMetacognitionTools({ state, skills, logger, log });
    return { state, skills, logger, tools };
  }

  // ── 查询型 Tools ──

  describe('get_planning_guide', () => {
    it('返回对应 phase 的 guide', async () => {
      const { tools } = await setup();
      const result = await tools.get_planning_guide({ phase: 'assessment' });
      assert.ok(result.guide);
      assert.ok(result.guide.includes('Planning Skill'));
      assert.strictEqual(result.phase, 'assessment');
    });

    it('缺少 phase 返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.get_planning_guide({});
      assert.ok(result.error);
    });

    it('各 phase 返回不同提示', async () => {
      const { tools } = await setup();
      for (const phase of ['assessment', 'draft', 'pending_approval', 'active', 'revising']) {
        const result = await tools.get_planning_guide({ phase });
        assert.ok(result.guide, `phase=${phase} 应返回 guide`);
      }
    });

    it('taskType=coding 返回编码任务专用模板', async () => {
      const { tools } = await setup({
        coding: '【Coding Skill】编码任务专用模板',
        research: '【Research Skill】调研任务专用模板',
        documentation: '【Documentation Skill】文档任务专用模板'
      });
      const result = await tools.get_planning_guide({ phase: 'draft', taskType: 'coding' });
      assert.ok(result.guide);
      assert.ok(result.guide.includes('编码任务'), '应包含编码任务标识');
      assert.strictEqual(result.taskType, 'coding');
    });

    it('taskType=research 返回调研任务专用模板', async () => {
      const { tools } = await setup({
        coding: '【Coding Skill】编码任务专用模板',
        research: '【Research Skill】调研任务专用模板',
        documentation: '【Documentation Skill】文档任务专用模板'
      });
      const result = await tools.get_planning_guide({ phase: 'draft', taskType: 'research' });
      assert.ok(result.guide);
      assert.ok(result.guide.includes('调研任务'), '应包含调研任务标识');
      assert.strictEqual(result.taskType, 'research');
    });

    it('taskType=documentation 返回文档任务专用模板', async () => {
      const { tools } = await setup({
        coding: '【Coding Skill】编码任务专用模板',
        research: '【Research Skill】调研任务专用模板',
        documentation: '【Documentation Skill】文档任务专用模板'
      });
      const result = await tools.get_planning_guide({ phase: 'draft', taskType: 'documentation' });
      assert.ok(result.guide);
      assert.ok(result.guide.includes('文档任务'), '应包含文档任务标识');
      assert.strictEqual(result.taskType, 'documentation');
    });

    it('无效 taskType 回退到默认 planning 模板', async () => {
      const { tools } = await setup();
      const result = await tools.get_planning_guide({ phase: 'draft', taskType: 'invalid' });
      assert.ok(result.guide);
      assert.strictEqual(result.taskType, 'default');
    });
  });

  describe('get_monitoring_guide', () => {
    it('返回 monitoring guide + 当前阶段信息', async () => {
      const { tools } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [{ id: 'p1' }, { id: 'p2' }], currentPhase: 0 } },
          deviations: [{ type: 'scope', description: '范围扩大' }]
        }
      });
      const result = await tools.get_monitoring_guide({ runId: 'r1' });
      assert.ok(result.guide);
      assert.strictEqual(result.currentPhase, 0);
      assert.strictEqual(result.totalPhases, 2);
      assert.strictEqual(result.historyDeviations.length, 1);
    });

    it('task 不存在返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.get_monitoring_guide({ runId: 'missing' });
      assert.ok(result.error);
    });
  });

  describe('get_regulation_guide', () => {
    it('有未处理偏差时返回可用 guide', async () => {
      const { tools } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [] } },
          deviations: [{ type: 'bug', description: '严重 bug', attributed: false }]
        }
      });
      const result = await tools.get_regulation_guide({ runId: 'r1' });
      assert.strictEqual(result.available, true);
      assert.ok(result.guide);
      assert.strictEqual(result.unattributedCount, 1);
    });

    it('无未处理偏差时返回不可用', async () => {
      const { tools } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [] } },
          deviations: [{ type: 'bug', description: '已处理', attributed: true }]
        }
      });
      const result = await tools.get_regulation_guide({ runId: 'r1' });
      assert.strictEqual(result.available, false);
      assert.ok(result.reason);
    });
  });

  describe('get_development_guide', () => {
    it('返回 development guide + Event 摘要', async () => {
      const { tools } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'completed',
          plan: { execution: { phases: [] } },
          deviations: [{ type: 'a' }],
          attributions: [{ rootCause: 'x' }],
          outcome: { archivedAt: '2026-05-01' }
        }
      });
      const result = await tools.get_development_guide({ runId: 'r1' });
      assert.ok(result.guide);
      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.deviationCount, 1);
      assert.strictEqual(result.attributionCount, 1);
    });
  });

  // ── 操作型 Tools ──

  describe('create_plan', () => {
    it('创建 draft task', async () => {
      const { tools, state } = await setup();
      const result = await tools.create_plan({
        runId: 'new-task',
        prompt: '帮我设计一个系统'
      });
      assert.strictEqual(result.success, true);
      assert.ok(result.task);
      assert.strictEqual(result.task.status, 'draft');
      const saved = await state.getTask('new-task');
      assert.ok(saved);
    });

    it('task 已存在返回错误', async () => {
      const { tools } = await setup({}, {
        'existing': { runId: 'existing', status: 'draft', plan: { execution: { phases: [] } } }
      });
      const result = await tools.create_plan({
        runId: 'existing',
        prompt: 'test'
      });
      assert.ok(result.error);
    });

    it('使用 planInput 自定义 phases', async () => {
      const { tools } = await setup();
      const result = await tools.create_plan({
        runId: 'custom-plan',
        prompt: 'test',
        planInput: {
          goal: '目标',
          constraints: ['约束1'],
          successCriteria: ['标准1'],
          phases: [
            { id: 'p1', name: '阶段1', goal: '达成1', outputs: ['产出1'] }
          ]
        }
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.task.plan.execution.phases.length, 1);
      assert.strictEqual(result.task.plan.execution.phases[0].id, 'p1');
    });

    it('缺少参数返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.create_plan({ runId: 'x' });
      assert.ok(result.error);
    });

    it('带 taskType 创建 task 并保存类型', async () => {
      const { tools, state } = await setup();
      const result = await tools.create_plan({
        runId: 'typed-task',
        prompt: '帮我写一个函数',
        taskType: 'coding'
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.task.taskType, 'coding');
      const saved = await state.getTask('typed-task');
      assert.strictEqual(saved.taskType, 'coding');
    });

    it('无效 taskType 不被保存', async () => {
      const { tools, state } = await setup();
      const result = await tools.create_plan({
        runId: 'untyped-task',
        prompt: 'test',
        taskType: 'invalid'
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.task.taskType, undefined);
      const saved = await state.getTask('untyped-task');
      assert.strictEqual(saved.taskType, undefined);
    });
  });

  describe('update_task_status', () => {
    it('更新 task 状态', async () => {
      const { tools, state } = await setup({}, {
        'r1': { runId: 'r1', status: 'draft', plan: { execution: { phases: [] } } }
      });
      const result = await tools.update_task_status({
        runId: 'r1', status: 'active', reason: '用户确认'
      });
      assert.strictEqual(result.success, true);
      const task = await state.getTask('r1');
      assert.strictEqual(task.status, 'active');
      assert.strictEqual(task.revisionReason, '用户确认');
    });

    it('无效状态返回错误', async () => {
      const { tools } = await setup({}, {
        'r1': { runId: 'r1', status: 'draft', plan: { execution: { phases: [] } } }
      });
      const result = await tools.update_task_status({
        runId: 'r1', status: 'invalid'
      });
      assert.ok(result.error);
    });

    it('task 不存在返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.update_task_status({
        runId: 'missing', status: 'active'
      });
      assert.ok(result.error);
    });
  });

  describe('advance_phase', () => {
    it('推进到下一阶段', async () => {
      const { tools, state } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [{ id: 'p1' }, { id: 'p2' }], currentPhase: 0 } }
        }
      });
      const result = await tools.advance_phase({ runId: 'r1' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.previousPhase, 0);
      assert.strictEqual(result.nextPhase, 1);
      assert.strictEqual(result.isComplete, false);
      const task = await state.getTask('r1');
      assert.strictEqual(task.plan.execution.currentPhase, 1);
      assert.strictEqual(task.plan.execution.phases[0].status, 'completed');
    });

    it('所有阶段完成时 isComplete=true', async () => {
      const { tools } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [{ id: 'p1' }], currentPhase: 0 } }
        }
      });
      const result = await tools.advance_phase({ runId: 'r1' });
      assert.strictEqual(result.isComplete, true);
    });

    it('指定 phaseId 推进', async () => {
      const { tools, state } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], currentPhase: 0 } }
        }
      });
      const result = await tools.advance_phase({ runId: 'r1', phaseId: 'p2' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.nextPhase, 1);
      const task = await state.getTask('r1');
      assert.strictEqual(task.plan.execution.phases[1].status, 'completed');
    });

    it('无效 phaseId 返回错误', async () => {
      const { tools } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [{ id: 'p1' }], currentPhase: 0 } }
        }
      });
      const result = await tools.advance_phase({ runId: 'r1', phaseId: 'missing' });
      assert.ok(result.error);
    });
  });

  describe('record_deviation', () => {
    it('记录偏差到 task', async () => {
      const { tools, state } = await setup({}, {
        'r1': { runId: 'r1', status: 'active', plan: { execution: { phases: [] } } }
      });
      const result = await tools.record_deviation({
        runId: 'r1', type: 'scope_creep', description: '范围扩大了', impact: '延期2天'
      });
      assert.strictEqual(result.success, true);
      assert.ok(result.deviation.id);
      const task = await state.getTask('r1');
      assert.strictEqual(task.deviations.length, 1);
      assert.strictEqual(task.deviations[0].type, 'scope_creep');
    });

    it('缺少参数返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.record_deviation({ runId: 'r1' });
      assert.ok(result.error);
    });
  });

  describe('record_attribution', () => {
    it('记录归因到 task', async () => {
      const { tools, state } = await setup({}, {
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [] } },
          deviations: [{ type: 'bug', attributed: false }]
        }
      });
      const result = await tools.record_attribution({
        runId: 'r1', rootCause: '需求不明确', impact: '返工', strategy: '加强评审'
      });
      assert.strictEqual(result.success, true);
      assert.ok(result.attribution.id);
      const task = await state.getTask('r1');
      assert.strictEqual(task.attributions.length, 1);
      assert.strictEqual(task.deviations[0].attributed, true);
    });

    it('缺少参数返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.record_attribution({ runId: 'r1' });
      assert.ok(result.error);
    });
  });
});

describe('Working Memory Tools', () => {
  async function setup(stateData = {}) {
    const state = createMockState();
    for (const [k, v] of Object.entries(stateData)) {
      await state.saveTask(k, v);
    }
    const skills = createMockSkills();
    const logger = createMockLogger();
    const log = createMockLog();
    const tools = createWorkingMemoryTools({ state, skills, logger, log });
    return { state, tools, logger };
  }

  describe('get_task_status', () => {
    it('返回完整 task JSON', async () => {
      const { tools } = await setup({
        'r1': { runId: 'r1', status: 'active', plan: { execution: { phases: [] } } }
      });
      const result = await tools.get_task_status({ runId: 'r1' });
      assert.ok(result.task);
      assert.strictEqual(result.task.runId, 'r1');
      assert.strictEqual(result.task.status, 'active');
    });

    it('task 不存在返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.get_task_status({ runId: 'missing' });
      assert.ok(result.error);
    });
  });

  describe('get_task_files', () => {
    it('无项目级索引时返回空列表', async () => {
      const { tools } = await setup();
      const result = await tools.get_task_files({ runId: 'r1' });
      assert.deepStrictEqual(result.files, []);
      assert.strictEqual(result.count, 0);
    });
  });

  describe('self_diagnose', () => {
    it('带 runId 返回任务诊断', async () => {
      const { tools } = await setup({
        'r1': {
          runId: 'r1', status: 'active',
          plan: { execution: { phases: [{ id: 'p1' }], currentPhase: 0 } },
          deviations: [], attributions: []
        }
      });
      const result = await tools.self_diagnose({ runId: 'r1' });
      assert.ok(result.diagnosis);
      assert.strictEqual(result.diagnosis.taskStatus, 'active');
      assert.strictEqual(result.diagnosis.phase, 0);
      assert.ok(Array.isArray(result.diagnosis.toolsAvailable));
      assert.strictEqual(result.diagnosis.toolsAvailable.length, 13);
    });

    it('无 runId 返回全局诊断', async () => {
      const { tools } = await setup();
      const result = await tools.self_diagnose({});
      assert.ok(result.diagnosis);
      assert.strictEqual(result.diagnosis.mode, 'global');
      assert.ok(Array.isArray(result.diagnosis.toolsAvailable));
    });

    it('无 task 时返回适当提示', async () => {
      const { tools } = await setup();
      const result = await tools.self_diagnose({ runId: 'missing' });
      assert.strictEqual(result.diagnosis.taskStatus, 'none');
      assert.ok(result.diagnosis.note);
    });
  });

  describe('archive_task', () => {
    it('归档 completed task', async () => {
      const { tools, state } = await setup({
        'r1': { runId: 'r1', status: 'completed', plan: { execution: { phases: [] } } }
      });
      const result = await tools.archive_task({ runId: 'r1' });
      assert.strictEqual(result.success, true);
      assert.ok(result.archivedAt);
      const task = await state.getTask('r1');
      assert.strictEqual(task, null); // 已从活跃任务删除
    });

    it('非 completed 状态返回错误', async () => {
      const { tools } = await setup({
        'r1': { runId: 'r1', status: 'active', plan: { execution: { phases: [] } } }
      });
      const result = await tools.archive_task({ runId: 'r1' });
      assert.ok(result.error);
      assert.ok(result.error.includes('completed'));
    });

    it('task 不存在返回错误', async () => {
      const { tools } = await setup();
      const result = await tools.archive_task({ runId: 'missing' });
      assert.ok(result.error);
    });
  });
});

describe('Tool Registry', () => {
  it('registerTools 注册所有 tools', () => {
    const api = {
      registerTool: (name, tool) => {
        api._tools = api._tools || {};
        api._tools[name] = tool;
      }
    };
    const deps = {
      state: createMockState(),
      skills: createMockSkills(),
      logger: createMockLogger(),
      log: createMockLog()
    };
    registerTools(api, deps);

    for (const name of ALL_TOOLS) {
      assert.ok(api._tools[name], `tool 未注册: ${name}`);
      assert.ok(api._tools[name].name);
      assert.ok(api._tools[name].description);
      assert.ok(api._tools[name].inputSchema);
      assert.strictEqual(typeof api._tools[name].handler, 'function');
    }
  });

  it('registerTools 在无 api.registerTool 时警告', () => {
    const api = {};
    const logger = createMockLogger();
    registerTools(api, { logger });
    assert.ok(logger._calls.some(c => c[0] === 'warn'));
  });

  it('tool handler 错误被捕获', async () => {
    const api = {
      registerTool: (name, tool) => {
        api._tools = api._tools || {};
        api._tools[name] = tool;
      }
    };
    const deps = {
      state: createMockState(),
      skills: createMockSkills(),
      logger: createMockLogger(),
      log: createMockLog()
    };
    registerTools(api, deps);

    // get_task_status 在 task 不存在时返回错误，但 handler 不抛异常
    const result = await api._tools.get_task_status.handler({ runId: 'missing' });
    assert.ok(result.error);
  });
});
