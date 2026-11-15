/**
 * Nexa Maya <-> Agentics task envelope (client-only, NO NETWORK/EFFECTS).
 *
 * This is a contract for future authenticated Agentics orchestration. The
 * currently shipped Maya remains the sole entry point; this file does not
 * activate an Agentics service, connector, browser, payment or reservation.
 */
export type MayaAgenticIntent =
  | 'research'
  | 'calendar_draft'
  | 'communication_draft'
  | 'form_draft'
  | 'price_comparison_read_only';

export type MayaAgenticStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MayaAgenticMode = 'read_only' | 'approved_nonfinancial';

export type MayaAgenticTask = {
  id: string;
  ownerUserId: string;
  origin: 'nexa_agentics';
  intent: MayaAgenticIntent;
  mode: MayaAgenticMode;
  status: MayaAgenticStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  approval?: {
    approvedByUserId: string;
    approvedAt: string;
    scope: string;
    expiresAt: string;
  };
  evidence?: { title: string; url: string; observedAt: string }[];
  resultSummary?: string;
};

const intents = new Set<MayaAgenticIntent>([
  'research', 'calendar_draft', 'communication_draft', 'form_draft', 'price_comparison_read_only'
]);
const statuses = new Set<MayaAgenticStatus>([
  'draft', 'awaiting_approval', 'queued', 'running', 'completed', 'failed', 'cancelled'
]);

function dateIsValid(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && Number.isFinite(Date.parse(value));
}

function safeHttps(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || !host.includes('.')) return false;
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) return false;
    if (/^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return false;
    return true;
  } catch { return false; }
}

/**
 * Validate one response from a future authenticated backend before display.
 * This is not an authorization mechanism. Backend must enforce user ownership,
 * connector scopes, consent, idempotency, sandboxing and allowed side effects.
 */
export function validateMayaAgenticTask(
  raw: unknown,
  signedInUserId: string,
  now = Date.now(),
): MayaAgenticTask | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const task = raw as Record<string, any>;
  const account = signedInUserId.trim().toLowerCase();
  if (!account || task.ownerUserId !== signedInUserId) return null;
  if (task.origin !== 'nexa_agentics' || typeof task.id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(task.id)) return null;
  if (!intents.has(task.intent) || !statuses.has(task.status)) return null;
  if (task.mode !== 'read_only' && task.mode !== 'approved_nonfinancial') return null;
  if (typeof task.title !== 'string' || task.title.trim().length < 3 || task.title.length > 150) return null;
  if (!dateIsValid(task.createdAt) || !dateIsValid(task.updatedAt) ||
      Date.parse(task.createdAt) > now + 60_000 || Date.parse(task.updatedAt) > now + 60_000 ||
      Date.parse(task.updatedAt) < Date.parse(task.createdAt)) return null;
  if (task.resultSummary !== undefined && (typeof task.resultSummary !== 'string' || task.resultSummary.length > 1000)) return null;
  const approval = task.approval;
  if (task.mode === 'approved_nonfinancial' && ['queued','running','completed'].includes(task.status)) {
    if (!approval || approval.approvedByUserId !== signedInUserId ||
      typeof approval.scope !== 'string' || approval.scope.trim().length < 5 || approval.scope.length > 300 ||
      !dateIsValid(approval.approvedAt) || !dateIsValid(approval.expiresAt) ||
      Date.parse(approval.approvedAt) > now + 60_000 || Date.parse(approval.expiresAt) < now) return null;
  }
  if (task.evidence !== undefined) {
    if (!Array.isArray(task.evidence) || task.evidence.length > 8 ||
      task.evidence.some((v: any) => !v || typeof v.title !== 'string' || v.title.length > 150 ||
        !safeHttps(v.url) || !dateIsValid(v.observedAt) || Date.parse(v.observedAt) > now + 60_000)) return null;
  }
  return task as MayaAgenticTask;
}
