/**
 * Metacognition Tools — v4.1.0
 *
 * 元认知相关的查询型和操作型 Tool。
 * 被动响应：只在 Agent 调用时执行。
 */

import { promises as fs } from 'fs';
import { generatePlan, assignSessionsToPhases, getNow } from '../common/utils.js';

/**
 * 构建 metacognition tools 实例
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.state - State 实例
 * @param {Object} deps.skills - Skills 实例
 * @param {Object} deps.logger - Logger 实例
 * @param {Object} deps.log - Log 实例
 */
export function createMetacognitionTools({ state, skills, logger, log }) {

  // ── 查询型 Tools ──

  async function get_planning_guide(params) {
    const { phase } = params || {};
    if (!phase) {
      return { error: '缺少 phase 参数' };
    }

    const planningSkill = await skills.load('planning');
    if (!planningSkill) {
      return { error: 'planning skill 加载失败' };
    }

    let guide = planningSkill;

    // 根据 phase 附加阶段特定提示
    const phaseHints = {
      assessment: '【当前阶段】评估任务复杂度，决定是否制定 Plan。',
      draft: '【当前阶段】制定完整 Plan 并汇报给用户。',
      pending_approval: '【当前阶段】处理用户反馈（确认/修改/取消）。',
      active: '【当前阶段】按 phases 执行，推进任务。',
      revising: '【当前阶段】修订 Plan，重新制定并汇报。'
    };

    guide = `${guide}\n\n${phaseHints[phase] || ''}`;

    logger?.debug?.(`[Tools] get_planning_guide: phase=${phase}`);
    return { guide, phase };
  }

  async function get_monitoring_guide(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const monitoringSkill = await skills.load('monitoring');
    const currentPhase = task.plan?.execution?.currentPhase ?? 0;
    const phases = task.plan?.execution?.phases || [];
    const historyDeviations = task.deviations || [];

    let guide = monitoringSkill || '【Monitoring】偏差预防提醒 + 自我监控指引。';

    guide += `\n\n【当前状态】\n- runId: ${runId}\n- 当前阶段: ${currentPhase + 1}/${phases.length}\n- 历史偏差: ${historyDeviations.length} 条`;

    if (historyDeviations.length > 0) {
      guide += '\n【历史偏差】';
      for (const d of historyDeviations) {
        guide += `\n- ${d.type}: ${d.description?.slice(0, 100)}`;
      }
    }

    logger?.debug?.(`[Tools] get_monitoring_guide: runId=${runId}, phase=${currentPhase}`);
    return { guide, currentPhase, totalPhases: phases.length, historyDeviations };
  }

  async function get_regulation_guide(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    // 条件可用：存在未处理偏差时返回
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
    let guide = regulationSkill || '【Regulation】偏差分析与调节指导。';

    guide += `\n\n【偏差摘要】\n- 总偏差数: ${deviations.length}\n- 未归因偏差: ${unattributed.length}`;
    for (const d of unattributed) {
      guide += `\n- [${d.type}] ${d.description?.slice(0, 100)}`;
    }

    logger?.debug?.(`[Tools] get_regulation_guide: runId=${runId}, unattributed=${unattributed.length}`);
    return { guide, available: true, deviationCount: deviations.length, unattributedCount: unattributed.length };
  }

  async function get_development_guide(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    // 条件可用：task=completed 时最有意义，但其他状态也返回
    const developmentSkill = await skills.load('development');
    let guide = developmentSkill || '【Development】任务完成后分析同化/顺应，更新人格。';

    const deviations = task.deviations || [];
    const attributions = task.attributions || [];
    const outcome = task.outcome || {};

    guide += `\n\n【Event 摘要】\n- runId: ${runId}\n- 状态: ${task.status}\n- 偏差记录: ${deviations.length} 条\n- 归因记录: ${attributions.length} 条`;
    if (outcome.archivedAt) {
      guide += `\n- 归档时间: ${outcome.archivedAt}`;
    }

    logger?.debug?.(`[Tools] get_development_guide: runId=${runId}, status=${task.status}`);
    return { guide, status: task.status, deviationCount: deviations.length, attributionCount: attributions.length };
  }

  // ── 操作型 Tools ──

  async function create_plan(params) {
    const { runId, prompt, planInput } = params || {};
    if (!runId || !prompt) {
      return { error: '缺少 runId 或 prompt 参数' };
    }

    const existing = await state.getTask(runId);
    if (existing) {
      return { error: `task 已存在: ${runId}` };
    }

    let task;
    if (planInput && planInput.phases) {
      // Agent 提供了完整 planInput
      task = {
        runId,
        status: 'draft',
        createdAt: getNow(),
        updatedAt: getNow(),
        plan: {
          prompt: prompt.slice(0, 500),
          createdAt: Date.now(),
          context: {
            goal: planInput.goal || '',
            constraints: planInput.constraints || [],
            successCriteria: planInput.successCriteria || []
          },
          workspace: {
            artifacts: [],
            tools: [],
            skills: []
          },
          execution: {
            phases: planInput.phases.map((ph, idx) => ({
              id: ph.id || `p${idx + 1}`,
              name: ph.name || `阶段 ${idx + 1}`,
              goal: ph.goal || '',
              outputs: ph.outputs || [],
              status: ph.status || 'pending'
            })),
            currentPhase: 0
          }
        },
        deviations: [],
        attributions: [],
        sessionIds: [],
        tools: []
      };
    } else {
      // 使用模板生成
      const planTemplate = generatePlan(prompt);
      const phases = assignSessionsToPhases(planTemplate.execution.phases, prompt);
      task = {
        runId,
        status: 'draft',
        createdAt: getNow(),
        updatedAt: getNow(),
        plan: {
          prompt: prompt.slice(0, 500),
          createdAt: Date.now(),
          context: planTemplate.context,
          workspace: planTemplate.workspace,
          execution: {
            phases,
            currentPhase: 0
          }
        },
        deviations: [],
        attributions: [],
        sessionIds: [],
        tools: []
      };
    }

    await state.saveTask(runId, task);

    logger?.info?.(`[Tools] create_plan: runId=${runId}, phases=${task.plan.execution.phases.length}`);
    if (log) {
      await log.write({
        level: 'INFO',
        module: 'Tools',
        runId,
        message: `create_plan: ${task.plan.execution.phases.length} phases`,
        extra: { status: 'draft', phaseCount: task.plan.execution.phases.length }
      });
    }

    return { task, success: true };
  }

  async function update_task_status(params) {
    const { runId, status, reason } = params || {};
    if (!runId || !status) {
      return { error: '缺少 runId 或 status 参数' };
    }

    const validStatuses = ['draft', 'pending_approval', 'active', 'revising', 'completed'];
    if (!validStatuses.includes(status)) {
      return { error: `无效状态: ${status}，有效值: ${validStatuses.join(', ')}` };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    task.status = status;
    if (reason) {
      task.revisionReason = reason;
    }
    task.updatedAt = getNow();
    await state.saveTask(runId, task);

    logger?.info?.(`[Tools] update_task_status: runId=${runId}, status=${status}`);
    if (log) {
      await log.write({
        level: 'INFO',
        module: 'Tools',
        runId,
        message: `update_task_status: ${status}`,
        extra: { status, reason: reason || '' }
      });
    }

    return { success: true, runId, status, previousStatus: task.status };
  }

  async function advance_phase(params) {
    const { runId, phaseId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const phases = task.plan?.execution?.phases || [];
    const currentPhase = task.plan?.execution?.currentPhase ?? 0;

    let nextPhase = currentPhase;

    if (phaseId) {
      // 指定了 phaseId，找到对应索引
      const idx = phases.findIndex(p => p.id === phaseId);
      if (idx === -1) {
        return { error: `阶段不存在: ${phaseId}` };
      }
      nextPhase = idx;
      phases[idx].status = 'completed';
    } else {
      // 默认推进到下一阶段
      if (currentPhase < phases.length) {
        phases[currentPhase].status = 'completed';
        nextPhase = currentPhase + 1;
      }
    }

    task.plan.execution.currentPhase = nextPhase;
    task.updatedAt = getNow();
    await state.saveTask(runId, task);

    const isComplete = nextPhase >= phases.length;

    logger?.info?.(`[Tools] advance_phase: runId=${runId}, currentPhase=${currentPhase} -> ${nextPhase}`);
    if (log) {
      await log.write({
        level: 'INFO',
        module: 'Tools',
        runId,
        message: `advance_phase: ${currentPhase} -> ${nextPhase}`,
        extra: { previousPhase: currentPhase, nextPhase, isComplete }
      });
    }

    return {
      success: true,
      runId,
      previousPhase: currentPhase,
      nextPhase,
      isComplete,
      totalPhases: phases.length
    };
  }

  async function record_deviation(params) {
    const { runId, type, description, impact } = params || {};
    if (!runId || !type || !description) {
      return { error: '缺少 runId、type 或 description 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const deviation = {
      id: `dev-${Date.now()}`,
      type,
      description,
      impact: impact || '',
      timestamp: getNow(),
      attributed: false
    };

    task.deviations = task.deviations || [];
    task.deviations.push(deviation);
    task.updatedAt = getNow();
    await state.saveTask(runId, task);

    // 同时写入事件文件（如果存在）
    await _appendToEventFile(task, 'deviation', deviation);

    logger?.info?.(`[Tools] record_deviation: runId=${runId}, type=${type}`);
    if (log) {
      await log.write({
        level: 'INFO',
        module: 'Tools',
        runId,
        message: `record_deviation: ${type}`,
        extra: { deviationId: deviation.id, type }
      });
    }

    return { success: true, deviation };
  }

  async function record_attribution(params) {
    const { runId, rootCause, impact, strategy } = params || {};
    if (!runId || !rootCause || !strategy) {
      return { error: '缺少 runId、rootCause 或 strategy 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    const attribution = {
      id: `attr-${Date.now()}`,
      rootCause,
      impact: impact || '',
      strategy,
      timestamp: getNow()
    };

    task.attributions = task.attributions || [];
    task.attributions.push(attribution);

    // 标记相关偏差为已归因
    if (task.deviations) {
      for (const dev of task.deviations) {
        if (!dev.attributed) {
          dev.attributed = true;
          dev.attributionId = attribution.id;
        }
      }
    }

    task.updatedAt = getNow();
    await state.saveTask(runId, task);

    // 同时写入事件文件（如果存在）
    await _appendToEventFile(task, 'attribution', attribution);

    logger?.info?.(`[Tools] record_attribution: runId=${runId}`);
    if (log) {
      await log.write({
        level: 'INFO',
        module: 'Tools',
        runId,
        message: `record_attribution: ${attribution.id}`,
        extra: { attributionId: attribution.id }
      });
    }

    return { success: true, attribution };
  }

  // ── 辅助函数 ──

  function _resolveEventFilePath(task) {
    const createdAt = task.createdAt;
    if (!createdAt) return null;
    const date = new Date(createdAt);
    const dateStr = date.toISOString().slice(0, 10);
    if (task.eventFilePath) {
      return task.eventFilePath;
    }
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `.agent/events/${dateStr}/${hh}-${mm}-${ss}.md`;
  }

  async function _appendToEventFile(task, sectionType, data) {
    const eventFilePath = _resolveEventFilePath(task);
    if (!eventFilePath) return;

    try {
      let content = '';
      try {
        content = await fs.readFile(eventFilePath, 'utf-8');
      } catch {
        return; // 事件文件不存在，跳过
      }

      if (sectionType === 'deviation') {
        // 追加到偏差章节
        const sectionMatch = content.match(/## 5\. 偏差[\s\S]*?(?=## 6\. |## 7\. |$)/);
        if (sectionMatch) {
          const newEntry = `\n- **${data.type}** (${data.timestamp}): ${data.description}${data.impact ? ` — 影响: ${data.impact}` : ''}`;
          const sectionEnd = sectionMatch.index + sectionMatch[0].length;
          const before = content.slice(0, sectionEnd);
          const after = content.slice(sectionEnd);
          content = before + newEntry + after;
          await fs.writeFile(eventFilePath, content, 'utf-8');
        }
      } else if (sectionType === 'attribution') {
        // 追加到归因章节
        const sectionMatch = content.match(/## 6\. 归因[\s\S]*?(?=## 7\. |$)/);
        if (sectionMatch) {
          const newEntry = `\n- **${data.id}** (${data.timestamp}): 根因: ${data.rootCause} — 策略: ${data.strategy}`;
          const sectionEnd = sectionMatch.index + sectionMatch[0].length;
          const before = content.slice(0, sectionEnd);
          const after = content.slice(sectionEnd);
          content = before + newEntry + after;
          await fs.writeFile(eventFilePath, content, 'utf-8');
        }
      }
    } catch (err) {
      logger?.warn?.(`[Tools] 事件文件追加失败: ${err.message}`);
    }
  }

  return {
    get_planning_guide,
    get_monitoring_guide,
    get_regulation_guide,
    get_development_guide,
    create_plan,
    update_task_status,
    advance_phase,
    record_deviation,
    record_attribution
  };
}
