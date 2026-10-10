import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AuthenticatedLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new-order" options={{ title: 'Adicionar com Pix' }} />
      <Stack.Screen name="activity" options={{ title: 'Histórico' }} />
      <Stack.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Stack.Screen name="pay" options={{ title: 'Pagar conta' }} />
    </Stack>
  );
}
