/**
 * Event — 事件对象（面向对象封装）
 *
 * 对应 README 中的 Event 对象结构：
 * {
 *   eventId: uuid,
 *   runId: uuid,
 *   type: 'plan_created' | 'phase_completed' | 'deviation_detected' | ...,
 *   timestamp: ISO-8601 string,
 *   actor: 'Plan' | 'Deviation' | 'Attribution' | 'Session' | 'Tool',
 *   action: 'create' | 'advance' | 'detect' | 'acknowledge' | ...,
 *   targetId: string,
 *   details: { description: string, metadata: object }
 * }
 *
 * 职责：封装事件数据的创建、校验与序列化，替代原始的工厂函数。
 */

const EVENT_TYPES = [
  'plan_created', 'phase_completed', 'deviation_detected',
  'attribution_completed', 'tool_called', 'session_created',
  'session_completed', 'other'
];

const EVENT_ACTORS = ['Plan', 'Deviation', 'Attribution', 'Session', 'Tool'];

const EVENT_ACTIONS = [
  'create', 'advance', 'detect', 'acknowledge',
  'resolve', 'analyze', 'execute', 'complete', 'fail'
];

export class Event {
  /**
   * @param {Object} params
   * @param {string} params.eventId   事件唯一标识（自动生成）
   * @param {string} params.runId     所属运行 ID
   * @param {string} params.type      事件类型
   * @param {string} params.actor     行为主体
   * @param {string} params.action    行为动作
   * @param {string} params.targetId  受影响对象 ID
   * @param {Object} params.details   详情 { description, metadata }
   * @param {string|number} [params.timestamp] 时间戳（默认当前时间）
   */
  constructor({ eventId, runId, type, actor, action, targetId, details, timestamp }) {
    this.eventId = eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.runId = runId || '';
    this.type = type || 'other';
    this.actor = actor || '';
    this.action = action || '';
    this.targetId = targetId || '';
    this.details = details || { description: '', metadata: {} };
    this.timestamp = timestamp || new Date().toISOString();
  }

  /**
   * 校验必填字段
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];
    if (!this.runId) errors.push('runId is required');
    if (!this.type) errors.push('type is required');
    if (!EVENT_TYPES.includes(this.type)) errors.push(`unknown type: ${this.type}`);
    if (this.actor && !EVENT_ACTORS.includes(this.actor)) errors.push(`unknown actor: ${this.actor}`);
    if (this.action && !EVENT_ACTIONS.includes(this.action)) errors.push(`unknown action: ${this.action}`);
    return { valid: errors.length === 0, errors };
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object}
   */
  toJSON() {
    return {
      eventId: this.eventId,
      runId: this.runId,
      type: this.type,
      actor: this.actor,
      action: this.action,
      targetId: this.targetId,
      details: this.details,
      timestamp: this.timestamp
    };
  }

  /**
   * 从 JSON 数据还原 Event 实例
   * @param {Object} json
   * @returns {Event}
   */
  static fromJSON(json) {
    return new Event(json);
  }

  /**
   * 从模板快速创建事件（兼容原 event.js 工厂函数）
   * @param {string} type    事件类型（plan / deviation / attribution / session / tool）
   * @param {Object} data    模板数据
   * @returns {Event}
   */
  static fromTemplate(type, data) {
    const templates = {
      plan: {
        title: '计划制定',
        actor: 'Plan',
        action: 'create',
        fields: ['runId', 'goal', 'phaseCount', 'successCriteria']
      },
      deviation: {
        title: '偏差检测',
        actor: 'Deviation',
        action: 'detect',
        fields: ['runId', 'phaseId', 'expected', 'actual', 'gap']
      },
      attribution: {
        title: '归因调节',
        actor: 'Attribution',
        action: 'analyze',
        fields: ['runId', 'deviationId', 'rootCause', 'adjustmentType']
      },
      session: {
        title: '会话变更',
        actor: 'Session',
        action: 'create',
        fields: ['sessionId', 'taskFamily', 'status', 'action']
      },
      tool: {
        title: '工具调用',
        actor: 'Tool',
        action: 'execute',
        fields: ['toolName', 'status', 'error', 'duration']
      }
    };

    const template = templates[type] || { title: '未知事件', actor: '', action: '', fields: [] };
    const detailData = Object.fromEntries(
      template.fields.map(f => [f, data[f] ?? null])
    );

    return new Event({
      runId: data.runId || '',
      type: `${type}_${template.action}`,
      actor: template.actor,
      action: template.action,
      targetId: data.targetId || data.sessionId || data.toolName || '',
      details: {
        description: template.title,
        metadata: detailData
      }
    });
  }
}
