/**
 * Log — 日志（按代理分文件版）
 * 基于文本文件持久化，每个代理独立文件 ~/.agent/logs/{agentId}.log
 *
 * 格式：一行一条日志，纯文本，便于人类阅读和常规工具（grep/tail）处理
 * [ISO时间戳] [LEVEL] [模块标签] [runId] 消息内容 {extra字段}
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_LOGS_DIR = join(homedir(), '.agent', 'logs');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export class Log {
  constructor(api, options = {}) {
    this.api = api; // 可为 null（回退到文件系统）
    this.dir = options.dir || DEFAULT_LOGS_DIR;
    this.agentId = options.agentId || 'agent-self-development';
    this.logFile = join(this.dir, `${this.agentId}.log`);
    this._ensureFiles();
  }

  _ensureFiles() {
    ensureDir(this.dir);
    if (!existsSync(this.logFile)) {
      writeFileSync(this.logFile, '', 'utf8');
    }
  }

  /**
   * 格式化日志条目为单行文本
   * @param {Object} entry
   *   - timestamp?: string  ISO 时间戳（默认自动生成）
   *   - level?: string      DEBUG/INFO/WARN/ERROR（默认 INFO）
   *   - module?: string     模块标识，如 [Meta]/[WM]/[Personality]
   *   - runId?: string      运行 ID
   *   - message: string     日志消息（必填）
   *   - extra?: Object      额外结构化数据，JSON 序列化后附加
   */
  _formatText(entry) {
    const ts = entry.timestamp || new Date().toISOString();
    const level = (entry.level || 'INFO').toUpperCase();
    const moduleTag = entry.module ? `[${entry.module}]` : '';
    const runIdTag = entry.runId ? `(${entry.runId})` : '';
    const extraStr = entry.extra && Object.keys(entry.extra).length > 0
      ? ' ' + JSON.stringify(entry.extra)
      : '';

    return `[${ts}] [${level}]${moduleTag ? ' ' + moduleTag : ''}${runIdTag ? ' ' + runIdTag : ''} ${entry.message || ''}${extraStr}`;
  }

  /**
   * 写入一条日志
   * 优先调用核心 API（如果传入 api.write），否则回退到本地文件追加
   */
  async write(entry) {
    if (this.api?.write) {
      try {
        await this.api.write(entry);
      } catch (err) {
        console.error('[Log] 核心 API 写入失败，回退到文件', err.message);
      }
    }
    try {
      const line = this._formatText(entry) + '\n';
      appendFileSync(this.logFile, line, 'utf8');
    } catch (err) {
      console.error('[Log] 文件写入失败', err.message);
    }
  }

  /**
   * 读取日志内容
   * @param {Object} options
   *   - limit?: number  返回最后 N 行
   */
  async read(options = {}) {
    if (this.api?.read) {
      try {
        const apiResult = await this.api.read(options);
        if (apiResult) return apiResult;
      } catch {
        // API 读取失败，继续回退到文件
      }
    }
    try {
      const content = readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      if (options.limit) return lines.slice(-options.limit);
      return lines;
    } catch (error) {
      console.error('[Log] 读取失败', error.message);
      return [];
    }
  }

  /**
   * 条件查询日志行
   * @param {Object} options
   *   - level?: string    过滤级别（如 'ERROR'）
   *   - search?: string   文本搜索
   *   - since?: string   ISO 时间字符串，只返回该时间之后的日志
   *   - limit?: number   返回最后 N 条匹配结果
   */
  async query(options = {}) {
    const lines = await this.read(options);
    return lines.filter(line => {
      if (options.level && !line.includes(`[${options.level.toUpperCase()}]`)) return false;
      if (options.search && !line.includes(options.search)) return false;
      if (options.since) {
        const tsMatch = line.match(/^\[(.*?)\]/);
        if (tsMatch && new Date(tsMatch[1]) < new Date(options.since)) return false;
      }
      return true;
    });
  }
}
