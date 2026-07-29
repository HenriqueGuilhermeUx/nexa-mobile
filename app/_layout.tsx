import { PrivyProvider } from '@privy-io/expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { assertPublicConfiguration, config } from '@/config';
import { colors } from '@/theme';

assertPublicConfiguration();

export default function RootLayout() {
  return (
    <PrivyProvider
      appId={config.privyAppId}
      clientId={config.privyClientId}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="primeiros-nexa"
          options={{ title: 'Primeiros Nexa' }}
        />
        <Stack.Screen name="sign-in" options={{ title: 'Entrar na Nexa' }} />
        <Stack.Screen
          name="onboarding-wallet"
          options={{ title: 'Carteira Nexa' }}
        />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </PrivyProvider>
  );
}
