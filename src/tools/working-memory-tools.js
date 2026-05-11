/**
 * Working Memory Tools — v4.1.0
 *
 * 工作记忆和诊断相关的查询型 Tool。
 * 被动响应：只在 Agent 调用时执行。
 */

import { promises as fs } from 'fs';

/**
 * 构建 working-memory tools 实例
 * @param {Object} deps - 依赖注入
 * @param {Object} deps.state - State 实例
 * @param {Object} deps.skills - Skills 实例
 * @param {Object} deps.logger - Logger 实例
 * @param {Object} deps.log - Log 实例
 * @param {Object} deps.events - Event 实例
 */
export function createWorkingMemoryTools({ state, skills, logger, log, events }) {

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
      const content = await fs.readFile(`.agent/tasks/${runId}.json`, 'utf-8');
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
