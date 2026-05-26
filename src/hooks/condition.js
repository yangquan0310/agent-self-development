/**
 * Hook Conditions — v4.5.0
 *
 * 条件触发判断逻辑。封装 Hook 注入的判断条件，
 * 返回 { shouldInject, idempotencyKey, prependContext }。
 */

// 提醒文本
const REMINDERS = {
  taskCreated: `【任务创建提醒】
新任务已创建。建议立即制定执行计划：
1. 制定计划：使用 task.create 创建任务
2. 拆解 TODO：使用 task.update 更新任务状态为 active，然后逐步推进
3. 执行监控：执行过程中如遇偏差，使用 task.update 记录偏差
4. 归因分析：每次记录偏差后分析原因，使用 task.update 记录归因
5. 事件记录：任务完成后使用 event.report 生成事件报告`,

  deviationDetected: `【偏差分析提醒】
检测到任务执行偏差。建议立即进行偏差分析：
1. 偏差分类：分析偏差类型（输入/过程/输出/环境）
2. 归因分析：使用 task.update 的 attribution 参数记录根本原因
3. 影响评估：评估对目标、时间、质量的影响
4. 调整策略：根据归因结果调整后续执行计划`,

  eventGenerated: `【事件复盘提醒】
事件报告已生成。建议进行六维度平衡性判断：
1. 自我认知：本次任务是否反映了真实的自我认知？
2. 风格判断：执行风格是主动还是被动？需要调整吗？
3. 信念验证：现有信念是否支持本次任务的决策？
4. 身份一致性：行动是否与身份定位一致？
5. 技能评估：哪些技能得到提升或暴露了短板？
6. 程序性记忆：是否需要更新 MEMORY.md 记录新经验？`,

  noActiveTask: `【任务创建提醒】
当前没有进行中的任务。建议：
1. 评估当前工作：是否有需要创建的任务？
2. 使用 task.create 创建新任务
3. 使用 task.update 推进任务状态
4. 使用 event.* 工具管理事件记录`
};

/**
 * 判断 after_tool_call 是否需要触发注入
 * @param {object} event - hook event 对象，包含 toolName 和 result
 * @returns {object} { shouldInject, idempotencyKey, prependContext }
 */
export function evaluateAfterToolCall(event) {
  const { toolName, result } = event;

  // 解析结果判断成功与否
  // result 可能是 { content: [{ type: "text", text: "..." }] } 格式
  let parsedResult = result;
  if (result && result.content && result.content[0]?.text) {
    try {
      parsedResult = JSON.parse(result.content[0].text);
    } catch {
      // 解析失败，使用原始 result
    }
  }

  const isSuccess = parsedResult && !parsedResult.error;

  // M1: task.create 成功后注入
  if (toolName === 'task.create' && isSuccess && parsedResult.runId) {
    return {
      shouldInject: true,
      idempotencyKey: 'agent-autobiography:task-created',
      prependContext: REMINDERS.taskCreated
    };
  }

  // M3: event.report 成功后注入
  if (toolName === 'event.report' && isSuccess && parsedResult.eventFilePath) {
    return {
      shouldInject: true,
      idempotencyKey: 'agent-autobiography:event-generated',
      prependContext: REMINDERS.eventGenerated
    };
  }

  // M2: task.update 含 deviation 时注入
  if (toolName === 'task.update' && isSuccess && parsedResult.deviationRecorded) {
    return {
      shouldInject: true,
      idempotencyKey: 'agent-autobiography:deviation-detected',
      prependContext: REMINDERS.deviationDetected
    };
  }

  return { shouldInject: false };
}

/**
 * 判断 task.update 是否包含 deviation
 * @param {object} params - tool call params
 * @returns {boolean}
 */
export function hasDeviation(params) {
  return params && params.deviation && typeof params.deviation === 'object';
}

/**
 * 判断 before_prompt_build 是否需要触发注入
 * @param {object} context - 插件 context
 * @returns {Promise<object>} { shouldInject, idempotencyKey, prependContext }
 */
export async function evaluateBeforePromptBuild(context) {
  // M4: 检测无 active task 时注入
  // 需要扫描 .agents/tasks/ 目录查找 active 状态的任务
  try {
    const { readdir, readFile } = await import('fs').then(m => m.promises);
    const { join } = await import('path');
    const tasksDir = join(context.baseDir || process.cwd(), '.agents', 'tasks');

    let hasActive = false;
    try {
      const files = await readdir(tasksDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(tasksDir, file), 'utf-8');
          const task = JSON.parse(content);
          if (task.status === 'active' || task.status === 'pending_approval' || task.status === 'draft') {
            hasActive = true;
            break;
          }
        }
      }
    } catch {
      // 目录不存在或为空，无 active task
    }

    if (!hasActive) {
      return {
        shouldInject: true,
        idempotencyKey: 'agent-autobiography:no-active-task',
        prependContext: REMINDERS.noActiveTask
      };
    }
  } catch {
    // 出错时跳过，不阻塞
  }

  return { shouldInject: false };
}

export { REMINDERS };
