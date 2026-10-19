import '@walletconnect/react-native-compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  return createAppKit({
    projectId,
    storage: {
      getItem: async <T = unknown>(key: string) => {
        const data = await AsyncStorage.getItem('nexa.reown.' + key);
        return data === null ? undefined : JSON.parse(data) as T;
      },
      setItem: async <T = unknown>(key: string, value: T) => {
        await AsyncStorage.setItem('nexa.reown.' + key, JSON.stringify(value));
      },
      removeItem: async (key: string) => {
        await AsyncStorage.removeItem('nexa.reown.' + key);
      },
      getKeys: async () =>
        (await AsyncStorage.getAllKeys())
          .filter(key => key.startsWith('nexa.reown.'))
          .map(key => key.slice('nexa.reown.'.length)),
      getEntries: async <T = unknown>(): Promise<[string, T][]> => {
        const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('nexa.reown.'));
        const pairs = await AsyncStorage.multiGet(keys);
        return pairs.filter((p): p is [string, string] => p[1] !== null)
          .map(([k, value]) => [k.slice('nexa.reown.'.length), JSON.parse(value) as T]);
      },
    },
    networks: [polygon],
    defaultNetwork: polygon,
    adapters: [new EthersAdapter()],
    metadata: {
      name: 'Nexa',
      description: 'Conectar carteira externa à Nexa',
      url: 'https://trynexa.com.br',
      icons: ['https://trynexa.com.br/favicon.ico'],
      redirect: { native: 'nexa://' },
    },
  });
}
