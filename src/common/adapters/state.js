/**
 * State — 状态存储（独立文件版）
 * 使用 ~/.openclaw/state/agent-self-development/{type}/{id}.json
 *
 * 每个任务一个独立 JSON 文件：tasks/{runId}.json
 * 归档任务：archive/{runId}.json
 * Session 全局管理：sessions.json（保留多键集合）
 *
 * v3.3.0: 独立文件存储，避免多任务混用单一 JSON
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { dirname, join } from 'path';

const DEFAULT_DIR = '/root/.openclaw/state/agent-self-development';
const TASKS_DIR = 'tasks';
const ARCHIVE_DIR = 'archive';
const MAX_ARCHIVED_TASKS = 50;

function ensureDir(dir) {
  try { mkdirSync(dir, { recursive: true }); } catch {}
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function saveJson(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

export class State {
  constructor(api, options = {}) {
    this.api = api;
    this.dir = options.dir || DEFAULT_DIR;
    this.maxArchivedTasks = options.maxArchivedTasks || MAX_ARCHIVED_TASKS;
    ensureDir(this.dir);
    ensureDir(join(this.dir, TASKS_DIR));
    ensureDir(join(this.dir, ARCHIVE_DIR));
  }

  _file(type) {
    return `${this.dir}/${type}.json`;
  }

  _taskFile(runId) {
    return join(this.dir, TASKS_DIR, `${runId}.json`);
  }

  _archiveFile(runId) {
    return join(this.dir, ARCHIVE_DIR, `${runId}.json`);
  }

  _get(type, key) {
    const data = loadJson(this._file(type));
    return data ? data[key] : undefined;
  }

  _set(type, key, value) {
    const path = this._file(type);
    const data = loadJson(path) || {};
    if (value === null || value === undefined) {
      delete data[key];
    } else {
      data[key] = value;
    }
    saveJson(path, data);
  }

  _list(type, prefix) {
    const data = loadJson(this._file(type));
    if (!data) return [];
    return Object.entries(data)
      .filter(([k]) => !prefix || k.startsWith(prefix))
      .map(([, v]) => v);
  }

  // ── Task（独立文件，每个 runId 一个 JSON）──

  async saveTask(runId, task) {
    if (this.api?.set) await this.api.set(`task:${runId}`, task);
    saveJson(this._taskFile(runId), task);
  }

  async getTask(runId) {
    if (this.api?.get) {
      const mem = await this.api.get(`task:${runId}`);
      if (mem !== undefined && mem !== null) return mem;
    }
    return loadJson(this._taskFile(runId));
  }

  async deleteTask(runId) {
    if (this.api?.set) await this.api.set(`task:${runId}`, null);
    const path = this._taskFile(runId);
    if (existsSync(path)) {
      try { unlinkSync(path); } catch {}
    }
  }

  async listTasks() {
    const dirPath = join(this.dir, TASKS_DIR);
    if (!existsSync(dirPath)) return [];
    const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));
    return files.map(f => loadJson(join(dirPath, f))).filter(Boolean);
  }

  /**
   * 归档已完成的任务：从 tasks/ 移至 archive/
   * 并清理超过 MAX_ARCHIVED_TASKS 的旧归档
   */
  async archiveTask(runId) {
    const task = await this.getTask(runId);
    if (!task || task.status !== 'completed') {
      return false;
    }

    const src = this._taskFile(runId);
    const dst = this._archiveFile(runId);

    const archivedTask = {
      ...task,
      archivedAt: new Date().toISOString()
    };

    saveJson(dst, archivedTask);

    // 从活跃任务中删除
    await this.deleteTask(runId);

    // 清理旧归档，保留最近 50 个
    await this._cleanupOldArchives();

    return true;
  }

  async getArchivedTask(runId) {
    return loadJson(this._archiveFile(runId));
  }

  async listArchivedTasks() {
    const dirPath = join(this.dir, ARCHIVE_DIR);
    if (!existsSync(dirPath)) return [];
    const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));
    return files.map(f => loadJson(join(dirPath, f))).filter(Boolean);
  }

  /**
   * 清理旧归档：按 archivedAt 排序，只保留最近 50 个
   */
  async _cleanupOldArchives() {
    const dirPath = join(this.dir, ARCHIVE_DIR);
    if (!existsSync(dirPath)) return;

    const files = readdirSync(dirPath)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const path = join(dirPath, f);
        const task = loadJson(path);
        return {
          file: f,
          path,
          archivedAt: task?.archivedAt || '1970-01-01T00:00:00Z'
        };
      })
      .sort((a, b) => new Date(a.archivedAt).getTime() - new Date(b.archivedAt).getTime());

    if (files.length <= this.maxArchivedTasks) return;

    const toDelete = files.slice(0, files.length - this.maxArchivedTasks);
    for (const item of toDelete) {
      try { unlinkSync(item.path); } catch {}
    }
  }

  // ── Session（全局，跨任务复用，保留集合 JSON）──

  async saveSession(sessionId, session) {
    if (this.api?.set) await this.api.set(`session:${sessionId}`, session);
    this._set('sessions', sessionId, session);
  }

  async getSession(sessionId) {
    if (this.api?.get) {
      const mem = await this.api.get(`session:${sessionId}`);
      if (mem !== undefined && mem !== null) return mem;
    }
    return this._get('sessions', sessionId);
  }

  async deleteSession(sessionId) {
    if (this.api?.set) await this.api.set(`session:${sessionId}`, null);
    this._set('sessions', sessionId, null);
  }

  async listSessions() {
    return this._list('sessions');
  }

  async listSessionsByStatus(status) {
    const all = await this.listSessions();
    return all.filter(s => s.status === status);
  }

  // v3.5.0: Gateway 停止时清理资源（State 为文件系统操作，无连接需关闭）
  close() {
    // no-op for file-based adapter
  }
}
