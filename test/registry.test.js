/**
 * Registry & Adapter Test — v4.3.0
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { registerTools } from '../src/tools/index.js';
import { TOOL_SCHEMAS, ALL_TOOLS } from '../src/tools/schemas.js';
import { adaptReturn, adaptError } from '../src/tools/return-adapter.js';

const tmpDir = join(tmpdir(), 'asd-registry-test-' + Date.now());
const origCwd = process.cwd();

function createMockApi() {
  const tools = new Map();
  return {
    registerTool: (factory, _options) => {
      // factory 是 (_ctx) => ({ name, description, parameters, execute })
      const spec = factory();
      tools.set(spec.name, spec);
    },
    getTool: (name) => tools.get(name),
    tools
  };
}

describe('registry & adapter', () => {
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

  describe('registerTools', () => {
    it('registers all 8 tools', () => {
      const api = createMockApi();
      registerTools(api);
      assert.strictEqual(api.tools.size, 8);
      for (const name of ALL_TOOLS) {
        assert.ok(api.tools.has(name), `Missing tool: ${name}`);
      }
    });

    it('each tool has correct schema fields', () => {
      const api = createMockApi();
      registerTools(api);
      for (const name of ALL_TOOLS) {
        const tool = api.tools.get(name);
        assert.ok(tool.name, `${name} missing name`);
        assert.ok(tool.description, `${name} missing description`);
        assert.ok(tool.parameters, `${name} missing parameters`);
        assert.strictEqual(typeof tool.execute, 'function', `${name} missing execute`);
      }
    });

    it('task_create parameters require baseDir and prompt', () => {
      const api = createMockApi();
      registerTools(api);
      const schema = api.tools.get('task_create').parameters;
      assert.deepStrictEqual(schema.required.sort(), ['baseDir', 'prompt'].sort());
    });

    it('task_update parameters require baseDir and runId', () => {
      const api = createMockApi();
      registerTools(api);
      const schema = api.tools.get('task_update').parameters;
      assert.deepStrictEqual(schema.required.sort(), ['baseDir', 'runId'].sort());
    });

    it('execute returns correct format on success', async () => {
      const api = createMockApi();
      registerTools(api);
      const tool = api.tools.get('task_create');
      const result = await tool.execute('id-1', { prompt: 'Test registry', baseDir: process.cwd() });
      assert.ok(result.content);
      assert.strictEqual(result.content[0].type, 'text');
      const parsed = JSON.parse(result.content[0].text);
      assert.ok(parsed.runId);
      assert.strictEqual(parsed.status, 'draft');
    });

    it('execute returns error format on failure', async () => {
      const api = createMockApi();
      registerTools(api);
      const tool = api.tools.get('task_get');
      const result = await tool.execute('id-1', { runId: 'no-such-task', baseDir: process.cwd() });
      assert.ok(result.isError);
      assert.ok(result.content[0].text.includes('error'));
    });

    it('event_report updates task eventFilePath', async () => {
      const api = createMockApi();
      registerTools(api);
      const baseDir = process.cwd();

      const createTool = api.tools.get('task_create');
      const updateTool = api.tools.get('task_update');
      const reportTool = api.tools.get('event_report');
      const getTool = api.tools.get('task_get');

      const created = await createTool.execute('id-1', { prompt: 'Test report', baseDir });
      const { runId } = JSON.parse(created.content[0].text);

      await updateTool.execute('id-2', { runId, status: 'pending_approval', baseDir });
      await updateTool.execute('id-3', { runId, status: 'active', baseDir });
      await updateTool.execute('id-4', { runId, status: 'completed', baseDir });

      const reported = await reportTool.execute('id-5', { runId, baseDir });
      const reportResult = JSON.parse(reported.content[0].text);
      assert.ok(reportResult.eventFilePath);

      const got = await getTool.execute('id-6', { runId, baseDir });
      const task = JSON.parse(got.content[0].text);
      assert.strictEqual(task.eventFilePath, reportResult.eventFilePath);
    });

    it('event_archive archives event file', async () => {
      const api = createMockApi();
      registerTools(api);
      const baseDir = process.cwd();

      const createTool = api.tools.get('task_create');
      const updateTool = api.tools.get('task_update');
      const reportTool = api.tools.get('event_report');
      const archiveEventTool = api.tools.get('event_archive');

      const created = await createTool.execute('id-1', { prompt: 'Test archive', baseDir });
      const { runId } = JSON.parse(created.content[0].text);

      await updateTool.execute('id-2', { runId, status: 'pending_approval', baseDir });
      await updateTool.execute('id-3', { runId, status: 'active', baseDir });
      await updateTool.execute('id-4', { runId, status: 'completed', baseDir });
      await reportTool.execute('id-5', { runId, baseDir });

      const archived = await archiveEventTool.execute('id-6', { runId, baseDir });
      const archiveResult = JSON.parse(archived.content[0].text);
      assert.ok(archiveResult.archivePath);
    });
  });

  describe('adaptReturn', () => {
    it('wraps result in content array', () => {
      const result = adaptReturn({ foo: 'bar' });
      assert.deepStrictEqual(result, {
        content: [{ type: 'text', text: '{"foo":"bar"}' }]
      });
    });

    it('supports pretty mode', () => {
      const result = adaptReturn({ foo: 'bar' }, { pretty: true });
      assert.ok(result.content[0].text.includes('\n'));
    });

    it('handles circular reference gracefully', () => {
      const obj = {};
      obj.self = obj;
      const result = adaptReturn(obj);
      assert.ok(result.isError);
      assert.ok(result.content[0].text.includes('error'));
    });
  });

  describe('adaptError', () => {
    it('wraps Error instance', () => {
      const result = adaptError(new Error('Something broke'));
      assert.strictEqual(result.isError, true);
      assert.ok(result.content[0].text.includes('Something broke'));
    });

    it('wraps string error', () => {
      const result = adaptError('Plain string error');
      assert.strictEqual(result.isError, true);
      assert.ok(result.content[0].text.includes('Plain string error'));
    });
  });
});
