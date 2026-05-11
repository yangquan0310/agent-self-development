/**
 * Task — 任务存储（SQLite 版）
 * 使用 ~/.agent/tasks/runs.sqlite
 */

import { join } from 'path';

// 动态导入 better-sqlite3（兼容 ESM）
let Database;
async function getDatabase() {
  if (!Database) {
    const module = await import('better-sqlite3');
    Database = module.default || module;
  }
  return Database;
}

export class Task {
  constructor(api, options = {}) {
    this.api = api;
    this.dbPath = options.dbPath || '/root/.agent/tasks/runs.sqlite';
    this.tablePrefix = options.tablePrefix || 'asd_';
    this._db = null;
  }

  async _init() {
    const Database = await getDatabase();
    const db = new Database(this.dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}tasks (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );
    `);
    db.close();
  }

  async _getDb() {
    if (!this._db) {
      const Database = await getDatabase();
      this._db = new Database(this.dbPath);
    }
    return this._db;
  }

  async createTask(task) {
    await this._init();
    const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { ...task, id: taskId, createdAt: task.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (this.api?.create) await this.api.create(record);
    const db = await this._getDb();
    db.prepare(`INSERT OR REPLACE INTO ${this.tablePrefix}tasks (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(taskId, JSON.stringify(record), record.createdAt, record.updatedAt);
    return record;
  }

  async getTask(taskId) {
    if (this.api?.get) {
      const apiResult = await this.api.get(taskId);
      if (apiResult) return apiResult;
    }
    await this._init();
    const db = await this._getDb();
    const row = db.prepare(`SELECT data FROM ${this.tablePrefix}tasks WHERE id = ?`).get(taskId);
    return row ? JSON.parse(row.data) : null;
  }

  async updateTask(taskId, updates) {
    const existing = await this.getTask(taskId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    if (this.api?.update) await this.api.update(taskId, updates);
    const db = await this._getDb();
    db.prepare(`UPDATE ${this.tablePrefix}tasks SET data = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(updated), updated.updatedAt, taskId);
    return updated;
  }

  async deleteTask(taskId) {
    if (this.api?.delete) await this.api.delete(taskId);
    await this._init();
    const db = await this._getDb();
    db.prepare(`DELETE FROM ${this.tablePrefix}tasks WHERE id = ?`).run(taskId);
  }

  async listTasks() {
    await this._init();
    const db = await this._getDb();
    const rows = db.prepare(`SELECT data FROM ${this.tablePrefix}tasks`).all();
    return rows.map(r => JSON.parse(r.data));
  }
}
