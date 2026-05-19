/**
 * Tool Registry — v4.3.0 Object-Driven Layer
 *
 * 统一注册入口 registerTools(api, deps)。
 * 仅支持新注册方式：api.registerTool({ name, description, parameters, execute })
 * 仅注册命名空间工具，不保留任何旧工具名或向后兼容层。
 */

import { TOOL_SCHEMAS, ALL_TOOLS } from './schemas.js';
import { adaptReturn, adaptError } from './return-adapter.js';
import { recordTrace } from '../common/cognitive-trace.js';
import { renderTemplate } from '../common/template-engine.js';

/**
 * 注册所有命名空间 tools 到 api
 * @param {Object} api - OpenClaw api 对象
 * @param {Object} deps - 依赖注入
 */
export function registerTools(api, deps) {
  if (!api || typeof api.registerTool !== 'function') {
    deps.logger?.warn?.('[Tools] api.registerTool 不可用，无法注册 tools');
    return;
  }

  const handlers = createNamespaceHandlers(deps);

  for (const toolName of ALL_TOOLS) {
    const schema = TOOL_SCHEMAS[toolName];
    const handler = handlers[toolName];

    if (!schema || !handler) {
      deps.logger?.warn?.(`[Tools] 跳过未实现的 tool: ${toolName}`);
      continue;
    }

    // v4.3.0: 新注册方式，使用 parameters 和 execute(_id, params)
    api.registerTool({
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
      execute: async (_id, params) => {
        const runId = params?.runId || 'default';
        try {
          const result = await handler(params);
          // 异步记录认知轨迹（不 await，不阻塞主流程）
          recordTrace(toolName, params, result, runId);
          deps.logger?.debug?.(`[Tools] ${toolName} 调用成功`);
          return adaptReturn(result);
        } catch (err) {
          const errorMsg = err.message || String(err);
          recordTrace(toolName, params, { error: errorMsg }, runId);
          deps.logger?.error?.(`[Tools] ${toolName} 调用失败: ${errorMsg}`);
          return adaptError(errorMsg);
        }
      }
    });

    deps.logger?.debug?.(`[Tools] 注册 tool: ${toolName}`);
  }

  deps.logger?.info?.(`[Tools] 已注册 ${ALL_TOOLS.length} 个命名空间 tools`);
}

/**
 * 创建所有命名空间工具的处理函数
 */
