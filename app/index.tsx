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
import { config } from '@/config';
import { ApiError, nexaApi } from '@/lib/api';
import { clearNexaSession, loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

function approvedDestination() {
  return config.walletV15PilotMode
    ? ('/onboarding-wallet' as any)
    : ('/legacy' as any);
}

export default function WelcomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      const session = await loadNexaSession();
      if (!mounted) return;

      if (session) {
        try {
          const profile = await nexaApi.me(session.accessToken);
          if (!mounted) return;
          router.replace(
            profile?.kycStatus === 'approved'
              ? approvedDestination()
              : ('/kyc' as any),
          );
          return;
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 401) {
            await clearNexaSession();
            if (mounted) setChecking(false);
            return;
          }

          if (config.walletV15PilotMode) {
            setChecking(false);
            return;
          }

          router.replace('/legacy' as any);
          return;
        }
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
          {config.walletV15PilotMode ? (
            <Text style={styles.pilot}>Wallet V1.5 • piloto controlado</Text>
          ) : null}
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
  pilot: {
    color: colors.cyan,
    fontWeight: '800',
    marginTop: spacing.md,
  },
});
