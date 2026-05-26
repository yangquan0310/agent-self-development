/**
 * Hook Conditions — v4.5.0
 *
 * 条件触发判断逻辑。封装 Hook 注入的判断条件，
 * 返回 { shouldInject, idempotencyKey, prependContext }。
 *
 * 提醒文本从 src/assets/ 目录加载：
 * - task-created-reminder.md
 * - deviation-detected-reminder.md
 * - event-generated-reminder.md
 * - no-active-task-reminder.md
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const remindersDir = join(__dirname, '..', 'assets', 'reminders');

// 加载提醒文本
function loadReminder(filename) {
  const path = join(remindersDir, filename);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return null;
}

const REMINDERS = {
  taskCreated: loadReminder('task-created-reminder.md') || '【任务创建提醒】\n新任务已创建，建议立即制定执行计划。',
  deviationDetected: loadReminder('deviation-detected-reminder.md') || '【偏差分析提醒】\n检测到任务执行偏差，建议立即进行偏差分析。',
  eventGenerated: loadReminder('event-generated-reminder.md') || '【事件复盘提醒】\n事件报告已生成，建议进行六维度平衡性判断。',
  noActiveTask: loadReminder('no-active-task-reminder.md') || '【任务创建提醒】\n当前没有进行中的任务，建议创建新任务。'
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
      idempotencyKey: 'agent-self-development:task-created',
      prependContext: REMINDERS.taskCreated
    };
  }

  // M3: event.report 成功后注入
  if (toolName === 'event.report' && isSuccess && parsedResult.eventFilePath) {
    return {
      shouldInject: true,
      idempotencyKey: 'agent-self-development:event-generated',
      prependContext: REMINDERS.eventGenerated
    };
  }

  // M2: task.update 含 deviation 时注入
  if (toolName === 'task.update' && isSuccess && parsedResult.deviationRecorded) {
    return {
      shouldInject: true,
      idempotencyKey: 'agent-self-development:deviation-detected',
      prependContext: REMINDERS.deviationDetected
    };
  }

  return { shouldInject: false };
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
        idempotencyKey: 'agent-self-development:no-active-task',
        prependContext: REMINDERS.noActiveTask
      };
    }
  } catch {
    // 出错时跳过，不阻塞
  }

  return { shouldInject: false };
}

export { REMINDERS };
