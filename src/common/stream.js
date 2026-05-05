/**
 * Stream — 流式输出处理
 *
 * OpenClaw Gateway 的 llm_output 事件可能以两种模式触发：
 * 1. 非流式：一次性给出完整 event.output / event.text
 * 2. 流式：分多次给出 event.chunk / event.delta，最后给 event.done / event.finished
 *
 * 本类融合事件检测与文本缓冲：
 * - classify() / extract() 负责识别事件类型并提取文本
 * - accumulate() / drain() / purge() 负责聚合 chunk 到完整输出
 */

export class Stream {
  constructor() {
    /** @type {Map<string, string>} */
    this._buffers = new Map();
  }

  /**
   * 判断事件类型
   * @param {Object} event
   * @returns {'chunk' | 'end' | 'full' | 'unknown'}
   */
  classify(event) {
    if (!event || typeof event !== 'object') return 'unknown';

    if (event.stream === true) return 'chunk';
    if (event.done === true) return 'end';
    if (event.finished === true) return 'end';
    if (event.stream === false) return 'full';

    const hasChunk = event.chunk !== undefined && event.chunk !== null;
    const hasDelta = event.delta !== undefined && event.delta !== null;
    const hasFull = event.output !== undefined || event.text !== undefined;

    if ((hasChunk || hasDelta) && !hasFull) return 'chunk';
    if (!hasChunk && !hasDelta && hasFull) return 'full';

    return 'unknown';
  }

  /**
   * 从事件中提取文本内容
   * @param {Object} event
   * @returns {string}
   */
  extract(event) {
    if (!event || typeof event !== 'object') return '';
    if (typeof event.chunk === 'string') return event.chunk;
    if (typeof event.delta === 'string') return event.delta;
    if (typeof event.output === 'string') return event.output;
    if (typeof event.text === 'string') return event.text;
    return '';
  }

  /**
   * 将文本追加到指定 runId 的缓冲区
   * @param {string} runId
   * @param {string} text
   * @returns {string} 当前累积的完整文本
   */
  accumulate(runId, text) {
    const existing = this._buffers.get(runId) || '';
    const updated = existing + (text || '');
    this._buffers.set(runId, updated);
    return updated;
  }

  /**
   * 查看指定 runId 的当前累积文本（不清空）
   * @param {string} runId
   * @returns {string}
   */
  peek(runId) {
    return this._buffers.get(runId) || '';
  }

  /**
   * 取出并清空指定 runId 的缓冲区
   * @param {string} runId
   * @returns {string} 聚合后的完整文本
   */
  drain(runId) {
    const full = this._buffers.get(runId) || '';
    this._buffers.delete(runId);
    return full;
  }

  /**
   * 清空指定 runId 的缓冲区
   * @param {string} runId
   */
  purge(runId) {
    this._buffers.delete(runId);
  }

  /**
   * 清空所有缓冲区
   */
  purgeAll() {
    this._buffers.clear();
  }

  /**
   * 获取当前活跃的 runId 列表
   * @returns {string[]}
   */
  active() {
    return Array.from(this._buffers.keys());
  }
}
