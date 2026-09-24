import Constants from 'expo-constants';

interface NexaExtra {
  apiUrl?: string;
  efiOpenFinanceApiUrl?: string;
  privyAppId?: string;
  privyClientId?: string;
  financialExecutionEnabled?: boolean;
  ledgerOperationsEnabled?: boolean;
  balanceSource?: string;
  privyOptional?: boolean;
  releaseChannel?: string;
  androidTargetApi?: number;
  assistantEnabled?: boolean;
  efiOpenFinanceEnabled?: boolean;
  efiOpenFinanceRecurringEnabled?: boolean;
}

const extra = (Constants.expoConfig?.extra || {}) as NexaExtra;
const envApiUrl = String(process.env.EXPO_PUBLIC_NEXA_API_URL || '').trim();
const envEfiOpenFinanceApiUrl = String(
  process.env.EXPO_PUBLIC_NEXA_EFI_OPEN_FINANCE_API_URL || '',
).trim();
const envFinancialExecution = String(
  process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED || '',
)
  .trim()
  .toLowerCase();
const envAssistantEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_ASSISTANT_ENABLED || '',
)
  .trim()
  .toLowerCase();
const envEfiOpenFinanceEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_EFI_OPEN_FINANCE_ENABLED || '',
)
  .trim()
  .toLowerCase();
const envEfiOpenFinanceRecurringEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_EFI_OPEN_FINANCE_RECURRING_ENABLED || '',
)
  .trim()
  .toLowerCase();
const envReleaseChannel = String(
  process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL || '',
).trim();

const apiUrl =
  envApiUrl ||
  extra.apiUrl ||
  'https://nexa-backend-p2u0.onrender.com/api/v1';

export const config = {
  apiUrl,
  efiOpenFinanceApiUrl:
    envEfiOpenFinanceApiUrl || extra.efiOpenFinanceApiUrl || apiUrl,
  appVersion: Constants.expoConfig?.version || '2.0.19',
  appBuild: String(Constants.expoConfig?.android?.versionCode || '114'),
  privyAppId: extra.privyAppId || '',
  privyClientId: extra.privyClientId || '',
  financialExecutionEnabled:
    envFinancialExecution === 'true' ||
    (envFinancialExecution !== 'false' && extra.financialExecutionEnabled === true),
  assistantEnabled:
    envAssistantEnabled === 'true' ||
    (envAssistantEnabled !== 'false' && extra.assistantEnabled === true),
  efiOpenFinanceEnabled:
    envEfiOpenFinanceEnabled === 'true' ||
    (envEfiOpenFinanceEnabled !== 'false' && extra.efiOpenFinanceEnabled === true),
  efiOpenFinanceRecurringEnabled:
    envEfiOpenFinanceRecurringEnabled === 'true' ||
    (envEfiOpenFinanceRecurringEnabled !== 'false' &&
      extra.efiOpenFinanceRecurringEnabled === true),
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
  if (!config.efiOpenFinanceApiUrl.startsWith('https://')) {
    throw new Error('A API Open Finance móvel deve usar HTTPS.');
  }
}