function createNamespaceHandlers(deps) {
  const { taskObject, eventObject, state, skills, logger } = deps;

  // ── task.* 命名空间 — 直接委托 TaskObject ──

  async function taskCreate(params) {
    return taskObject.create(params);
  }

  async function taskUpdate(params) {
    return taskObject.update(params);
  }

  async function taskAdvance(params) {
    return taskObject.advance(params);
  }

  async function taskQuery(params) {
    return taskObject.get(params?.runId);
  }

  async function taskFiles(params) {
    return taskObject.getFiles(params?.runId);
  }

  async function taskDiagnose(params) {
    return taskObject.diagnose(params?.runId);
  }

  async function taskArchive(params) {
    return taskObject.archive(params?.runId);
  }

  async function taskArchive(params) {
    return taskObject.archive(params?.runId);
  }

  async function taskDeviate(params) {
    return taskObject.deviate(params);
  }

  async function taskAttribute(params) {
    return taskObject.attribute(params);
  }

  // ── event.* 命名空间 — 直接委托 EventObject ──

  async function eventRecord(params) {
    return eventObject.record(params);
  }

  async function eventQuery(params) {
    return eventObject.query(params || {});
  }

  // ── guide.* 命名空间 — Skills + 模板渲染 ──

  async function guidePlanning(params) {
    const { phase, taskType } = params || {};
    if (!phase) {
      return { error: '缺少 phase 参数' };
    }

    const skillName = (taskType && ['coding', 'research', 'documentation'].includes(taskType))
      ? taskType
      : 'planning';
    const planningSkill = await skills.load(skillName);
    if (!planningSkill) {
      return { error: `${skillName} skill 加载失败` };
    }

    const phaseHints = {
      assessment: '【当前阶段】评估任务复杂度，决定是否制定 Plan。',
      draft: '【当前阶段】制定完整 Plan 并汇报给用户。',
      pending_approval: '【当前阶段】处理用户反馈（确认/修改/取消）。',
      active: '【当前阶段】按 phases 执行，推进任务。',
      revising: '【当前阶段】修订 Plan，重新制定并汇报。'
    };

    let guide = renderTemplate(planningSkill, { phase, phaseHint: phaseHints[phase] || '' });
    guide = `${guide}\n\n${phaseHints[phase] || ''}`;

    const effectiveTaskType = ['coding', 'research', 'documentation'].includes(taskType) ? taskType : 'default';
    logger?.debug?.(`[Tools] guide.planning: phase=${phase}, taskType=${effectiveTaskType}`);
    return { guide, phase, taskType: effectiveTaskType };
  }

  async function guideMonitoring(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const taskResult = await state.getTask(runId);
    if (!taskResult) {
      return { error: `task 不存在: ${runId}` };
    }
    const task = taskResult.task || taskResult; // 兼容 State 直接返回 task 对象

    const monitoringSkill = await skills.load('monitoring');
    const currentPhase = task.plan?.execution?.currentPhase ?? 0;
    const phases = task.plan?.execution?.phases || [];
    const historyDeviations = task.deviations || [];

    let guide = renderTemplate(monitoringSkill, {
      task, runId, currentPhase, totalPhases: phases.length, historyDeviations
    }) || (monitoringSkill || '【Monitoring】偏差预防提醒 + 自我监控指引。');

    guide += `\n\n【当前状态】\n- runId: ${runId}\n- 当前阶段: ${currentPhase + 1}/${phases.length}\n- 历史偏差: ${historyDeviations.length} 条`;

    if (historyDeviations.length > 0) {
      guide += '\n【历史偏差】';
      for (const d of historyDeviations) {
        guide += `\n- ${d.type}: ${d.description?.slice(0, 100)}`;
      }
    }

    logger?.debug?.(`[Tools] guide.monitoring: runId=${runId}, phase=${currentPhase}`);
    return { guide, currentPhase, totalPhases: phases.length, historyDeviations };
  }

  async function guideRegulation(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const taskResult = await state.getTask(runId);
    if (!taskResult) {
      return { error: `task 不存在: ${runId}` };
    }
    const task = taskResult.task || taskResult;

    const deviations = task.deviations || [];
    const unattributed = deviations.filter(d => !d.attributed);

    if (unattributed.length === 0) {
      return {
        available: false,
        reason: '无未处理偏差，regulation 指导当前不可用',
        deviationCount: deviations.length
      };
    }

    const regulationSkill = await skills.load('regulation');
    let guide = renderTemplate(regulationSkill, {
      task, runId, deviations, unattributed
    }) || (regulationSkill || '【Regulation】偏差分析与调节指导。');

    guide += `\n\n【偏差摘要】\n- 总偏差数: ${deviations.length}\n- 未归因偏差: ${unattributed.length}`;
    for (const d of unattributed) {
      guide += `\n- [${d.type}] ${d.description?.slice(0, 100)}`;
    }

    logger?.debug?.(`[Tools] guide.regulation: runId=${runId}, unattributed=${unattributed.length}`);
    return { guide, available: true, deviationCount: deviations.length, unattributedCount: unattributed.length };
  }

  async function guideDevelopment(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const taskResult = await state.getTask(runId);
    if (!taskResult) {
      return { error: `task 不存在: ${runId}` };
    }
    const task = taskResult.task || taskResult;

    const developmentSkill = await skills.load('development');
    const deviations = task.deviations || [];
    const attributions = task.attributions || [];
    const outcome = task.outcome || {};

    let guide = renderTemplate(developmentSkill, {
      task, runId, deviations, attributions, outcome
    }) || (developmentSkill || '【Development】任务完成后分析同化/顺应，更新人格。');

    guide += `\n\n【Event 摘要】\n- runId: ${runId}\n- 状态: ${task.status}\n- 偏差记录: ${deviations.length} 条\n- 归因记录: ${attributions.length} 条`;
    if (outcome.archivedAt) {
      guide += `\n- 归档时间: ${outcome.archivedAt}`;
    }

    logger?.debug?.(`[Tools] guide.development: runId=${runId}, status=${task.status}`);
    return { guide, status: task.status, deviationCount: deviations.length, attributionCount: attributions.length };
  }

  return {
    'task.create': taskCreate,
    'task.update': taskUpdate,
    'task.advance': taskAdvance,
    'task.query': taskQuery,
    'task.files': taskFiles,
    'task.diagnose': taskDiagnose,
    'task.archive': taskArchive,
    'task.deviate': taskDeviate,
    'task.attribute': taskAttribute,
    'event.record': eventRecord,
    'event.query': eventQuery,
    'guide.planning': guidePlanning,
    'guide.monitoring': guideMonitoring,
    'guide.regulation': guideRegulation,
    'guide.development': guideDevelopment
  };
}

export { TOOL_SCHEMAS, ALL_TOOLS };
