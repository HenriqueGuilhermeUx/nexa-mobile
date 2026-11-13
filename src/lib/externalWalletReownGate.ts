/**
 * Explicit activation policy for external-wallet connection.
 * Defaults disabled; does not start SDK, prompt wallets or send transactions.
 * Project ID, preview-only native lab mode and financial isolation are QA gates.
 * License review and verified native callback remain required before wider rollout.
 */
export function assertReownExternalWalletReady(input: {
  enabled: boolean;
  projectId?: string;
  licenseApproved: boolean;
  nativeBuildVerified: boolean;
  nativeQaMode?: boolean;
  environment: 'development' | 'preview' | 'production';
}) {
  if (!input.enabled) throw new Error('EXTERNAL_WALLET_CONNECTION_DISABLED');
  if (input.environment === 'production') throw new Error('PRODUCTION_ROLLOUT_NOT_APPROVED');
  if (!input.projectId || !/^[a-zA-Z0-9]{16,128}$/.test(input.projectId)) {
    throw new Error('REOWN_PROJECT_ID_REQUIRED');
  }
  // A specifically activated preview-only lab may test pairing before formal
  // release review. It cannot authorize a customer-facing release or funds.
  if (!input.licenseApproved && !input.nativeQaMode) {
    throw new Error('REOWN_LICENSE_REVIEW_REQUIRED');
  }
  // An unverified native build may only enter a specifically approved preview QA session.
  if (input.nativeQaMode && input.environment !== 'preview') {
    throw new Error('REOWN_NATIVE_QA_PREVIEW_ONLY');
  }
  if (!input.nativeBuildVerified && !input.nativeQaMode) {
    throw new Error('NATIVE_WALLET_BUILD_UNVERIFIED');
  }
  return {
    ready: true as const,
    network: 'polygon' as const,
    internalQaOnly: !input.nativeBuildVerified,
    transferEnabled: false as const,
  };
}
