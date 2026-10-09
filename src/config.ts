import Constants from 'expo-constants';

interface NexaExtra {
  apiUrl?: string;
  efiOpenFinanceApiUrl?: string;
  nexaPayApiUrl?: string;
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
  ecosystemEnabled?: boolean;
  ecosystemOnboardingEnabled?: boolean;
  docWalletEnabled?: boolean;
  healthWalletEnabled?: boolean;
  docWalletUrl?: string;
  healthWalletUrl?: string;
  docWalletPlayStoreUrl?: string;
  healthWalletPlayStoreUrl?: string;
  docWalletAppStoreUrl?: string;
  healthWalletAppStoreUrl?: string;
}

const extra = (Constants.expoConfig?.extra || {}) as NexaExtra;
const envApiUrl = String(process.env.EXPO_PUBLIC_NEXA_API_URL || '').trim();
const envEfiOpenFinanceApiUrl = String(
  process.env.EXPO_PUBLIC_NEXA_EFI_OPEN_FINANCE_API_URL || '',
).trim();
const envNexaPayApiUrl = String(
  process.env.EXPO_PUBLIC_NEXA_PAY_API_URL || '',
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
const envEcosystemEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_ECOSYSTEM_ENABLED || '',
).trim().toLowerCase();
const envEcosystemOnboardingEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_ECOSYSTEM_ONBOARDING_ENABLED || '',
).trim().toLowerCase();
const envDocWalletEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_DOCWALLET_ENABLED || '',
).trim().toLowerCase();
const envHealthWalletEnabled = String(
  process.env.EXPO_PUBLIC_NEXA_HEALTHWALLET_ENABLED || '',
).trim().toLowerCase();
const envDocWalletUrl = String(
  process.env.EXPO_PUBLIC_NEXA_DOCWALLET_URL || '',
).trim();
const envHealthWalletUrl = String(
  process.env.EXPO_PUBLIC_NEXA_HEALTHWALLET_URL || '',
).trim();
const envDocWalletPlayStoreUrl = String(
  process.env.EXPO_PUBLIC_NEXA_DOCWALLET_PLAY_STORE_URL || '',
).trim();
const envHealthWalletPlayStoreUrl = String(
  process.env.EXPO_PUBLIC_NEXA_HEALTHWALLET_PLAY_STORE_URL || '',
).trim();
const envDocWalletAppStoreUrl = String(
  process.env.EXPO_PUBLIC_NEXA_DOCWALLET_APP_STORE_URL || '',
).trim();
const envHealthWalletAppStoreUrl = String(
  process.env.EXPO_PUBLIC_NEXA_HEALTHWALLET_APP_STORE_URL || '',
).trim();
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
  nexaPayApiUrl:
    envNexaPayApiUrl || extra.nexaPayApiUrl || apiUrl,
  appVersion: Constants.expoConfig?.version || '2.0.23',
  appBuild: String(Constants.expoConfig?.android?.versionCode || '124'),
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
  ecosystemEnabled:
    envEcosystemEnabled === 'true' ||
    (envEcosystemEnabled !== 'false' && extra.ecosystemEnabled === true),
  ecosystemOnboardingEnabled:
    envEcosystemOnboardingEnabled === 'true' ||
    (envEcosystemOnboardingEnabled !== 'false' &&
      extra.ecosystemOnboardingEnabled === true),
  docWalletEnabled:
    envDocWalletEnabled === 'true' ||
    (envDocWalletEnabled !== 'false' && extra.docWalletEnabled === true),
  healthWalletEnabled:
    envHealthWalletEnabled === 'true' ||
    (envHealthWalletEnabled !== 'false' && extra.healthWalletEnabled === true),
  docWalletUrl:
    envDocWalletUrl || extra.docWalletUrl || 'https://trydocwallet.com',
  healthWalletUrl:
    envHealthWalletUrl || extra.healthWalletUrl || 'https://mydatamed.com/healthwallet',
  docWalletPlayStoreUrl:
    envDocWalletPlayStoreUrl ||
    extra.docWalletPlayStoreUrl ||
    'https://play.google.com/store/apps/details?id=br.com.alternativeventures.docwalletdocs',
  healthWalletPlayStoreUrl:
    envHealthWalletPlayStoreUrl ||
    extra.healthWalletPlayStoreUrl ||
    'https://play.google.com/store/apps/details?id=br.com.healthwallet.app',
  docWalletAppStoreUrl:
    envDocWalletAppStoreUrl || extra.docWalletAppStoreUrl || '',
  healthWalletAppStoreUrl:
    envHealthWalletAppStoreUrl || extra.healthWalletAppStoreUrl || '',
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
