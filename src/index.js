/**
 * OpenClaw Agent Self-Development Plugin
 *
 * 纯钩子框架——只注入提醒，不涉及操作
 * Agent 自行决策：偏差判断、文件读写、同化顺应分析、置信度评估
 */

import { dirname } from 'path';

import { State } from './common/adapters/state.js';
import { Task } from './common/adapters/task.js';
import { Flow } from './common/adapters/flow.js';
import { Memory } from './common/adapters/memory.js';
import { Log } from './common/adapters/log.js';
import { Hook } from './common/adapters/hook.js';

import { Metacognition } from './metacognition/metacognition.js';
import { WorkingMemory } from './working-memory/working-memory.js';
import { Personality } from './personality/personality.js';
import { Skills } from './common/skills.js';

// v3 managers
import { Plan } from './metacognition/plan.js';
import { Deviation } from './metacognition/deviation.js';
import { Attribution } from './metacognition/attribution.js';
import { Session } from './working-memory/session.js';
import { Events } from './common/events.js';

const pluginId = 'agent-self-development';

export default {
  id: pluginId,
  name: 'Agent Self-Development',
  version: '3.4.1',
  description: 'OpenClaw plugin for agent self-development based on Piaget\'s cognitive development theory',

  register(api) {
    if (api.registrationMode && api.registrationMode !== 'full') {
      return;
    }

    const config = api.pluginConfig || {};
    const logger = api.logger || console;

    logger.info(`[${pluginId}] Agent Self-Development Plugin v3.4.1 activated`);

    // 检查 conversation hooks 权限
    // OpenClaw 2026.4.21 版本使用 allowPromptInjection 控制对话访问
    const entries = api.config?.plugins?.entries?.[pluginId];
    const hooks = entries?.hooks || {};
    if (hooks.allowConversationAccess !== true && hooks.allowPromptInjection !== true) {
      logger.warn(`[${pluginId}] ⚠️ allowConversationAccess / allowPromptInjection 未启用，元认知功能可能无法工作`);
    }

    // 修复：直接使用 ~/.openclaw 作为基础目录，避免 resolveStateDir 返回错误路径
    const baseDir = '/root/.openclaw';

    // 获取当前代理ID
    const agentId = api.agentId || 'main';
    
    // 使用当前代理的数据库文件
    // 使用已有的系统数据库
    const state = new State(null, {
      dir: `${baseDir}/state/agent-self-development`,
      maxArchivedTasks: config.archive?.maxArchivedTasks
    });
    const task = new Task(null, { dbPath: `${baseDir}/tasks/runs.sqlite` });
    const flow = new Flow(null, { dbPath: `${baseDir}/flows/registry.sqlite` });
    const memory = new Memory(null, { dbPath: `${baseDir}/memory/${agentId}.sqlite` });
    const log = new Log(null, { 
      dir: `${baseDir}/logs`, 
      agentId: agentId 
    });
    const skills = new Skills(undefined, log);
    const hook = new Hook(null, { dir: `${baseDir}/hooks/agent-self-development` });
    // v3: 初始化业务管理器
    const plan = new Plan(state, flow);
    const deviation = new Deviation(state);
    const attribution = new Attribution(state, flow);
    const session = new Session(state, flow, null);
    const events = new Events(state, memory);
    const metacognition = new Metacognition({
      api, config: config.metacognition, state, skills, logger, log,
      plan, deviation, attribution
    });
    const workingMemory = new WorkingMemory({
      api, config: config.workingMemory, state, skills, logger, log,
      session, events
    });
    const personality = new Personality({
      api, config: config.personality, state, skills, logger, log
    });

    metacognition.register();
    workingMemory.register();
    personality.register();

    logger.info(`[${pluginId}] 全部已注册（元认知 / 工作记忆 / 人格）`);
  }
};
