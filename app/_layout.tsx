import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/AppLockGate';
import { ForceUpdateGate } from '@/components/ForceUpdateGate';
import { assertPublicConfiguration, config } from '@/config';
import { initializeNexaNotifications } from '@/lib/nexaNotifications';
import '@/lib/walletFirstProfilePatch';
import { colors } from '@/theme';

assertPublicConfiguration();

export default function RootLayout() {
  useEffect(() => {
    void initializeNexaNotifications().catch((error) => {
      console.warn('Nexa notifications initialization failed', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ForceUpdateGate>
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
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ title: 'Crie sua Nexa' }} />
            <Stack.Screen name="legacy" options={{ headerShown: false }} />
            <Stack.Screen name="assistant" options={{ title: 'Assistente Nexa' }} />
            <Stack.Screen name="rewards-info" options={{ title: 'Sobre o Rewards' }} />
            <Stack.Screen name="premium-info" options={{ title: 'Sobre o Premium' }} />
            <Stack.Screen name="security" options={{ headerShown: false }} />
            <Stack.Screen
              name="onboarding-pix"
              options={{ title: 'Pix para resgates' }}
            />
            <Stack.Screen
              name="onboarding-wallet"
              options={{ title: 'Ativar minha wallet' }}
            />
            <Stack.Screen
              name="wallet-ownership"
              options={{ title: 'Confirmar minha wallet' }}
            />
            <Stack.Screen
              name="wallet-recovery"
              options={{ title: 'Recuperar carteira' }}
            />
            <Stack.Screen
              name="purchase-authorization"
              options={{ title: 'Confirmar conversão' }}
            />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </AppLockGate>
      </PrivyProvider>
      </ForceUpdateGate>
    </SafeAreaProvider>
  );
}
