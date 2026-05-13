/**
 * Case Index — v4.2.0
 *
 * 归档任务索引，基于 SQLite + 关键词 Jaccard 相似度。
 * create_plan 时检索相似历史任务，实现 Case-Based Planning。
 */

import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getBaseDir } from './project-context.js';

// 动态导入 better-sqlite3（兼容 ESM，与 Flow/Memory/Task 保持一致）
let Database;
async function getDatabase() {
  if (!Database) {
    const module = await import('better-sqlite3');
    Database = module.default || module;
  }
  return Database;
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','have','has','had','do','does','did','will',
  'would','could','should','may','might','can','this','that','these','those',
  'i','you','he','she','it','we','they',
  '的','了','是','在','和','与','或','为','有','被'
]);

export class CaseIndex {
  constructor(api, options = {}) {
    this.api = api;
    this.dbPath = options.dbPath || join(getBaseDir(), 'state', 'case-index.sqlite');
    this.maxArchivedTasks = options.maxArchivedTasks || 50;
    this._db = null;
  }

  async _init() {
    if (this._db) return;
    const Database = await getDatabase();
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this._db = new Database(this.dbPath);
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        runId TEXT PRIMARY KEY,
        goal TEXT,
        goalEmbedding TEXT,
        phases INTEGER,
        totalDeviations INTEGER,
        outcome TEXT,
        archivedAt TEXT,
        duration INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_cases_goal ON cases(goal);
      CREATE INDEX IF NOT EXISTS idx_cases_archivedAt ON cases(archivedAt);
    `);
  }

  /**
   * 提取关键词集合（英文单词 + 中文字符）
   */
  _extractKeywords(text) {
    if (!text) return [];
    const words = [];
    // 英文单词
    const enMatches = text.toLowerCase().match(/[a-z]{2,}/g) || [];
    for (const w of enMatches) {
      if (!STOP_WORDS.has(w)) words.push(w);
    }
    // 中文字符（每个字作为一个 token，轻量实现）
    const cnMatches = text.match(/[\u4e00-\u9fa5]/g) || [];
    for (const w of cnMatches) {
      if (!STOP_WORDS.has(w)) words.push(w);
    }
    return [...new Set(words)];
  }

  _jaccardSimilarity(a, b) {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : Math.round((intersection.size / union.size) * 100) / 100;
  }

  /**
   * 将 task 特征写入索引
   */
  async indexTask(task) {
    await this._init();
    const goal = task.plan?.context?.goal || task.plan?.prompt || '';
    const keywords = this._extractKeywords(goal);
    const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
    const duration = Date.now() - createdAt;
    const stmt = this._db.prepare(`
      INSERT OR REPLACE INTO cases
        (runId, goal, goalEmbedding, phases, totalDeviations, outcome, archivedAt, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      task.runId,
      goal,
      JSON.stringify(keywords),
      task.plan?.execution?.phases?.length || 0,
      task.deviations?.length || 0,
      JSON.stringify(task.outcome || {}),
      new Date().toISOString(),
      duration
    );
    await this._cleanup();
  }

  /**
   * 根据 goal 文本检索相似历史任务
   * @param {string} goal
   * @param {number} limit
   * @returns {Array<{runId, goal, outcome, relevance}>}
   */
  async findSimilarCases(goal, limit = 3) {
    await this._init();
    const keywords = this._extractKeywords(goal);
    const rows = this._db.prepare('SELECT * FROM cases').all();
    const scored = rows.map(row => {
      const rowKeywords = JSON.parse(row.goalEmbedding || '[]');
      const relevance = this._jaccardSimilarity(keywords, rowKeywords);
      return {
        runId: row.runId,
        goal: row.goal,
        outcome: JSON.parse(row.outcome || '{}'),
        relevance,
        phases: row.phases,
        duration: row.duration
      };
    });
    scored.sort((a, b) => b.relevance - a.relevance);
    return scored.filter(s => s.relevance > 0).slice(0, limit);
  }

  /**
   * 自动清理：超过上限时删除最旧的记录
   */
  async _cleanup() {
    const count = this._db.prepare('SELECT COUNT(*) as c FROM cases').get().c;
    if (count <= this.maxArchivedTasks) return;
    const toDelete = this._db.prepare(
      'SELECT runId FROM cases ORDER BY archivedAt ASC LIMIT ?'
    ).all(count - this.maxArchivedTasks);
    const stmt = this._db.prepare('DELETE FROM cases WHERE runId = ?');
    for (const row of toDelete) {
      stmt.run(row.runId);
    }
  }

  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}
