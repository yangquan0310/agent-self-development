/**
 * Working Memory Tools — v4.1.0
 *
 * 工作记忆和诊断相关的查询型 Tool。
 * 被动响应：只在 Agent 调用时执行。
 */

import { promises as fs } from 'fs';
import { getRecentTraces, getTraceStats, archiveTraces } from '../common/cognitive-trace.js';
import { resolveTaskFilePath } from '../common/project-context.js';

/**
 * 构建 working-memory tools 实例
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.state - State 实例
 * @param {Object} deps.skills - Skills 实例
 * @param {Object} deps.logger - Logger 实例
 * @param {Object} deps.log - Log 实例
 * @param {Object} deps.events - Event 实例
 */
function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`;
  return `${Math.round(ms / 3600000 * 10) / 10}小时`;
}

export function createWorkingMemoryTools({ state, skills, logger, log, events, caseIndex }) {

  async function get_task_status(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    logger?.debug?.(`[Tools] get_task_status: runId=${runId}`);
    return { task };
  }

  async function get_task_files(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    // 从项目级 .agent/tasks/{runId}.json 读取文件列表
    try {
      const content = await fs.readFile(resolveTaskFilePath(runId), 'utf-8');
      const taskIndex = JSON.parse(content);
      const files = taskIndex.files ? taskIndex.files.map(f => ({
        path: f.path,
        type: f.type || 'unknown',
        description: f.description || ''
      })) : [];

      logger?.debug?.(`[Tools] get_task_files: runId=${runId}, files=${files.length}`);
      return { runId, files, count: files.length };
    } catch (err) {
      logger?.debug?.(`[Tools] get_task_files: 无项目级文件索引: ${runId}`);
      return { runId, files: [], count: 0, note: '无项目级文件索引' };
    }
  }

  async function self_diagnose(params) {
    const { runId } = params || {};

    const diagnosis = {
      plugin: 'agent-self-development',
      version: '4.1.0',
      timestamp: new Date().toISOString()
    };

    if (runId) {
      const task = await state.getTask(runId);
      if (task) {
        diagnosis.taskStatus = task.status;
        diagnosis.phase = task.plan?.execution?.currentPhase ?? 0;
        diagnosis.totalPhases = task.plan?.execution?.phases?.length ?? 0;
        diagnosis.deviations = task.deviations?.length ?? 0;
        diagnosis.attributions = task.attributions?.length ?? 0;
        diagnosis.toolsAvailable = [
          'get_task_status',
          'get_task_files',
          'get_planning_guide',
          'get_monitoring_guide',
          'get_regulation_guide',
          'get_development_guide',
          'self_diagnose',
          'create_plan',
          'update_task_status',
          'advance_phase',
          'record_deviation',
          'record_attribution',
          'archive_task'
        ];
        // v4.2.0: 认知轨迹摘要
        const traceStats = getTraceStats(runId);
        const recentTraces = getRecentTraces(runId, 5);
        diagnosis.cognitiveTraceSummary = {
          toolCallCount: traceStats.count,
          lastToolCall: traceStats.lastToolCall,
          elapsedSinceLastCall: traceStats.elapsedSinceLastCall,
          recentCalls: recentTraces.map(t => ({ tool: t.tool, t: t.t }))
        };

        // v4.2.0: 趋势分析 + 风险预警（Diagnosis v2）
        const allTraces = getRecentTraces(runId, 50);
        const taskStartTime = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
        const now = Date.now();

        // 当前 phase 已耗时：从最近一次 advance_phase 或 task 创建时间算起
        let phaseStartTime = taskStartTime;
        const advanceTraces = allTraces.filter(t => t.tool === 'advance_phase');
        if (advanceTraces.length > 0) {
          phaseStartTime = advanceTraces[advanceTraces.length - 1].t;
        }
        const phaseElapsedMs = now - phaseStartTime;

        // 偏差频率（每小时）
        const deviationTraces = allTraces.filter(t => t.tool === 'record_deviation');
        const taskDurationHours = Math.max((now - taskStartTime) / 3600000, 0.01);
        const deviationRate = deviationTraces.length / taskDurationHours;

        // 历史同类型任务平均 phase 耗时
        let avgPhaseMs = null;
        if (caseIndex) {
          try {
            const searchGoal = task.plan?.context?.goal || task.plan?.prompt || '';
            const similarCases = await caseIndex.findSimilarCases(searchGoal, 10);
            const casesWithDuration = similarCases.filter(c => c.duration && c.phases > 0);
            if (casesWithDuration.length > 0) {
              const totalAvg = casesWithDuration.reduce((sum, c) => sum + (c.duration / c.phases), 0);
              avgPhaseMs = Math.round(totalAvg / casesWithDuration.length);
            }
          } catch {}
        }

        // 风险预警（最多 3 条）
        const riskFlags = [];
        if (avgPhaseMs && phaseElapsedMs > avgPhaseMs * 1.5) {
          riskFlags.push(`phase_time_over_avg: 当前阶段耗时 ${formatDuration(phaseElapsedMs)} 超过历史均值 ${formatDuration(avgPhaseMs)} 50%`);
        }
        if (deviationRate > 2) {
          riskFlags.push(`high_deviation_rate: 偏差频率 ${deviationRate.toFixed(1)}/小时 高于正常水平`);
        }
        if (task.deviations?.length > 0 && task.deviations.every(d => !d.attributed)) {
          riskFlags.push(`unattributed_deviations: 存在 ${task.deviations.length} 条未归因偏差，建议调用 record_attribution`);
        }

        diagnosis.trendAnalysis = {
          phaseElapsedTime: formatDuration(phaseElapsedMs),
          avgPhaseTime: avgPhaseMs ? formatDuration(avgPhaseMs) : null,
          deviationRate: `${deviationRate.toFixed(1)}/小时`,
          riskFlags: riskFlags.slice(0, 3)
        };
      } else {
        diagnosis.taskStatus = 'none';
        diagnosis.note = '当前会话尚无 task';
        diagnosis.toolsAvailable = [
          'get_planning_guide',
          'self_diagnose',
          'create_plan'
        ];
      }
    } else {
      // 全局诊断
      diagnosis.mode = 'global';
      diagnosis.toolsAvailable = [
        'get_task_status',
        'get_task_files',
        'get_planning_guide',
        'get_monitoring_guide',
        'get_regulation_guide',
        'get_development_guide',
        'self_diagnose',
        'create_plan',
        'update_task_status',
        'advance_phase',
        'record_deviation',
        'record_attribution',
        'archive_task'
      ];
    }

    // 检查 State 系统状态
    try {
      const tasks = await state.listTasks();
      diagnosis.activeTasks = tasks.filter(t => t.status !== 'completed').length;
      diagnosis.completedTasks = tasks.filter(t => t.status === 'completed').length;
    } catch {
      diagnosis.activeTasks = -1;
      diagnosis.completedTasks = -1;
    }

    logger?.debug?.(`[Tools] self_diagnose: runId=${runId || 'none'}`);
    return { diagnosis };
  }

  async function archive_task(params) {
    const { runId } = params || {};
    if (!runId) {
      return { error: '缺少 runId 参数' };
    }

    const task = await state.getTask(runId);
    if (!task) {
      return { error: `task 不存在: ${runId}` };
    }

    if (task.status !== 'completed') {
      return {
        error: `task 状态不是 completed（当前: ${task.status}），无法归档`,
        status: task.status
      };
    }

    const archived = await state.archiveTask(runId);
    if (!archived) {
      return { error: '归档失败' };
    }

    // v4.2.0: 归档时一并迁移认知轨迹文件
    const tracesArchived = archiveTraces(runId);
    if (tracesArchived) {
      logger?.debug?.(`[Tools] archive_task: 认知轨迹已归档 runId=${runId}`);
    }

    // v4.2.0: 写入案例索引
    if (caseIndex) {
      try {
        await caseIndex.indexTask(task);
        logger?.debug?.(`[Tools] archive_task: 案例索引已更新 runId=${runId}`);
      } catch (err) {
        logger?.warn?.(`[Tools] 案例索引写入失败: ${err.message}`);
      }
    }

    // 触发项目级归档（如果 events 实例可用）
    if (events) {
      try {
        const archivePayload = {
          runId,
          status: task.status,
          deviations: task.deviations || [],
          attributions: task.attributions || [],
          outcome: task.outcome || {},
          archivedAt: Date.now()
        };
        await events.archiveTask(archivePayload);
      } catch (err) {
        logger?.warn?.(`[Tools] 项目级归档失败: ${err.message}`);
      }
    }

    logger?.info?.(`[Tools] archive_task: runId=${runId}`);
    if (log) {
      await log.write({
        level: 'INFO',
        module: 'Tools',
        runId,
        message: 'archive_task: completed',
        extra: { status: 'completed' }
      });
    }

    return { success: true, runId, archivedAt: new Date().toISOString() };
  }

  return {
    get_task_status,
    get_task_files,
    self_diagnose,
    archive_task
  };
}
