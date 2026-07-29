import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Brand, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

function profileFrom(response: any) {
  return response?.profile || response || {};
}

function isLegacyProfile(profile: any) {
  const value = String(profile?.settlementProfile || '').toLowerCase();
  return profile?.isLegacyBeta === true || value.includes('legacy');
}

export default function WelcomeScreen() {
  const privy = usePrivy() as any;
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function resolveSession() {
      if (!privy.isReady) return;

      const session = await loadNexaSession();
      if (!mounted) return;
      if (!session) {
        setChecking(false);
        return;
      }

      try {
        const response = await nexaApi.directProfile(session.accessToken);
        if (!mounted) return;
        const profile = profileFrom(response);

        if (isLegacyProfile(profile) || profile?.wallet?.linked === true) {
          router.replace('/(app)');
          return;
        }

        if (privy.user) {
          router.replace('/onboarding-wallet');
          return;
        }

        router.replace('/sign-in');
      } catch {
        if (mounted) setChecking(false);
      }
    }

    void resolveSession();
    return () => {
      mounted = false;
    };
  }, [privy.isReady, privy.user]);

  if (checking || !privy.isReady) {
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