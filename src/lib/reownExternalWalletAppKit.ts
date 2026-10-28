import '@walletconnect/react-native-compat';
import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { polygon } from 'viem/chains';
import { assertReownExternalWalletReady } from './externalWalletReownGate';

/**
 * Reown setup for a separately enabled native build.
 * IMPORTANT: intentionally not imported by app/_layout.tsx or the production app.
 * Only call after checking license, registering project ID / bundle ID
 * and validating the deep-link callback in an isolated development build.
 */
export function initializeExternalWalletAppKit(options: Parameters<typeof assertReownExternalWalletReady>[0]) {
  assertReownExternalWalletReady(options);
  const projectId = options.projectId!;
  // View-only QA sessions must not survive sign-out/restart. In particular, a
  // different Nexa account must never inherit a previous tester's wallet.
  // Keep Reown's storage adapter in memory; no on-disk nexа.reown keys.
  const sessionStore = new Map<string, unknown>();
  return createAppKit({
    projectId,
    // Ownership proof only. Do not expose third-party swaps, onramps or
    // social wallet creation beside Nexa's existing Privy login.
    features: { swaps: false, onramp: false, socials: false },
    enableAnalytics: false,
    themeMode: 'dark',
    storage: {
      getItem: async <T = unknown>(key: string): Promise<T | undefined> =>
        sessionStore.get(key) as T | undefined,
      setItem: async <T = unknown>(key: string, value: T) => {
        sessionStore.set(key, value);
      },
      removeItem: async (key: string) => {
        sessionStore.delete(key);
      },
      getKeys: async () => [...sessionStore.keys()],
      getEntries: async <T = unknown>(): Promise<[string, T][]> =>
        [...sessionStore.entries()].map(([key, value]) => [key, value as T]),
    },
    networks: [polygon],
    defaultNetwork: polygon,
    adapters: [new EthersAdapter()],
    metadata: {
      name: 'Nexa',
      description: 'Conectar carteira externa à Nexa',
      url: 'https://trynexa.com.br',
      icons: ['https://trynexa.com.br/favicon.ico'],
      redirect: { native: 'nexa-walletconnect-qa://' },
    },
  });
}
