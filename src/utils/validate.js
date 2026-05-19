/**
 * Validation Utils — v4.3.0
 */

const VALID_STATUSES = ['draft', 'pending_approval', 'active', 'revising', 'completed'];

export function validateRunId(runId) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('runId 不能为空');
  }
  if (/[\\/:*?"<>|]/.test(runId)) {
    throw new Error('runId 包含非法字符');
  }
}

export function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`无效状态: ${status}，允许: ${VALID_STATUSES.join(', ')}`);
  }
}

export function isValidStatusTransition(from, to) {
  // draft → pending_approval → active → completed
  // active → revising → draft
  const transitions = {
    draft: ['pending_approval'],
    pending_approval: ['active'],
    active: ['revising', 'completed'],
    revising: ['draft'],
    completed: []
  };
  return transitions[from]?.includes(to) ?? false;
}
