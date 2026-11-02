import { config } from '@/config';

/**
 * WalletConnect product entry is a QA-only capability until financial inbound
 * and outbound flows have been reconciled and explicitly approved.
 * This flag controls navigation only; it NEVER authorizes money movement.
 */
export const walletConnectProductPreviewEnabled =
  config.releaseChannel === 'wallet-inbound-lab' &&
  process.env.EXPO_PUBLIC_NEXA_WALLET_CONNECT_UI_ENABLED === 'true' &&
  process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED === 'false';

export const walletConnectFinancialOperationsEnabled = false as const;
