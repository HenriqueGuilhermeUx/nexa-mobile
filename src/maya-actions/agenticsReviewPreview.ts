/**
 * Maya Agentics Phase 3B preview contract received from Nexa's authenticated
 * backend. Presentation only. No fetch, auth tokens or execution in this module.
 */
export type MayaAgenticsReviewStep = {
  action: 'review_request' | 'approve_before_execution';
  description: string;
};
export type MayaAgenticsReviewPreview = {
  taskId: string;
  status: 'preview_ready';
  steps: MayaAgenticsReviewStep[];
  externalEffects: false;
  financialExecution: false;
  remoteConnectorsUsed: false;
  requiresUserReview: true;
};

const uuid4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(['review_request','approve_before_execution']);

export function parseMayaAgenticsReviewPreview(raw: unknown, expectedTaskId: string): MayaAgenticsReviewPreview | null {
  if (!uuid4.test(expectedTaskId) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (p.taskId !== expectedTaskId || p.status !== 'preview_ready' ||
      p.externalEffects !== false || p.financialExecution !== false ||
      p.remoteConnectorsUsed !== false || p.requiresUserReview !== true ||
      !Array.isArray(p.steps) || p.steps.length < 1 || p.steps.length > 5 ||
      Object.keys(p).some(k => !['taskId','status','steps','externalEffects','financialExecution','remoteConnectorsUsed','requiresUserReview'].includes(k))) return null;
  const seen = new Set<string>();
  for (const step of p.steps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return null;
    const s = step as Record<string, unknown>;
    if (!actions.has(String(s.action)) ||
        typeof s.description !== 'string' ||
        s.description.trim().length === 0 || s.description.length > 240 ||
        Object.keys(s).some(k => !['action','description'].includes(k))) return null;
    seen.add(s.action as string);
  }
  if (!seen.has('review_request') || !seen.has('approve_before_execution')) return null;
  return {
    taskId: expectedTaskId, status: 'preview_ready',
    steps: (p.steps as MayaAgenticsReviewStep[]).map(s => ({action:s.action,description:s.description})),
    externalEffects: false, financialExecution: false,
    remoteConnectorsUsed: false, requiresUserReview: true,
  };
}
