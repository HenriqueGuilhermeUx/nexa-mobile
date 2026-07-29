import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const privy = usePrivy() as any;
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function resolveSession() {
      if (!privy.isReady) return;
      const session = await loadNexaSession();
      if (!mounted) return;
      if (session && privy.user) {
        router.replace('/onboarding-wallet');
        return;
      }
      setChecking(false);
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
        <Text style={styles.loaderText}>Preparando sua experiência Nexa...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Brand />
      <Badge tone="info">ABERTURA GRADUAL</Badge>
      <View style={styles.heroSpace} />
      <Eyebrow>Ativos digitais para brasileiros</Eyebrow>
      <Title>O futuro não precisa parecer complicado.</Title>
      <Paragraph>
        A Nexa aproxima Pix, USDC e uma carteira individual em uma experiência
        clara. Você não precisa dominar toda a tecnologia para começar.
      </Paragraph>

      <ActionButton
        label="Já recebi meu convite"
        onPress={() => router.push('/sign-in')}
      />
      <ActionButton
        label="Quero ser um dos Primeiros Nexa"
        variant="secondary"
        onPress={() => router.push('/primeiros-nexa')}
      />

      <View style={styles.cards}>
        <Card style={styles.smallCard}>
          <Text style={styles.cardNumber}>01</Text>
          <Text style={styles.cardTitle}>Pix familiar</Text>
          <Text style={styles.cardBody}>Comece por um meio que você já usa.</Text>
        </Card>
        <Card style={styles.smallCard}>
          <Text style={styles.cardNumber}>02</Text>
          <Text style={styles.cardTitle}>Etapas claras</Text>
          <Text style={styles.cardBody}>Estimativa não vira saldo final.</Text>
        </Card>
      </View>

      <Text style={styles.disclaimer}>
        A Nexa não promete lucro ou rendimento. A proposta é acesso,
        simplicidade, transparência e controle.
      </Text>
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
  heroSpace: { height: spacing.lg },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  smallCard: { flex: 1, minHeight: 150 },
  cardNumber: { color: colors.cyan, fontWeight: '900', fontSize: 12 },
  cardTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
    marginTop: spacing.md,
  },
  cardBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  disclaimer: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
