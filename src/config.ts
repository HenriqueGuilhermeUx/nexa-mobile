import Constants from 'expo-constants';

interface NexaExtra {
  apiUrl?: string;
  privyAppId?: string;
  privyClientId?: string;
  financialExecutionEnabled?: boolean;
  releaseChannel?: string;
}

const extra = (Constants.expoConfig?.extra || {}) as NexaExtra;

export const config = {
  apiUrl:
    extra.apiUrl || 'https://nexa-backend-p2u0.onrender.com/api/v1',
  appVersion: Constants.expoConfig?.version || '2.0.3',
  privyAppId: extra.privyAppId || '',
  privyClientId: extra.privyClientId || '',
  financialExecutionEnabled: extra.financialExecutionEnabled === true,
  releaseChannel: extra.releaseChannel || 'production',
};

export function assertPublicConfiguration() {
  if (!config.privyAppId || !config.privyClientId) {
    throw new Error('Configuração pública da Privy ausente no app.json.');
  }
  if (!config.apiUrl.startsWith('https://')) {
    throw new Error('A API móvel deve usar HTTPS.');
  }
}