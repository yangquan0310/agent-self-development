/**
 * Session — 会话业务
 * 组合 State + Flow + Session API，管理任务空间复用
 */

export class Session {
  constructor(state, flow, sessionAPI) {
    this.state = state;
    this.flow = flow;
    this.sessionAPI = sessionAPI; // 可能为 undefined
  }

  async createSession(phase, taskFamily) {
    const sessionId = `session:${taskFamily}:${Date.now()}`;

    if (this.sessionAPI) {
      const existingSession = await this.sessionAPI.get(sessionId);
      if (existingSession && existingSession.status === 'idle') {
        existingSession.status = 'active';
        await this.sessionAPI.update(sessionId, existingSession);
        return existingSession;
      }
    }

    const existing = await this.state.getSession(sessionId);
    if (existing && existing.status === 'idle') {
      existing.status = 'active';
      await this.state.saveSession(sessionId, existing);
      return existing;
    }

    const session = {
      id: sessionId,
      taskFamily,
      status: 'active',
      createdAt: Date.now()
    };

    await this.state.saveSession(sessionId, session);
    if (this.sessionAPI) {
      await this.sessionAPI.create(sessionId, session);
    }

    const flow = await this.flow.getByPhase(phase.id);
    if (flow) {
      await this.flow.runSubtask(flow.flowId, phase);
    }

    return session;
  }

  async releaseSession(sessionId) {
    const session = await this.state.getSession(sessionId);
    if (session) {
      session.status = 'idle';
      await this.state.saveSession(sessionId, session);
      if (this.sessionAPI) {
        await this.sessionAPI.update(sessionId, { status: 'idle' });
      }
    }
  }

  async destroySession(sessionId) {
    await this.state.deleteSession(sessionId);
    if (this.sessionAPI) {
      await this.sessionAPI.destroy(sessionId);
    }
  }
}
