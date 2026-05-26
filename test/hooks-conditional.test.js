/**
 * Hooks Conditional Test — v4.5.0
 *
 * 测试 after_tool_call 和 before_prompt_build 条件触发逻辑。
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { evaluateAfterToolCall, evaluateBeforePromptBuild, REMINDERS } from '../src/hooks/condition.js';

const tmpDir = join(tmpdir(), 'asd-hooks-test-' + Date.now());
const origCwd = process.cwd();

describe('hooks condition', () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('evaluateAfterToolCall', () => {
    it('M1: task.create 成功时应触发注入', () => {
      const event = {
        toolName: 'task.create',
        result: { content: [{ type: 'text', text: '{"runId":"test-123","status":"draft"}' }] }
      };
      const { shouldInject, idempotencyKey, prependContext } = evaluateAfterToolCall(event);

      assert.strictEqual(shouldInject, true);
      assert.strictEqual(idempotencyKey, 'agent-autobiography:task-created');
      assert.ok(prependContext.includes('任务创建提醒'));
    });

    it('M1: task.create 失败时不应触发', () => {
      const event = {
        toolName: 'task.create',
        result: { content: [{ type: 'text', text: '{"error":"prompt 不能为空"}' }] }
      };
      const { shouldInject } = evaluateAfterToolCall(event);
      assert.strictEqual(shouldInject, false);
    });

    it('M2: task.update 含 deviation 时应触发注入', () => {
      const event = {
        toolName: 'task.update',
        result: { content: [{ type: 'text', text: '{"runId":"test-123","status":"active","changed":true,"deviationRecorded":true}' }] }
      };
      const { shouldInject, idempotencyKey, prependContext } = evaluateAfterToolCall(event);

      assert.strictEqual(shouldInject, true);
      assert.strictEqual(idempotencyKey, 'agent-autobiography:deviation-detected');
      assert.ok(prependContext.includes('偏差分析提醒'));
    });

    it('M2: task.update 不含 deviation 时不应触发', () => {
      const event = {
        toolName: 'task.update',
        result: { content: [{ type: 'text', text: '{"runId":"test-123","status":"active","changed":true,"deviationRecorded":false}' }] }
      };
      const { shouldInject } = evaluateAfterToolCall(event);
      assert.strictEqual(shouldInject, false);
    });

    it('M3: event.report 成功时应触发注入', () => {
      const event = {
        toolName: 'event.report',
        result: { content: [{ type: 'text', text: '{"runId":"test-123","eventFilePath":".agents/events/2026-05-26/10-00-00.md"}' }] }
      };
      const { shouldInject, idempotencyKey, prependContext } = evaluateAfterToolCall(event);

      assert.strictEqual(shouldInject, true);
      assert.strictEqual(idempotencyKey, 'agent-autobiography:event-generated');
      assert.ok(prependContext.includes('事件复盘提醒'));
    });

    it('M3: event.report 失败时不应触发', () => {
      const event = {
        toolName: 'event.report',
        result: { content: [{ type: 'text', text: '{"error":"任务不存在"}' }] }
      };
      const { shouldInject } = evaluateAfterToolCall(event);
      assert.strictEqual(shouldInject, false);
    });

    it('非关键工具不应触发', () => {
      const tools = ['task.advance', 'task.get', 'task.archive', 'event.query', 'event.archive'];
      for (const toolName of tools) {
        const event = { toolName, result: { content: [{ type: 'text', text: '{"ok":true}' }] } };
        const { shouldInject } = evaluateAfterToolCall(event);
        assert.strictEqual(shouldInject, false, `${toolName} 不应触发`);
      }
    });

    it('空 result 不应触发', () => {
      const event = { toolName: 'task.create', result: null };
      const { shouldInject } = evaluateAfterToolCall(event);
      assert.strictEqual(shouldInject, false);
    });
  });

  describe('evaluateBeforePromptBuild', () => {
    it('M4: 无 active task 时应触发注入', async () => {
      // 创建一个已完成的归档任务
      const archiveDir = join(tmpDir, '.agents', 'archive', 'tasks');
      mkdirSync(archiveDir, { recursive: true });
      writeFileSync(join(archiveDir, 'completed-task.json'), JSON.stringify({
        runId: 'archived-task',
        status: 'completed'
      }));

      const context = { baseDir: tmpDir };
      const { shouldInject, idempotencyKey, prependContext } = await evaluateBeforePromptBuild(context);

      assert.strictEqual(shouldInject, true);
      assert.strictEqual(idempotencyKey, 'agent-autobiography:no-active-task');
      assert.ok(prependContext.includes('任务创建提醒'));
    });

    it('M4: 有 active task 时不应触发', async () => {
      // 创建一个 active 任务
      const tasksDir = join(tmpDir, '.agents', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, 'active-task.json'), JSON.stringify({
        runId: 'active-task',
        status: 'active'
      }));

      const context = { baseDir: tmpDir };
      const { shouldInject } = await evaluateBeforePromptBuild(context);

      assert.strictEqual(shouldInject, false);
    });

    it('M4: 有 draft task 时不应触发', async () => {
      const tasksDir = join(tmpDir, '.agents', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, 'draft-task.json'), JSON.stringify({
        runId: 'draft-task',
        status: 'draft'
      }));

      const context = { baseDir: tmpDir };
      const { shouldInject } = await evaluateBeforePromptBuild(context);

      assert.strictEqual(shouldInject, false);
    });

    it('M4: 有 pending_approval task 时不应触发', async () => {
      const tasksDir = join(tmpDir, '.agents', 'tasks');
      mkdirSync(tasksDir, { recursive: true });
      writeFileSync(join(tasksDir, 'pending-task.json'), JSON.stringify({
        runId: 'pending-task',
        status: 'pending_approval'
      }));

      const context = { baseDir: tmpDir };
      const { shouldInject } = await evaluateBeforePromptBuild(context);

      assert.strictEqual(shouldInject, false);
    });

    it('目录不存在时应触发', async () => {
      const context = { baseDir: '/non/existent/path' };
      const { shouldInject } = await evaluateBeforePromptBuild(context);

      assert.strictEqual(shouldInject, true);
    });
  });

  describe('REMINDERS', () => {
    it('taskCreated 提醒包含任务创建相关提示', () => {
      assert.ok(REMINDERS.taskCreated.includes('任务创建'));
      assert.ok(REMINDERS.taskCreated.includes('task.create'));
    });

    it('deviationDetected 提醒包含偏差分析相关提示', () => {
      assert.ok(REMINDERS.deviationDetected.includes('偏差'));
      assert.ok(REMINDERS.deviationDetected.includes('归因'));
    });

    it('eventGenerated 提醒包含六维度判断提示', () => {
      assert.ok(REMINDERS.eventGenerated.includes('六维度'));
      assert.ok(REMINDERS.eventGenerated.includes('自我认知'));
    });

    it('noActiveTask 提醒包含创建任务提示', () => {
      assert.ok(REMINDERS.noActiveTask.includes('任务创建提醒'));
      assert.ok(REMINDERS.noActiveTask.includes('task.create'));
    });
  });
});
