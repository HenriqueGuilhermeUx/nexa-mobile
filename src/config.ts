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
}

const extra = (Constants.expoConfig?.extra || {}) as NexaExtra;

export const config = {
  apiUrl:
    extra.apiUrl || 'https://nexa-backend-p2u0.onrender.com/api/v1',
  appVersion: Constants.expoConfig?.version || '2.0.6',
  privyAppId: extra.privyAppId || '',
  privyClientId: extra.privyClientId || '',
  financialExecutionEnabled: extra.financialExecutionEnabled === true,
  ledgerOperationsEnabled: extra.ledgerOperationsEnabled !== false,
  balanceSource: extra.balanceSource || 'ledger',
  privyOptional: extra.privyOptional !== false,
  releaseChannel: extra.releaseChannel || 'production',
};

export function assertPublicConfiguration() {
  if (!config.apiUrl.startsWith('https://')) {
    throw new Error('A API móvel deve usar HTTPS.');
  }
}
