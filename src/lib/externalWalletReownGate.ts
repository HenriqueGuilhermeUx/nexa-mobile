/**
 * Explicit activation policy for external-wallet connection.
 * Defaults disabled; does not start SDK, prompt wallets or send transactions.
 * License, project credentials and native build validation are release gates.
 */
export function assertReownExternalWalletReady(input: {
  enabled: boolean;
  projectId?: string;
  licenseApproved: boolean;
  nativeBuildVerified: boolean;
  environment: 'development' | 'preview' | 'production';
}) {
  if (!input.enabled) throw new Error('EXTERNAL_WALLET_CONNECTION_DISABLED');
  if (input.environment === 'production') throw new Error('PRODUCTION_ROLLOUT_NOT_APPROVED');
  if (!input.projectId || !/^[a-zA-Z0-9]{16,128}$/.test(input.projectId)) {
    throw new Error('REOWN_PROJECT_ID_REQUIRED');
  }
  if (!input.licenseApproved) throw new Error('REOWN_LICENSE_REVIEW_REQUIRED');
  if (!input.nativeBuildVerified) throw new Error('NATIVE_WALLET_BUILD_UNVERIFIED');
  return { ready: true as const, network: 'polygon' as const, transferEnabled: false as const };
}
