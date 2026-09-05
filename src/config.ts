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
}

const extra = (Constants.expoConfig?.extra || {}) as NexaExtra;
const envApiUrl = String(process.env.EXPO_PUBLIC_NEXA_API_URL || '').trim();
const envFinancialExecution = String(
  process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED || '',
)
  .trim()
  .toLowerCase();
const envReleaseChannel = String(
  process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL || '',
).trim();

export const config = {
  apiUrl:
    envApiUrl ||
    extra.apiUrl ||
    'https://nexa-backend-p2u0.onrender.com/api/v1',
  appVersion: Constants.expoConfig?.version || '2.0.11',
  appBuild: String(Constants.expoConfig?.android?.versionCode || '105'),
  privyAppId: extra.privyAppId || '',
  privyClientId: extra.privyClientId || '',
  financialExecutionEnabled:
    envFinancialExecution === 'true' ||
    (envFinancialExecution !== 'false' && extra.financialExecutionEnabled === true),
  ledgerOperationsEnabled: extra.ledgerOperationsEnabled !== false,
  balanceSource: extra.balanceSource || 'ledger',
  privyOptional: extra.privyOptional !== false,
  releaseChannel: envReleaseChannel || extra.releaseChannel || 'production',
  androidTargetApi: Number(extra.androidTargetApi || 36),
};

export function assertPublicConfiguration() {
  if (!config.apiUrl.startsWith('https://')) {
    throw new Error('A API móvel deve usar HTTPS.');
  }
}
