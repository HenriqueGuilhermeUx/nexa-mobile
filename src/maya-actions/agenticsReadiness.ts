/**
 * Maya Agentics capabilities adapter — read-only and side-effect-free.
 *
 * This validates the response shape expected from a future Nexa-owned
 * authenticated proxy. Never use the Agentics platform's operator, reviewer,
 * admin or agx_ credentials in a mobile client.
 */
export type MayaAgenticsReadiness = {
  available: boolean;
  mode: 'disabled' | 'review_only';
  authenticatedByNexa: boolean;
  actorUserId: string | null;
  userScopedJobs: boolean;
  externalEffects: false;
  financialExecution: false;
  supportedIntents: string[];
};

export const MAYA_AGENTICS_DISABLED: MayaAgenticsReadiness = Object.freeze({
  available: false,
  mode: 'disabled',
  authenticatedByNexa: false,
  actorUserId: null,
  userScopedJobs: false,
  externalEffects: false,
  financialExecution: false,
  supportedIntents: [],
});

const allowedIntents = new Set(['research', 'calendar_draft', 'communication_draft', 'form_draft', 'price_comparison_read_only']);

export function parseMayaAgenticsReadiness(raw: unknown, signedInNexaUserId: string): MayaAgenticsReadiness {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !signedInNexaUserId.trim()) return MAYA_AGENTICS_DISABLED;
  const data = raw as Record<string, unknown>;
  // Agentics v1 /api/v1/capabilities returns mode:'isolated_core',
  // customerDataAccess:false, financialExecution:false. It is NOT proof
  // of a Nexa user-bound bridge. Reject unless the proxy makes this explicit.
  if (data.contract !== 'nexa-maya-agentics-bridge-v1' ||
      data.authenticatedByNexa !== true ||
      data.actorUserId !== signedInNexaUserId ||
      data.userScopedJobs !== true ||
      data.externalEffects !== false ||
      data.financialExecution !== false ||
      data.mode !== 'review_only' ||
      data.available !== true ||
      !Array.isArray(data.supportedIntents) ||
      data.supportedIntents.length > allowedIntents.size ||
      data.supportedIntents.some(v => typeof v !== 'string' || !allowedIntents.has(v))) {
    return MAYA_AGENTICS_DISABLED;
  }

  return {
    available: true,
    mode: 'review_only',
    authenticatedByNexa: true,
    actorUserId: signedInNexaUserId,
    userScopedJobs: true,
    externalEffects: false,
    financialExecution: false,
    supportedIntents: [...data.supportedIntents] as string[],
  };
}
