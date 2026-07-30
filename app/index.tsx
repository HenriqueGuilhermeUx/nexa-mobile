import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Brand,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      const session = await loadNexaSession();
      if (!mounted) return;

      if (session) {
        router.replace('/legacy' as any);
        return;
      }
      setChecking(false);
    }

    void resolveSession();
    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loaderText}>Abrindo a Nexa...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Brand />
        <View style={styles.hero}>
          <Title>Cripto sem complicação.</Title>
          <Paragraph>
            Pix e USDC em uma experiência simples, segura e transparente.
          </Paragraph>
        </View>

        <ActionButton label="Entrar" onPress={() => router.push('/sign-in')} />
        <ActionButton
          label="Criar conta"
          variant="secondary"
          onPress={() => router.push('/sign-up')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loaderText: { color: colors.muted, textAlign: 'center' },
  content: { flex: 1, justifyContent: 'center' },
  hero: { marginVertical: spacing.xl },
});
