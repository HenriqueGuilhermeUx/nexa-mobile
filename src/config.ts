import Constants from 'expo-constants';

interface NexaExtra {
  apiUrl?: string;
  privyAppId?: string;
  privyClientId?: string;
  financialExecutionEnabled?: boolean;
  ledgerOperationsEnabled?: boolean;
  balanceSource?: string;
  privyOptional?: boolean;
  releaseChannel?: string;
  androidTargetApi?: number;
  walletV15PilotMode?: boolean;
}

const extra = (Constants.expoConfig?.extra || {}) as NexaExtra;
const envApiUrl = String(process.env.EXPO_PUBLIC_NEXA_API_URL || '').trim();
const envPilotMode = String(process.env.EXPO_PUBLIC_NEXA_WALLET_V15_PILOT || '')
  .trim()
  .toLowerCase();

export const config = {
  apiUrl:
    envApiUrl ||
    extra.apiUrl ||
    'https://nexa-backend-p2u0.onrender.com/api/v1',
  appVersion: Constants.expoConfig?.version || '2.0.10',
  appBuild: String(Constants.expoConfig?.android?.versionCode || '103'),
  privyAppId: extra.privyAppId || '',
  privyClientId: extra.privyClientId || '',
  financialExecutionEnabled: extra.financialExecutionEnabled === true,
  ledgerOperationsEnabled: extra.ledgerOperationsEnabled !== false,
  balanceSource: extra.balanceSource || 'ledger',
  privyOptional: extra.privyOptional !== false,
  releaseChannel: extra.releaseChannel || 'production',
  androidTargetApi: Number(extra.androidTargetApi || 36),
  walletV15PilotMode:
    envPilotMode === 'true' ||
    (envPilotMode !== 'false' && extra.walletV15PilotMode === true),
};

export function assertPublicConfiguration() {
  if (!config.apiUrl.startsWith('https://')) {
    throw new Error('A API móvel deve usar HTTPS.');
  }
}
