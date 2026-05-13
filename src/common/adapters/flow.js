/**
 * Flow — 任务流存储（SQLite 版）
 * 使用 ~/.agent/flows/registry.sqlite
 */

import { join } from 'path';
import { homedir } from 'os';

// 动态导入 better-sqlite3（兼容 ESM）
let Database;
async function getDatabase() {
  if (!Database) {
    const module = await import('better-sqlite3');
    Database = module.default || module;
  }
  return Database;
}

export class Flow {
  constructor(api, options = {}) {
    this.api = api;
    // v4.2.0: 使用 os.homedir() 替代硬编码 /root/.agent，支持 OPENCLAW_AGENT_DIR 环境变量覆盖
    this.dbPath = options.dbPath || (process.env.OPENCLAW_AGENT_DIR
      ? join(process.env.OPENCLAW_AGENT_DIR, 'flows', 'registry.sqlite')
      : join(homedir(), '.agent', 'flows', 'registry.sqlite'));
    this.tablePrefix = options.tablePrefix || 'asd_';
    this._db = null;
  }

  async _init() {
    const Database = await getDatabase();
    const db = new Database(this.dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}flows (
        flow_id TEXT PRIMARY KEY,
        run_id TEXT,
        data TEXT NOT NULL,
        created_at INTEGER,
        updated_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}flows_run_id ON ${this.tablePrefix}flows(run_id);
      CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}flows_phase ON ${this.tablePrefix}flows(data);
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

  // v3.5.0: Gateway 停止时关闭数据库连接
  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  async createPlanFlow(plan) {
    await this._init();
    const flowId = `plan-${plan.runId}`;
    const flow = {
      flowId,
      controllerId: 'agent-self-development/planning',
      goal: plan.context?.goal || '',
      currentStep: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 1,
      stateJson: {
        plan,
        phases: plan.execution?.phases || [],
        currentPhase: 0,
        status: 'draft'
      }
    };
    if (this.api?.create) await this.api.create(flow);
    const db = await this._getDb();
    const runId = plan.runId || '';
    db.prepare(`INSERT OR REPLACE INTO ${this.tablePrefix}flows (flow_id, run_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(flowId, runId, JSON.stringify(flow), flow.createdAt, flow.updatedAt);
    return flow;
  }

  async get(flowId) {
    if (this.api?.get) {
      const apiResult = await this.api.get(flowId);
      if (apiResult) return apiResult;
    }
    await this._init();
    const db = await this._getDb();
    const row = db.prepare(`SELECT data FROM ${this.tablePrefix}flows WHERE flow_id = ?`).get(flowId);
    return row ? JSON.parse(row.data) : null;
  }

  async advancePhase(flowId, phase) {
    await this._init();
    const db = await this._getDb();
    const row = db.prepare(`SELECT data FROM ${this.tablePrefix}flows WHERE flow_id = ?`).get(flowId);
    if (!row) {
      return null;
    }
    const flow = JSON.parse(row.data);
    flow.currentStep = phase.id || flow.currentStep;
    flow.updatedAt = Date.now();
    flow.revision = (flow.revision || 1) + 1;
    flow.stateJson.currentPhase = (flow.stateJson.currentPhase || 0) + 1;
    if (this.api?.update) {
      await this.api.update({ flowId, expectedRevision: flow.revision - 1, currentStep: flow.currentStep, stateJson: flow.stateJson });
    }
    db.prepare(`UPDATE ${this.tablePrefix}flows SET data = ?, updated_at = ? WHERE flow_id = ?`).run(JSON.stringify(flow), flow.updatedAt, flowId);
    return flow;
  }

  async waitForApproval(flowId) {
    await this._init();
    const db = await this._getDb();
    const row = db.prepare(`SELECT data FROM ${this.tablePrefix}flows WHERE flow_id = ?`).get(flowId);
    if (!row) {
      return null;
    }
    const flow = JSON.parse(row.data);
    flow.currentStep = 'pending_approval';
    flow.updatedAt = Date.now();
    flow.revision = (flow.revision || 1) + 1;
    flow.stateJson.status = 'pending_approval';
    if (this.api?.setWaiting) {
      await this.api.setWaiting({ flowId, expectedRevision: flow.revision - 1, currentStep: 'pending_approval', waitJson: { kind: 'user_confirm', reason: 'Plan pending approval' } });
    }
    db.prepare(`UPDATE ${this.tablePrefix}flows SET data = ?, updated_at = ? WHERE flow_id = ?`).run(JSON.stringify(flow), flow.updatedAt, flowId);
    return flow;
  }

  async getByRunId(runId) {
    await this._init();
    const db = await this._getDb();
    const row = db.prepare(`SELECT data FROM ${this.tablePrefix}flows WHERE run_id = ?`).get(runId);
    if (row) return JSON.parse(row.data);
    return null;
  }

  async getByPhase(phaseId) {
    await this._init();
    const db = await this._getDb();
    // 注：phaseId 查询需要反序列化 JSON，索引无法直接优化
    // v3.5.0 先保留全表扫描，后续如性能瓶颈再考虑添加 phases 索引表
    const rows = db.prepare(`SELECT data FROM ${this.tablePrefix}flows`).all();
    for (const row of rows) {
      const flow = JSON.parse(row.data);
      const phases = flow.stateJson?.phases || [];
      if (phases.some(p => p.id === phaseId)) return flow;
    }
    return null;
  }

  async runSubtask(flowId, phase) {
    console.log(`[Flow] runSubtask: ${flowId} phase=${phase?.id}`);
    return null;
  }
}
