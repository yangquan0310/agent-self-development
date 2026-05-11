/**
 * Tools 集成测试 — v4.1.0
 *
 * 覆盖 tool 调用后的文件系统副作用、状态变更、事件文件追加、
 * 以及完整的 Agent tool 调用链（get_task_status → get_planning_guide → create_plan）。
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

import { createMetacognitionTools } from '../src/tools/metacognition-tools.js';
import { createWorkingMemoryTools } from '../src/tools/working-memory-tools.js';
import { registerTools } from '../src/tools/index.js';

// 创建带文件系统写入追踪的 State
function createFilesystemState(baseDir) {
  const tasks = new Map();
  return {
    getTask: async (runId) => tasks.get(runId) || null,
    saveTask: async (runId, task) => {
      tasks.set(runId, task);
      // 同步写入文件系统（模拟真实 State 行为）
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

describe('Tool Integration — File System Side Effects', () => {
  let tmpDir;
  let state;
  let tools;
  let metaTools;
  let logger;
  let log;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `asd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    state = createFilesystemState(tmpDir);
    logger = createMockLogger();
    log = createMockLog();
    const skills = createMockSkills({
      planning: '【Planning Skill】',
      monitoring: '【Monitoring Skill】',
      regulation: '【Regulation Skill】',
      development: '【Development Skill】'
    });
    metaTools = createMetacognitionTools({ state, skills, logger, log });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('create_plan', () => {
    it('创建 draft task 并写入 .agent/tasks/{runId}.json', async () => {
      const runId = 'test-plan-001';
      const result = await metaTools.create_plan({
        runId,
        prompt: '帮我设计一个系统',
        planInput: {
          goal: '设计系统',
          constraints: ['预算有限'],
          successCriteria: ['可运行'],
          phases: [
            { id: 'p1', name: '需求分析', goal: '达成需求明确', outputs: ['需求文档'] }
          ]
        }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.task);

      // 验证文件系统写入
      const filePath = join(tmpDir, '.agent', 'tasks', `${runId}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const savedTask = JSON.parse(fileContent);

      assert.strictEqual(savedTask.runId, runId);
      assert.strictEqual(savedTask.status, 'draft');
      assert.strictEqual(savedTask.plan.execution.phases.length, 1);
      assert.strictEqual(savedTask.plan.execution.phases[0].id, 'p1');
    });

    it('多次创建不同 runId 生成独立文件', async () => {
      for (let i = 0; i < 3; i++) {
        const runId = `multi-${i}`;
        await metaTools.create_plan({
          runId,
          prompt: `任务 ${i}`,
          planInput: {
            goal: `目标 ${i}`,
            phases: [{ id: `p${i}`, name: `阶段 ${i}`, goal: '', outputs: [] }]
          }
        });
      }

      const tasksDir = join(tmpDir, '.agent', 'tasks');
      const files = await fs.readdir(tasksDir);
      assert.strictEqual(files.length, 3);
      assert.ok(files.includes('multi-0.json'));
      assert.ok(files.includes('multi-1.json'));
      assert.ok(files.includes('multi-2.json'));
    });

    it('task 已存在不覆盖文件', async () => {
      const runId = 'duplicate';
      await metaTools.create_plan({
        runId,
        prompt: '原始',
        planInput: { goal: '原始目标', phases: [] }
      });

      const result = await metaTools.create_plan({
        runId,
        prompt: '重复',
        planInput: { goal: '新目标', phases: [] }
      });

      assert.ok(result.error);
      assert.ok(result.error.includes('已存在'));

      // 验证原始文件未被覆盖
      const filePath = join(tmpDir, '.agent', 'tasks', `${runId}.json`);
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      assert.strictEqual(content.plan.context.goal, '原始目标');
    });
  });

  describe('update_task_status', () => {
    it('更新状态后文件同步变更', async () => {
      const runId = 'status-test';
      await metaTools.create_plan({
        runId,
        prompt: 'test',
        planInput: { goal: 'g', phases: [] }
      });

      const result = await metaTools.update_task_status({
        runId,
        status: 'active',
        reason: '用户确认'
      });

      assert.strictEqual(result.success, true);

      // 验证文件系统更新
      const filePath = join(tmpDir, '.agent', 'tasks', `${runId}.json`);
      const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      assert.strictEqual(content.status, 'active');
      assert.strictEqual(content.revisionReason, '用户确认');
      assert.ok(content.updatedAt >= content.createdAt);
    });

    it('无效状态拒绝更新且不修改文件', async () => {
      const runId = 'invalid-status';
      await metaTools.create_plan({
        runId,
        prompt: 'test',
        planInput: { goal: 'g', phases: [] }
      });

      const before = JSON.parse(await fs.readFile(join(tmpDir, '.agent', 'tasks', `${runId}.json`), 'utf-8'));

      const result = await metaTools.update_task_status({
        runId,
        status: 'invalid_state'
      });

      assert.ok(result.error);

      const after = JSON.parse(await fs.readFile(join(tmpDir, '.agent', 'tasks', `${runId}.json`), 'utf-8'));
      assert.strictEqual(after.status, before.status);
    });

    it('依次更新多个状态生命周期完整', async () => {
      const runId = 'lifecycle';
      await metaTools.create_plan({ runId, prompt: 'test', planInput: { goal: 'g', phases: [] } });

      const statuses = ['pending_approval', 'active', 'revising', 'active', 'completed'];
      for (const status of statuses) {
        const r = await metaTools.update_task_status({ runId, status });
        assert.strictEqual(r.success, true);
      }

      const final = JSON.parse(await fs.readFile(join(tmpDir, '.agent', 'tasks', `${runId}.json`), 'utf-8'));
      assert.strictEqual(final.status, 'completed');
    });
  });

  describe('advance_phase', () => {
    it('推进阶段后文件 currentPhase 更新', async () => {
      const runId = 'phase-test';
      await metaTools.create_plan({
        runId,
        prompt: 'test',
        planInput: {
          goal: 'g',
          phases: [
            { id: 'p1', name: '设计', goal: '完成设计', outputs: [] },
            { id: 'p2', name: '实现', goal: '完成实现', outputs: [] }
          ]
        }
      });

      const result = await metaTools.advance_phase({ runId });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.previousPhase, 0);
      assert.strictEqual(result.nextPhase, 1);

      const fileContent = JSON.parse(await fs.readFile(join(tmpDir, '.agent', 'tasks', `${runId}.json`), 'utf-8'));
      assert.strictEqual(fileContent.plan.execution.currentPhase, 1);
      assert.strictEqual(fileContent.plan.execution.phases[0].status, 'completed');
    });

    it('所有阶段完成后 isComplete=true', async () => {
      const runId = 'complete-test';
      await metaTools.create_plan({
        runId,
        prompt: 'test',
        planInput: {
          goal: 'g',
          phases: [
            { id: 'p1', name: '唯一阶段', goal: '完成', outputs: [] }
          ]
        }
      });

      const result = await metaTools.advance_phase({ runId });
      assert.strictEqual(result.isComplete, true);

      const fileContent = JSON.parse(await fs.readFile(join(tmpDir, '.agent', 'tasks', `${runId}.json`), 'utf-8'));
      assert.strictEqual(fileContent.plan.execution.currentPhase, 1);
    });
  });
});

describe('Tool Integration — Event File Append', () => {
  let tmpDir;
  let state;
  let metaTools;
  let logger;
  let log;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `asd-event-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    state = createFilesystemState(tmpDir);
    logger = createMockLogger();
    log = createMockLog();
    const skills = createMockSkills();
    metaTools = createMetacognitionTools({ state, skills, logger, log });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('record_deviation 追加偏差到事件文件', async () => {
    const runId = 'dev-event';
    const now = Date.now();
    const date = new Date(now);
    const dateStr = date.toISOString().slice(0, 10);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    // 先创建 task（带 createdAt）
    await metaTools.create_plan({
      runId,
      prompt: 'test',
      planInput: { goal: 'g', phases: [] }
    });
    // 修正 createdAt 为当前时间以便匹配事件文件路径
    const task = await state.getTask(runId);
    task.createdAt = now;
    // 显式设置 eventFilePath 指向测试目录
    task.eventFilePath = join(tmpDir, '.agent', 'events', dateStr, `${hh}-${mm}-${ss}.md`);
    await state.saveTask(runId, task);

    // 创建事件文件结构
    const eventDir = join(tmpDir, '.agent', 'events', dateStr);
    await fs.mkdir(eventDir, { recursive: true });
    const eventFile = join(eventDir, `${hh}-${mm}-${ss}.md`);
    await fs.writeFile(eventFile, `# Event\n\n## 5. 偏差\n\n初始内容\n\n## 6. 归因\n\n`, 'utf-8');

    // 记录偏差
    const result = await metaTools.record_deviation({
      runId,
      type: 'scope_creep',
      description: '范围扩大了',
      impact: '延期2天'
    });

    assert.strictEqual(result.success, true);

    // 验证事件文件追加
    const content = await fs.readFile(eventFile, 'utf-8');
    assert.ok(content.includes('范围扩大了'));
    assert.ok(content.includes('scope_creep'));
    assert.ok(content.includes('延期2天'));
  });

  it('record_attribution 追加归因到事件文件', async () => {
    const runId = 'attr-event';
    const now = Date.now();
    const date = new Date(now);
    const dateStr = date.toISOString().slice(0, 10);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    await metaTools.create_plan({
      runId,
      prompt: 'test',
      planInput: { goal: 'g', phases: [] }
    });
    const task = await state.getTask(runId);
    task.createdAt = now;
    // 显式设置 eventFilePath 指向测试目录
    task.eventFilePath = join(tmpDir, '.agent', 'events', dateStr, `${hh}-${mm}-${ss}.md`);
    await state.saveTask(runId, task);

    const eventDir = join(tmpDir, '.agent', 'events', dateStr);
    await fs.mkdir(eventDir, { recursive: true });
    const eventFile = join(eventDir, `${hh}-${mm}-${ss}.md`);
    await fs.writeFile(eventFile, `# Event\n\n## 5. 偏差\n\n## 6. 归因\n\n`, 'utf-8');

    const result = await metaTools.record_attribution({
      runId,
      rootCause: '需求不明确',
      impact: '返工',
      strategy: '加强评审'
    });

    assert.strictEqual(result.success, true);

    const content = await fs.readFile(eventFile, 'utf-8');
    assert.ok(content.includes('需求不明确'));
    assert.ok(content.includes('加强评审'));
  });

  it('事件文件不存在时静默跳过', async () => {
    const runId = 'no-event';
    await metaTools.create_plan({
      runId,
      prompt: 'test',
      planInput: { goal: 'g', phases: [] }
    });

    // 不创建事件文件，直接记录偏差
    const result = await metaTools.record_deviation({
      runId,
      type: 'other',
      description: '测试'
    });

    assert.strictEqual(result.success, true);
    // 不应抛异常
  });
});

describe('Tool Integration — Self Diagnose', () => {
  let tmpDir;
  let state;
  let wmTools;
  let logger;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `asd-diag-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    state = createFilesystemState(tmpDir);
    logger = createMockLogger();
    const skills = createMockSkills();
    wmTools = createWorkingMemoryTools({ state, skills, logger, log: createMockLog() });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('task 存在时返回完整诊断', async () => {
    const runId = 'diag-exists';
    const meta = createMetacognitionTools({ state, skills: createMockSkills(), logger, log: createMockLog() });
    await meta.create_plan({ runId, prompt: 'test', planInput: { goal: 'g', phases: [] } });

    const result = await wmTools.self_diagnose({ runId });
    assert.strictEqual(result.diagnosis.taskStatus, 'draft');
    assert.strictEqual(result.diagnosis.phase, 0);
    assert.strictEqual(result.diagnosis.toolsAvailable.length, 13);
    assert.ok(result.diagnosis.toolsAvailable.includes('create_plan'));
    assert.ok(result.diagnosis.toolsAvailable.includes('archive_task'));
  });

  it('task 不存在时返回 none 状态', async () => {
    const result = await wmTools.self_diagnose({ runId: 'missing' });
    assert.strictEqual(result.diagnosis.taskStatus, 'none');
    assert.ok(result.diagnosis.note);
    assert.ok(result.diagnosis.note.includes('尚无'));
  });

  it('无 runId 时返回全局诊断', async () => {
    const result = await wmTools.self_diagnose({});
    assert.strictEqual(result.diagnosis.mode, 'global');
    assert.ok(Array.isArray(result.diagnosis.toolsAvailable));
    assert.strictEqual(result.diagnosis.toolsAvailable.length, 13);
  });

  it('全局诊断包含活跃/已完成任务统计', async () => {
    const meta = createMetacognitionTools({ state, skills: createMockSkills(), logger, log: createMockLog() });
    await meta.create_plan({ runId: 'active-1', prompt: 'a', planInput: { goal: 'g', phases: [] } });
    await meta.create_plan({ runId: 'active-2', prompt: 'b', planInput: { goal: 'g', phases: [] } });
    await meta.update_task_status({ runId: 'active-2', status: 'completed' });

    const result = await wmTools.self_diagnose({});
    assert.strictEqual(result.diagnosis.activeTasks, 1);
    assert.strictEqual(result.diagnosis.completedTasks, 1);
  });
});

describe('Tool Integration — Agent Tool Call Chain', () => {
  let tmpDir;
  let state;
  let metaTools;
  let wmTools;
  let logger;
  let log;
  let skills;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `asd-chain-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    state = createFilesystemState(tmpDir);
    logger = createMockLogger();
    log = createMockLog();
    skills = createMockSkills({
      planning: '【Planning Skill Content】\n评估 → 制定 → 确认',
      monitoring: '【Monitoring Skill】',
      regulation: '【Regulation Skill】',
      development: '【Development Skill】'
    });
    metaTools = createMetacognitionTools({ state, skills, logger, log });
    wmTools = createWorkingMemoryTools({ state, skills, logger, log });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('完整流程：get_task_status → get_planning_guide → create_plan', async () => {
    const runId = 'chain-test';

    // Step 1: 检查任务状态（无 task）
    const statusResult = await wmTools.get_task_status({ runId });
    assert.ok(statusResult.error);
    assert.ok(statusResult.error.includes('不存在'));

    // Step 2: 获取 planning guide（assessment 阶段）
    const guideResult = await metaTools.get_planning_guide({ phase: 'assessment' });
    assert.ok(guideResult.guide);
    assert.ok(guideResult.guide.includes('Planning Skill'));

    // Step 3: 创建 plan
    const createResult = await metaTools.create_plan({
      runId,
      prompt: '帮我设计 API',
      planInput: {
        goal: '设计 REST API',
        constraints: ['使用 Node.js'],
        successCriteria: ['通过测试'],
        phases: [
          { id: 'p1', name: '设计接口', goal: '完成接口定义', outputs: ['openapi.yaml'] },
          { id: 'p2', name: '实现代码', goal: '完成代码实现', outputs: ['src/api.js'] }
        ]
      }
    });

    assert.strictEqual(createResult.success, true);
    assert.strictEqual(createResult.task.status, 'draft');
    assert.strictEqual(createResult.task.plan.execution.phases.length, 2);

    // Step 4: 验证 task 已可查询
    const finalStatus = await wmTools.get_task_status({ runId });
    assert.strictEqual(finalStatus.task.status, 'draft');
    assert.strictEqual(finalStatus.task.plan.execution.currentPhase, 0);

    // Step 5: 验证文件已写入
    const filePath = join(tmpDir, '.agent', 'tasks', `${runId}.json`);
    const fileContent = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    assert.strictEqual(fileContent.plan.context.goal, '设计 REST API');
  });

  it('完整流程：draft → pending_approval → active → advance_phase → completed', async () => {
    const runId = 'full-lifecycle';

    // 创建 plan
    await metaTools.create_plan({
      runId,
      prompt: 'test',
      planInput: {
        goal: 'g',
        phases: [
          { id: 'p1', name: '阶段1', goal: '完成1', outputs: [] },
          { id: 'p2', name: '阶段2', goal: '完成2', outputs: [] }
        ]
      }
    });

    // 提交审核
    await metaTools.update_task_status({ runId, status: 'pending_approval' });
    let task = await state.getTask(runId);
    assert.strictEqual(task.status, 'pending_approval');

    // 用户确认，变为 active
    await metaTools.update_task_status({ runId, status: 'active' });
    task = await state.getTask(runId);
    assert.strictEqual(task.status, 'active');

    // 推进阶段1
    const adv1 = await metaTools.advance_phase({ runId });
    assert.strictEqual(adv1.nextPhase, 1);
    assert.strictEqual(adv1.isComplete, false);

    // 推进阶段2（完成）
    const adv2 = await metaTools.advance_phase({ runId });
    assert.strictEqual(adv2.nextPhase, 2);
    assert.strictEqual(adv2.isComplete, true);

    // 标记完成
    await metaTools.update_task_status({ runId, status: 'completed' });
    task = await state.getTask(runId);
    assert.strictEqual(task.status, 'completed');

    // 归档
    const archiveResult = await wmTools.archive_task({ runId });
    assert.strictEqual(archiveResult.success, true);

    // 验证已删除
    const gone = await state.getTask(runId);
    assert.strictEqual(gone, null);
  });

  it('偏差记录链：detect → record_deviation → get_monitoring_guide → record_attribution', async () => {
    const runId = 'deviation-chain';

    await metaTools.create_plan({
      runId,
      prompt: 'test',
      planInput: { goal: 'g', phases: [{ id: 'p1', name: '阶段1', goal: '', outputs: [] }] }
    });

    // 记录偏差
    const devResult = await metaTools.record_deviation({
      runId,
      type: 'scope_creep',
      description: '用户要求增加新功能',
      impact: '延期1天'
    });
    assert.strictEqual(devResult.success, true);
    assert.ok(devResult.deviation.id);

    // 获取 monitoring guide（应包含偏差信息）
    const monResult = await metaTools.get_monitoring_guide({ runId });
    assert.ok(monResult.guide.includes('历史偏差'));
    assert.strictEqual(monResult.historyDeviations.length, 1);

    // 记录归因
    const attrResult = await metaTools.record_attribution({
      runId,
      rootCause: '需求评审不充分',
      impact: '返工',
      strategy: '增加需求评审环节'
    });
    assert.strictEqual(attrResult.success, true);

    // 验证偏差被标记为已归因
    const task = await state.getTask(runId);
    assert.strictEqual(task.deviations[0].attributed, true);
    assert.ok(task.deviations[0].attributionId);
  });
});

describe('Tool Integration — Registry Integration', () => {
  it('registerTools 通过 handler 调用工具链', async () => {
    const api = createMockApi();
    api.registerTool = (name, tool) => {
      api._tools = api._tools || {};
      api._tools[name] = tool;
    };

    const state = createMockState();
    const skills = createMockSkills({
      planning: 'Planning',
      monitoring: 'Monitoring',
      regulation: 'Regulation',
      development: 'Development'
    });
    const logger = createMockLogger();
    const log = createMockLog();

    registerTools(api, { state, skills, logger, log });

    // 通过 handler 调用 create_plan
    const createResult = await api._tools.create_plan.handler({
      runId: 'registry-test',
      prompt: 'test',
      planInput: { goal: 'g', phases: [{ id: 'p1', name: '阶段1', goal: '', outputs: [] }] }
    });
    assert.strictEqual(createResult.success, true);

    // 通过 handler 调用 get_task_status
    const statusResult = await api._tools.get_task_status.handler({ runId: 'registry-test' });
    assert.strictEqual(statusResult.task.status, 'draft');

    // 通过 handler 调用 update_task_status
    const updateResult = await api._tools.update_task_status.handler({
      runId: 'registry-test',
      status: 'active'
    });
    assert.strictEqual(updateResult.success, true);

    // 验证状态确实变更
    const finalStatus = await api._tools.get_task_status.handler({ runId: 'registry-test' });
    assert.strictEqual(finalStatus.task.status, 'active');
  });

  it('handler 错误被捕获并返回结构化错误', async () => {
    const api = createMockApi();
    api.registerTool = (name, tool) => {
      api._tools = api._tools || {};
      api._tools[name] = tool;
    };

    const state = createMockState();
    const skills = createMockSkills();
    const logger = createMockLogger();

    registerTools(api, { state, skills, logger, log: createMockLog() });

    // 调用不存在的 task
    const result = await api._tools.get_task_status.handler({ runId: 'missing' });
    assert.ok(result.error);
    assert.ok(!result.task);
  });
});

describe('Tool Integration — Input Validation', () => {
  let state;
  let metaTools;
  let wmTools;

  beforeEach(() => {
    state = createMockState();
    const skills = createMockSkills();
    const logger = createMockLogger();
    metaTools = createMetacognitionTools({ state, skills, logger, log: createMockLog() });
    wmTools = createWorkingMemoryTools({ state, skills, logger, log: createMockLog() });
  });

  it('create_plan 缺少 prompt 返回错误', async () => {
    const result = await metaTools.create_plan({ runId: 'x' });
    assert.ok(result.error);
  });

  it('update_task_status 缺少 runId 返回错误', async () => {
    const result = await metaTools.update_task_status({ status: 'active' });
    assert.ok(result.error);
  });

  it('advance_phase 缺少 runId 返回错误', async () => {
    const result = await metaTools.advance_phase({});
    assert.ok(result.error);
  });

  it('record_deviation 缺少 description 返回错误', async () => {
    const result = await metaTools.record_deviation({ runId: 'x', type: 't' });
    assert.ok(result.error);
  });

  it('record_attribution 缺少 strategy 返回错误', async () => {
    const result = await metaTools.record_attribution({ runId: 'x', rootCause: 'r' });
    assert.ok(result.error);
  });

  it('archive_task 非 completed 状态返回错误', async () => {
    state.saveTask('active-task', { runId: 'active-task', status: 'active', plan: { execution: { phases: [] } } });
    const result = await wmTools.archive_task({ runId: 'active-task' });
    assert.ok(result.error);
    assert.ok(result.error.includes('completed'));
  });

  it('get_planning_guide 无效 phase 返回错误（skill 缺失）', async () => {
    const result = await metaTools.get_planning_guide({ phase: 'unknown_phase' });
    assert.ok(result.error);
    assert.ok(result.error.includes('planning skill'));
  });

  it('get_regulation_guide 无偏差时返回可用=false', async () => {
    state.saveTask('no-dev', { runId: 'no-dev', status: 'active', plan: { execution: { phases: [] } }, deviations: [] });
    const result = await metaTools.get_regulation_guide({ runId: 'no-dev' });
    assert.strictEqual(result.available, false);
  });

  it('get_development_guide 任何状态都返回 guide', async () => {
    state.saveTask('any-status', { runId: 'any-status', status: 'draft', plan: { execution: { phases: [] } }, deviations: [], attributions: [] });
    const result = await metaTools.get_development_guide({ runId: 'any-status' });
    assert.ok(result.guide);
    assert.strictEqual(result.status, 'draft');
  });
});
