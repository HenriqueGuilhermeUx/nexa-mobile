import { useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Brand, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function valueFromProfile(response: any) {
  return response?.profile || response || {};
}

function isLegacyProfile(profile: any) {
  const value = String(profile?.settlementProfile || '').toLowerCase();
  return profile?.isLegacyBeta === true || value.includes('legacy');
}

export default function WalletOnboardingScreen() {
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const wallet = useMemo(
    () =>
      wallets.find((candidate) =>
        /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || '')),
      ) || null,
    [wallets],
  );

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [linkWhenReady, setLinkWhenReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!privy.isReady) return;
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }

        const response = await nexaApi.directProfile(session.accessToken);
        if (!mounted) return;
        const profile = valueFromProfile(response);

        // Usuários antigos permanecem na experiência completa já existente.
        if (isLegacyProfile(profile)) {
          router.replace('/legacy' as any);
          return;
        }

        if (profile?.wallet?.linked === true) {
          router.replace('/(app)');
          return;
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível preparar sua carteira.',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [privy.isReady]);

  async function linkWallet(currentWallet: any) {
    setError('');
    setWorking(true);
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }
      if (!currentWallet?.address) {
        throw new Error('A carteira ainda não ficou pronta. Tente novamente.');
      }

      const getAccessToken = privy.getAccessToken;
      if (typeof getAccessToken !== 'function') {
        throw new Error('Sua sessão expirou. Entre novamente.');
      }
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) {
        throw new Error('Sua sessão expirou. Entre novamente.');
      }

      const privyWalletId = String(
        currentWallet.id || currentWallet.walletId || currentWallet.address,
      );
      await nexaApi.linkWallet(session.accessToken, privyAccessToken, {
        privyWalletId,
        walletAddress: currentWallet.address,
      });

      // A carteira já está válida após o vínculo. A auditoria complementar é
      // executada em segundo plano e nunca impede o cliente de entrar no app.
      void nexaApi.auditWallet(session.accessToken).catch(() => undefined);
      router.replace('/(app)');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir a carteira. Tente novamente.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function prepareWallet() {
    setError('');
    if (wallet) {
      await linkWallet(wallet);
      return;
    }

    setWorking(true);
    try {
      if (!embedded.create) {
        throw new Error('A criação da carteira não está disponível.');
      }
      setLinkWhenReady(true);
      await embedded.create({ createAdditional: false });
    } catch (caught) {
      setLinkWhenReady(false);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível criar sua carteira. Tente novamente.',
      );
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    if (!linkWhenReady || !wallet || working) return;
    setLinkWhenReady(false);
    void linkWallet(wallet);
  }, [linkWhenReady, wallet?.address, working]);

  if (loading || !privy.isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Preparando sua conta...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Brand />
        <View style={styles.hero}>
          <Title>Sua carteira Nexa</Title>
          <Paragraph>
            Crie sua carteira individual e continue. O processo leva apenas alguns segundos.
          </Paragraph>
        </View>

        <ActionButton
          label={wallet ? 'Continuar' : 'Criar carteira e continuar'}
          loading={working || linkWhenReady}
          onPress={prepareWallet}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});