/**
 * 测试辅助工具 —— Mock 工厂
 */

export function createMockLogger() {
  const calls = [];
  return {
    info: (...args) => calls.push(['info', ...args]),
    warn: (...args) => calls.push(['warn', ...args]),
    error: (...args) => calls.push(['error', ...args]),
    debug: (...args) => calls.push(['debug', ...args]),
    _calls: calls
  };
}

export function createMockLog() {
  return {
    write: async () => {}
  };
}

export function createMockState() {
  const tasks = new Map();
  const sessions = new Map();
  return {
    getTask: async (runId) => tasks.get(runId) || null,
    saveTask: async (runId, task) => { tasks.set(runId, task); },
    getSession: async (sessionId) => sessions.get(sessionId) || null,
    saveSession: async (sessionId, session) => { sessions.set(sessionId, session); },
    listTasks: async () => Array.from(tasks.values()),
    listSessions: async () => Array.from(sessions.values()),
    archiveTask: async (runId) => { tasks.delete(runId); return true; },
    close: async () => {}
  };
}

export function createMockSkills(skillMap = {}) {
  return {
    load: async (name) => skillMap[name] || null
  };
}

export function createMockMemory() {
  const eventLogs = new Map();
  return {
    appendEventLog: async (date, log) => {
      const arr = eventLogs.get(date) || [];
      arr.push(log);
      eventLogs.set(date, arr);
    },
    getEventLog: async (date) => eventLogs.get(date) || [],
    close: async () => {}
  };
}

export function createMockApi() {
  const hooks = new Map();
  return {
    on: (name, handler, opts) => {
      if (!hooks.has(name)) hooks.set(name, []);
      hooks.get(name).push({ handler, opts });
    },
    _hooks: hooks,
    _emit: async (name, event, ctx) => {
      const list = hooks.get(name) || [];
      const results = [];
      for (const { handler } of list) {
        results.push(await handler(event, ctx));
      }
      return results;
    }
  };
}

export function createMockCtx(runId = 'test-run') {
  return { runId, state: {} };
}
