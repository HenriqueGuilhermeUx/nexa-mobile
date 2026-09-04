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

function isPremiumProfile(profile: any) {
  const status = String(
    profile?.premiumStatus ||
      profile?.subscriptionStatus ||
      profile?.plan ||
      profile?.premium?.status ||
      '',
  ).toLowerCase();

  return Boolean(
    profile?.isPremium === true ||
      profile?.premiumActive === true ||
      profile?.premium?.active === true ||
      status === 'premium' ||
      status === 'active' ||
      status === 'ativo',
  );
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

        const [profileResponse, meResponse] = await Promise.all([
          nexaApi.directProfile(session.accessToken),
          nexaApi.me(session.accessToken),
        ]);
        if (!mounted) return;

        const profile = valueFromProfile(profileResponse);
        const me = meResponse?.user || meResponse || {};
        const premium = isPremiumProfile({ ...profile, ...me });

        // A carteira individual é um recurso Premium. Usuários que já possuem
        // wallet vinculada continuam podendo acessá-la, independentemente de
        // mudanças futuras no plano, para nunca perderem acesso ao endereço.
        const alreadyLinked =
          profile?.wallet?.linked === true ||
          Boolean(profile?.wallet?.address || me?.walletAddress);

        if (!premium && !alreadyLinked) {
          router.replace('/legacy' as any);
          return;
        }

        if (isLegacyProfile(profile) && !premium && !alreadyLinked) {
          router.replace('/legacy' as any);
          return;
        }

        if (alreadyLinked) {
          router.replace('/legacy' as any);
          return;
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível preparar sua carteira Premium.',
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

      void nexaApi.auditWallet(session.accessToken).catch(() => undefined);
      router.replace('/legacy' as any);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir sua carteira. Tente novamente.',
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
        <Text style={styles.loaderText}>Preparando sua carteira Premium...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Brand />
        <View style={styles.hero}>
          <Title>Minha Carteira Premium</Title>
          <Paragraph>
            Crie sua carteira individual para receber USDC externamente e usar
            os recursos on-chain da Nexa Premium.
          </Paragraph>
        </View>

        <ActionButton
          label={wallet ? 'Vincular carteira' : 'Criar Minha Carteira'}
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
