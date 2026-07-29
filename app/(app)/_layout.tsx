import { AuthBoundary } from '@privy-io/expo';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.muted}>Validando sua sessão Privy...</Text>
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Não foi possível validar sua sessão.</Text>
      <Text style={styles.muted}>
        {error instanceof Error ? error.message : 'Abra o app novamente.'}
      </Text>
    </View>
  );
}

export default function AuthenticatedLayout() {
  return (
    <AuthBoundary
      loading={<Loading />}
      error={(error) => <ErrorState error={error} />}
      unauthenticated={<Redirect href="/sign-in" />}
    >
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
    </AuthBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  muted: { color: colors.muted, textAlign: 'center' },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 18 },
});
