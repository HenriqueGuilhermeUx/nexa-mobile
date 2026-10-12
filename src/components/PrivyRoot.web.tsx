import type { PropsWithChildren } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';

import { config } from '@/config';

export function PrivyRoot({ children }: PropsWithChildren) {
  if (!config.privyAppId) {
    throw new Error('Nexa Global Privy app id is missing.');
  }

  return (
    <PrivyProvider
      appId={config.privyAppId}
      clientId={config.privyClientId || undefined}
      config={{
        loginMethods: ['email'],
        appearance: {
          theme: 'dark',
          accentColor: '#00D4FF',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'off',
          },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
