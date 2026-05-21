/**
 * Utils Test — v4.3.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, writeFileSync, accessSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { taskPath, eventPath, eventsDir } from '../src/utils/resolve.js';
import { ensureDir, readJson, writeJson, writeMarkdown, fileExists, readText } from '../src/utils/io.js';
import { validateRunId, validateStatus, isValidStatusTransition } from '../src/utils/validate.js';
import { getNow, generateRunId, inferSessionType, inferTaskFamily, generatePlan, renderTemplate } from '../src/utils/helpers.js';

describe('utils', () => {
  const tmpDir = join(tmpdir(), 'asd-utils-test-' + Date.now());

  describe('resolve.js', () => {
    it('taskPath returns correct path', () => {
      assert.strictEqual(taskPath('/base', 'abc-123'), join('/base', '.agents', 'tasks', 'abc-123.json'));
    });

    it('eventsDir returns correct path', () => {
      assert.strictEqual(eventsDir('/base'), join('/base', '.agents', 'events'));
    });

    it('eventPath returns correct path from date', () => {
      const path = eventPath('/base', 'run-1', '2026-05-20');
      assert.strictEqual(path, join('/base', '.agents', 'events', '2026-05-20', 'run-1.md'));
    });
  });

  describe('validate.js', () => {
    it('validateRunId accepts valid runId', () => {
      assert.doesNotThrow(() => validateRunId('valid-id_123'));
    });

    it('validateRunId rejects empty', () => {
      assert.throws(() => validateRunId(''), /不能为空/);
      assert.throws(() => validateRunId(null), /不能为空/);
      assert.throws(() => validateRunId(undefined), /不能为空/);
    });

    it('validateRunId rejects illegal chars', () => {
      assert.throws(() => validateRunId('a/b'), /非法字符/);
      assert.throws(() => validateRunId('a\\b'), /非法字符/);
      assert.throws(() => validateRunId('a*b'), /非法字符/);
      assert.throws(() => validateRunId('a?b'), /非法字符/);
      assert.throws(() => validateRunId('a:b'), /非法字符/);
      assert.throws(() => validateRunId('a"b'), /非法字符/);
      assert.throws(() => validateRunId('a<b'), /非法字符/);
      assert.throws(() => validateRunId('a>b'), /非法字符/);
      assert.throws(() => validateRunId('a|b'), /非法字符/);
    });

    it('validateStatus accepts valid statuses', () => {
      for (const s of ['draft', 'pending_approval', 'active', 'revising', 'completed']) {
        assert.doesNotThrow(() => validateStatus(s));
      }
    });

    it('validateStatus rejects invalid status', () => {
      assert.throws(() => validateStatus('deleted'), /无效状态/);
      assert.throws(() => validateStatus(''), /无效状态/);
    });

    it('isValidStatusTransition covers all valid paths', () => {
      assert.strictEqual(isValidStatusTransition('draft', 'pending_approval'), true);
      assert.strictEqual(isValidStatusTransition('pending_approval', 'active'), true);
      assert.strictEqual(isValidStatusTransition('active', 'revising'), true);
      assert.strictEqual(isValidStatusTransition('active', 'completed'), true);
      assert.strictEqual(isValidStatusTransition('revising', 'draft'), true);
    });

    it('isValidStatusTransition rejects invalid paths', () => {
      assert.strictEqual(isValidStatusTransition('draft', 'active'), false);
      assert.strictEqual(isValidStatusTransition('draft', 'completed'), false);
      assert.strictEqual(isValidStatusTransition('active', 'draft'), false);
      assert.strictEqual(isValidStatusTransition('completed', 'active'), false);
      assert.strictEqual(isValidStatusTransition('completed', 'archived'), false);
      assert.strictEqual(isValidStatusTransition('unknown', 'draft'), false);
    });
  });

  describe('helpers.js', () => {
    it('getNow returns ISO string', () => {
      const now = getNow();
      assert.ok(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(now));
    });

    it('generateRunId is unique', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRunId());
      }
      assert.strictEqual(ids.size, 100);
    });

    it('inferSessionType detects coding', () => {
      assert.strictEqual(inferSessionType('开发一个项目'), 'PROJECT');
      assert.strictEqual(inferSessionType('Write some code'), 'PROJECT');
    });

    it('inferSessionType detects research', () => {
      assert.strictEqual(inferSessionType('调研一下'), 'RESEARCH');
      assert.strictEqual(inferSessionType('文献综述'), 'RESEARCH');
    });

    it('inferSessionType detects writing', () => {
      assert.strictEqual(inferSessionType('写一份报告'), 'WRITING');
      assert.strictEqual(inferSessionType('撰写论文'), 'WRITING');
    });

    it('inferSessionType defaults to TASK', () => {
      assert.strictEqual(inferSessionType('随便做点什么'), 'TASK');
    });

    it('inferTaskFamily detects CODE', () => {
      assert.strictEqual(inferTaskFamily('编写代码逻辑'), 'CODE');
    });

    it('inferTaskFamily detects RESEARCH', () => {
      assert.strictEqual(inferTaskFamily('搜索相关文献'), 'RESEARCH');
    });

    it('inferTaskFamily detects ANALYSIS', () => {
      assert.strictEqual(inferTaskFamily('数据分析'), 'ANALYSIS');
    });

    it('inferTaskFamily detects WRITING', () => {
      assert.strictEqual(inferTaskFamily('写文档'), 'WRITING');
    });

    it('inferTaskFamily detects TEST', () => {
      assert.strictEqual(inferTaskFamily('测试功能'), 'TEST');
    });

    it('inferTaskFamily detects DESIGN', () => {
      assert.strictEqual(inferTaskFamily('设计架构'), 'DESIGN');
    });

    it('inferTaskFamily defaults to TASK', () => {
      assert.strictEqual(inferTaskFamily(''), 'TASK');
    });

    it('generatePlan returns coding plan for code prompt', () => {
      const plan = generatePlan('实现一个代码功能');
      assert.strictEqual(plan.execution.phases[0].name, '需求分析');
      assert.ok(plan.workspace.tools.includes('editor'));
    });

    it('generatePlan returns writing plan for writing prompt', () => {
      const plan = generatePlan('撰写报告');
      assert.strictEqual(plan.execution.phases[0].name, '素材收集');
    });

    it('generatePlan returns research plan for research prompt', () => {
      const plan = generatePlan('调查研究');
      assert.strictEqual(plan.execution.phases[0].name, '目标界定');
    });

    it('generatePlan returns default plan for generic prompt', () => {
      const plan = generatePlan('做点事');
      assert.strictEqual(plan.execution.phases[0].name, '目标理解');
      assert.strictEqual(plan.workspace.tools.length, 0);
    });

    it('renderTemplate replaces placeholders', () => {
      const result = renderTemplate('Hello {{name}}, {{age}}', { name: 'World', age: '42' });
      assert.strictEqual(result, 'Hello World, 42');
    });

    it('renderTemplate leaves missing placeholders empty', () => {
      const result = renderTemplate('Hello {{name}}, {{missing}}', { name: 'World' });
      assert.strictEqual(result, 'Hello World, ');
    });
  });

  describe('io.js', () => {
    it('ensureDir creates nested directories', async () => {
      const dir = join(tmpDir, 'a', 'b', 'c');
      await ensureDir(dir);
      assert.ok(accessSync(dir) === undefined || true);
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writeJson and readJson roundtrip', async () => {
      mkdirSync(tmpDir, { recursive: true });
      const file = join(tmpDir, 'test.json');
      const data = { foo: 'bar', num: 42 };
      await writeJson(file, data);
      const result = await readJson(file);
      assert.deepStrictEqual(result, data);
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writeMarkdown writes file', async () => {
      mkdirSync(tmpDir, { recursive: true });
      const file = join(tmpDir, 'test.md');
      await writeMarkdown(file, '# Hello');
      const content = await readText(file);
      assert.strictEqual(content, '# Hello');
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('fileExists returns true for existing file', async () => {
      mkdirSync(tmpDir, { recursive: true });
      const file = join(tmpDir, 'exists.txt');
      writeFileSync(file, 'x');
      assert.strictEqual(await fileExists(file), true);
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('fileExists returns false for missing file', async () => {
      assert.strictEqual(await fileExists(join(tmpDir, 'missing.txt')), false);
    });

    it('readJson throws on invalid JSON', async () => {
      mkdirSync(tmpDir, { recursive: true });
      const file = join(tmpDir, 'bad.json');
      writeFileSync(file, 'not json');
      await assert.rejects(readJson(file), /Unexpected token/);
      rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
