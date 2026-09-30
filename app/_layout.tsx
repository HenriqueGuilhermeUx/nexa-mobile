import { AlchemyProvider } from '@account-kit/privy-integration/react-native';
import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PropsWithChildren, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/AppLockGate';
import { assertPublicConfiguration, config } from '@/config';
import { initializeNexaNotifications } from '@/lib/nexaNotifications';
import '@/lib/walletFirstProfilePatch';
import { colors } from '@/theme';

assertPublicConfiguration();

function ClientTransactionInfrastructure({ children }: PropsWithChildren) {
  if (!config.alchemyApiKey) return <>{children}</>;

  return (
    <AlchemyProvider
      apiKey={config.alchemyApiKey}
      policyId={config.alchemyGasPolicyId || undefined}
      accountAuthMode="eip7702"
    >
      {children}
    </AlchemyProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void initializeNexaNotifications().catch((error) => {
      console.warn('Nexa notifications initialization failed', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <PrivyProvider
        appId={config.privyAppId}
        clientId={config.privyClientId}
        config={{
          embedded: {
            ethereum: {
              // A Nexa não cria mais uma carteira on-chain automaticamente
              // para todo usuário. A criação é iniciada explicitamente pelo
              // fluxo Premium; carteiras já existentes continuam acessíveis.
              createOnLogin: 'off',
            },
          },
        }}
      >
        <ClientTransactionInfrastructure>
          <PrivyElements config={{ appearance: { colorScheme: 'dark' } }} />
          <StatusBar style="light" />
          <AppLockGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ title: 'Entrar' }} />
              <Stack.Screen name="sign-up" options={{ title: 'Criar conta' }} />
              <Stack.Screen name="legacy" options={{ headerShown: false }} />
              <Stack.Screen name="assistant" options={{ title: 'Assistente Nexa' }} />
              <Stack.Screen name="security" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding-wallet"
                options={{ title: 'Minha Carteira Premium' }}
              />
              <Stack.Screen
                name="wallet-ownership"
                options={{ title: 'Comprovar minha carteira' }}
              />
              <Stack.Screen
                name="wallet-recovery"
                options={{ title: 'Recuperar carteira' }}
              />
              <Stack.Screen
                name="purchase-authorization"
                options={{ title: 'Autorizar compra' }}
              />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
          </AppLockGate>
        </ClientTransactionInfrastructure>
      </PrivyProvider>
    </SafeAreaProvider>
  );
}
