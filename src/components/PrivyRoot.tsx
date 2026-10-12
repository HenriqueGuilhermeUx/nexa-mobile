import type { PropsWithChildren } from 'react';
import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';

import { config } from '@/config';

export function PrivyRoot({ children }: PropsWithChildren) {
  return (
    <PrivyProvider
      appId={config.privyAppId}
      clientId={config.privyClientId}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: 'off',
          },
        },
      }}
    >
      <PrivyElements config={{ appearance: { colorScheme: 'dark' } }} />
      {children}
    </PrivyProvider>
  );
}
