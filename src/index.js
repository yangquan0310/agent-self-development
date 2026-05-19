/**
 * OpenClaw Agent Self-Development Plugin
 *
 * 纯钩子框架——只注入提醒，不涉及操作
 * Agent 自行决策：偏差判断、文件读写、同化顺应分析、置信度评估
 */

import { join } from 'path';
import { readFileSync } from 'fs';
import { getBaseDir, getSystemStateDir, getSystemLogsDir, getSystemMemoryDir, getSystemFlowsDir } from './common/project-context.js';
import { State } from './common/adapters/state.js';
import { Flow } from './common/adapters/flow.js';
import { Memory } from './common/adapters/memory.js';
import { Log } from './common/adapters/log.js';
import { CaseIndex } from './common/case-index.js';

import { Metacognition } from './metacognition/module.js';
import { WorkingMemory } from './working-memory/module.js';
import { Personality } from './personality/module.js';
import { Skills } from './common/skills.js';
import { Heartbeat } from './common/heartbeat.js';
import { registerTools } from './tools/index.js';
import { TaskObject, EventObject } from './objects/index.js';

// v3 managers
import { Plan } from './metacognition/plan.js';
import { Deviation } from './metacognition/deviation.js';
import { Attribution } from './metacognition/attribution.js';
import { Session } from './working-memory/session.js';
import { Event } from './metacognition/event.js';

const pluginId = 'agent-self-development';

// v4.3.0: 加载 assets 模板
let eventTemplate = '';
let taskSchema = {};
try {
  eventTemplate = readFileSync(new URL('./assets/event.md', import.meta.url), 'utf-8');
} catch (err) {
  // 静默失败，EventObject 使用默认模板
}
try {
  taskSchema = JSON.parse(readFileSync(new URL('./assets/task.json', import.meta.url), 'utf-8'));
} catch (err) {
  // 静默失败，TaskObject 使用内置校验
}

export default {
  id: pluginId,
  name: 'Agent Self-Development',
  version: '4.3.0',
  description: 'OpenClaw plugin for agent self-development based on Piaget\'s cognitive development theory',

  register(api) {
    if (api.registrationMode && api.registrationMode !== 'full') {
      return;
    }

    const config = api.pluginConfig || {};
    const logger = api.logger || console;

    logger.info(`[${pluginId}] Agent Self-Development Plugin v4.3.0 activated`);

    // 检查 conversation hooks 权限
    const entries = api.config?.plugins?.entries?.[pluginId];
    const hooks = entries?.hooks || {};
    if (hooks.allowConversationAccess !== true && hooks.allowPromptInjection !== true) {
      logger.warn(`[${pluginId}] ⚠️ allowConversationAccess / allowPromptInjection 未启用，元认知功能可能无法工作`);
    }

    const baseDir = getBaseDir();
    const agentId = api.agentId || 'main';

    const state = new State(null, {
      dir: getSystemStateDir(),
      maxArchivedTasks: config.archive?.maxArchivedTasks
    });
    const flow = new Flow(null, { dbPath: join(getSystemFlowsDir(), 'registry.sqlite') });
    const memory = new Memory(null, { dbPath: join(getSystemMemoryDir(), `${agentId}.sqlite`) });
    const log = new Log(null, {
      dir: getSystemLogsDir(),
      agentId: agentId
    });
    const caseIndex = new CaseIndex(null, {
      dbPath: join(baseDir, 'state', 'case-index.sqlite'),
      maxArchivedTasks: config.archive?.maxArchivedTasks
    });
    const skills = new Skills(undefined, log);

    // v3: 初始化业务管理器
    const plan = new Plan(state, flow);
    const deviation = new Deviation(state);
    const attribution = new Attribution(state, flow);
    const session = new Session(state, flow, null);
    const event = new Event(state, memory);

    // v4.3.0: 初始化核心对象（Object-Driven Layer）
    const taskObject = new TaskObject({
      state,
      logger,
      log,
      caseIndex,
      events: event,
      maxArchivedTasks: config.archive?.maxArchivedTasks,
      taskSchema
    });
    const eventObject = new EventObject({
      logger,
      eventTemplate,
      projectRoot: process.cwd()
    });

    const metacognition = new Metacognition({
      api, config: config.metacognition, state, skills, logger, log,
      plan, deviation, attribution,
      injectionMode: config.injectionMode || 'tool-driven'
    });
    const workingMemory = new WorkingMemory({
      api, config: config.workingMemory, state, skills, logger, log,
      session, event
    });
    const personality = new Personality({
      api, config: config.personality, state, skills, logger, log
    });
    const heartbeat = new Heartbeat({
      api, config: config.heartbeat, state, memory, logger, log
    });

    metacognition.register();
    workingMemory.register();
    personality.register();
    heartbeat.register();

    // v4.3.0: 注册命名空间 tools（Object-Driven Layer）
    registerTools(api, {
      state, skills, logger, log, events: event, caseIndex,
      taskObject, eventObject
    });

    // v3.5.0: Gateway 生命周期钩子
    api.on('gateway_stop', async () => {
      logger.info(`[${pluginId}] Gateway stopping, cleaning up resources...`);
      try {
        metacognition.stop();
        workingMemory.stop();
        personality.stop();
        heartbeat.stop();
        if (memory && typeof memory.close === 'function') {
          await memory.close();
        }
        if (state && typeof state.close === 'function') {
          await state.close();
        }
        if (flow && typeof flow.close === 'function') {
          flow.close();
        }
        logger.info(`[${pluginId}] Cleanup completed`);
      } catch (err) {
        logger.error(`[${pluginId}] Cleanup error: ${err.message}`);
      }
    });

    logger.info(`[${pluginId}] 全部已注册（元认知 / 工作记忆 / 人格 / 心跳 / 对象层）`);
  }
};
