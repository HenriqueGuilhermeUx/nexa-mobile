import React from 'react';
import Constants from 'expo-constants';
import { PrivyProvider } from '@privy-io/expo';
import ForceUpdateRoot from './ForceUpdateRoot';

function getPrivyConfiguration() {
  const extra = Constants.expoConfig?.extra || {};
  return {
    appId: String(extra.privyAppId || '').trim(),
    clientId: String(extra.privyClientId || '').trim(),
  };
}

export default function PrivyRoot() {
  const { appId, clientId } = getPrivyConfiguration();
  const configured = Boolean(appId && clientId);

  if (!configured) {
    return (
      <ForceUpdateRoot
        privyEnabled={false}
        privyConfigurationError="A configuração móvel da Privy aguarda o Client ID público do App Client."
      />
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <ForceUpdateRoot privyEnabled={true} />
    </PrivyProvider>
  );
}
