import { useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Brand, Card, Paragraph, Screen, Title } from '@/components/ui';
import { config } from '@/config';
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

function walletV15Profile(response: any) {
  return response?.status?.profile || response?.profile || null;
}

function ownershipReady(profile: any) {
  return Boolean(
    profile?.userControlledWalletConfirmed === true &&
      profile?.walletOwnershipEvidence === 'eip191_v1:polygon:137' &&
      profile?.destinationWallet,
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
  const [step, setStep] = useState('Preparando sua carteira...');
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

        if (config.walletV15PilotMode) {
          const me = await nexaApi.me(session.accessToken);
          if (me?.kycStatus !== 'approved') {
            router.replace('/kyc' as any);
            return;
          }

          const snapshot = await nexaApi.walletV15Me(session.accessToken);
          if (!mounted) return;
          if (ownershipReady(walletV15Profile(snapshot))) {
            router.replace('/(app)');
            return;
          }
          setStep('Crie ou confirme sua carteira individual.');
          return;
        }

        const response = await nexaApi.directProfile(session.accessToken);
        if (!mounted) return;
        const profile = valueFromProfile(response);

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

  async function getPrivyProvider(currentWallet: any) {
    if (typeof currentWallet?.getProvider === 'function') {
      return currentWallet.getProvider();
    }
    if (typeof currentWallet?.getEthereumProvider === 'function') {
      return currentWallet.getEthereumProvider();
    }
    throw new Error('A wallet Privy não disponibilizou o provedor de assinatura.');
  }

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
        throw new Error('Sua sessão Privy expirou. Entre novamente.');
      }
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) {
        throw new Error('Sua sessão Privy expirou. Entre novamente.');
      }

      const privyWalletId = String(
        currentWallet.id || currentWallet.walletId || currentWallet.address,
      );

      setStep('Vinculando sua wallet à conta Nexa...');
      await nexaApi.linkWallet(session.accessToken, privyAccessToken, {
        privyWalletId,
        walletAddress: currentWallet.address,
      });

      if (config.walletV15PilotMode) {
        setStep('Preparando Wallet V1.5...');
        await nexaApi.prepareWalletV15Me(session.accessToken);
        await nexaApi.setWalletV15Destination(
          session.accessToken,
          currentWallet.address,
        );

        setStep('Gerando prova de controle da wallet...');
        const challenge = await nexaApi.createWalletV15OwnershipChallenge(
          session.accessToken,
        );
        if (
          challenge.chainId !== 137 ||
          challenge.destinationWallet.toLowerCase() !==
            String(currentWallet.address).toLowerCase()
        ) {
          throw new Error('O challenge retornado pela Nexa não corresponde à sua wallet Polygon.');
        }

        const provider = await getPrivyProvider(currentWallet);
        setStep('Confirme a assinatura na sua wallet. Isso não movimenta fundos.');
        const signed = await provider.request({
          method: 'personal_sign',
          params: [challenge.message, currentWallet.address],
        });
        const signature =
          typeof signed === 'string' ? signed : String(signed?.signature || '');
        if (!signature.startsWith('0x')) {
          throw new Error('A wallet não retornou uma assinatura válida.');
        }

        setStep('Validando assinatura com a Nexa...');
        const verified = await nexaApi.verifyWalletV15Ownership(
          session.accessToken,
          signature,
        );
        if (verified.confirmed !== true) {
          throw new Error('A prova de controle da wallet não foi confirmada.');
        }

        setStep('Wallet confirmada. Abrindo sua Nexa...');
        void nexaApi.auditWallet(session.accessToken).catch(() => undefined);
        router.replace('/(app)');
        return;
      }

      void nexaApi.auditWallet(session.accessToken).catch(() => undefined);
      router.replace('/(app)');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir a carteira. Tente novamente.',
      );
      setStep('Não concluído. Você pode tentar novamente com segurança.');
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
      setStep('Criando sua carteira Privy...');
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
        <Text style={styles.loaderText}>{step}</Text>
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
            {config.walletV15PilotMode
              ? 'Sua carteira Privy será vinculada à Polygon e você assinará uma mensagem para provar que controla o endereço. Assinar não transfere fundos nem paga gas.'
              : 'Crie sua carteira individual e continue. O processo leva apenas alguns segundos.'}
          </Paragraph>
        </View>

        {config.walletV15PilotMode ? (
          <Card>
            <Text style={styles.stepTitle}>Wallet V1.5</Text>
            <Text style={styles.stepText}>{step}</Text>
            {wallet?.address ? (
              <Text selectable style={styles.address}>
                {wallet.address}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <ActionButton
          label={
            wallet
              ? config.walletV15PilotMode
                ? 'Confirmar wallet e continuar'
                : 'Continuar'
              : 'Criar carteira e continuar'
          }
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
  stepTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  stepText: { color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
  address: { color: colors.cyan, marginTop: spacing.sm, fontSize: 12 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
