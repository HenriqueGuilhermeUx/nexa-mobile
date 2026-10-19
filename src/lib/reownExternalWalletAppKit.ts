import '@walletconnect/react-native-compat';
import { createAppKit } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { polygon } from 'viem/chains';

/**
 * Reown setup for a separately enabled native build.
 * IMPORTANT: intentionally not imported by app/_layout.tsx or the production app.
 * Only call after checking license, registering project ID / bundle ID
 * and validating the deep-link callback in an isolated development build.
 */
export function initializeExternalWalletAppKit(projectId: string) {
  if (!/^[a-zA-Z0-9]{16,128}$/.test(projectId)) {
    throw new Error('REOWN_PROJECT_ID_REQUIRED');
  }
  return createAppKit({
    projectId,
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
