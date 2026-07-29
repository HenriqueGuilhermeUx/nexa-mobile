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
      <Stack.Screen name="new-order" options={{ title: 'Nova operação' }} />
      <Stack.Screen name="activity" options={{ title: 'Atividade' }} />
    </Stack>
  );
}