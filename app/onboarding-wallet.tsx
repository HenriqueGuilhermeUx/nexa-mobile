import { useEffect, useMemo, useRef, useState } from 'react';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function validWallet(candidate: any) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || ''));
}

export default function WalletOnboardingScreen() {
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const wallet = useMemo(
    () => wallets.find((candidate) => validWallet(candidate)) || null,
    [wallets],
  );

  const startedRef = useRef(false);
  const linkingRef = useRef(false);
  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const [stage, setStage] = useState('Preparando sua Cripto Wallet…');
  const [error, setError] = useState('');

  async function currentPrivyToken() {
    if (typeof privy?.getAccessToken !== 'function') return '';
    try {
      return String((await privy.getAccessToken()) || '').trim();
    } catch {
      return '';
    }
  }

  async function linkWallet(currentWallet: any) {
    if (linkingRef.current || !validWallet(currentWallet)) return;
    linkingRef.current = true;
    setError('');
    setStage('Protegendo e vinculando sua carteira…');

    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }

      const privyAccessToken = await currentPrivyToken();
      if (!privyAccessToken) {
        router.replace({
          pathname: '/wallet-session' as any,
          params: { returnTo: 'onboarding-wallet' },
        });
        return;
      }

      const privyWalletId = String(
        currentWallet.id ||
          currentWallet.walletId ||
          currentWallet.wallet_id ||
          currentWallet.address,
      ).trim();

      await nexaApi.linkWallet(
        session.accessToken,
        privyAccessToken,
        {
          privyWalletId,
          walletAddress: currentWallet.address,
        },
      );

      setStage('Fazendo a checagem final…');
      await nexaApi.auditWallet(session.accessToken);
      router.replace('/wallet-ownership' as any);
    } catch (caught) {
      linkingRef.current = false;
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir sua Cripto Wallet.',
      );
    }
  }

  async function startWalletOnboarding() {
    if (startedRef.current) return;
    startedRef.current = true;
    setError('');

    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }

      const me = await nexaApi.me(session.accessToken);
      const linkedAddress = String(
        me?.wallet?.address || me?.walletAddress || '',
      ).trim();

      if (linkedAddress) {
        router.replace('/wallet-ownership' as any);
        return;
      }

      const privyAccessToken = await currentPrivyToken();
      if (!privyAccessToken) {
        router.replace({
          pathname: '/wallet-session' as any,
          params: { returnTo: 'onboarding-wallet' },
        });
        return;
      }

      if (wallet) {
        await linkWallet(wallet);
        return;
      }

      if (typeof embedded?.create !== 'function') {
        throw new Error('A criação da Cripto Wallet não está disponível neste aparelho.');
      }

      setStage('Criando sua Cripto Wallet…');
      setWaitingForWallet(true);
      const created = await embedded.create({ createAdditional: false });
      const createdWallet =
        validWallet(created)
          ? created
          : validWallet(created?.wallet)
            ? created.wallet
            : null;

      if (createdWallet) {
        setWaitingForWallet(false);
        await linkWallet(createdWallet);
        return;
      }

      // O hook da Privy publica a carteira logo depois de create(). O efeito
      // abaixo continua automaticamente assim que o endereço aparece.
      setStage('Finalizando sua Cripto Wallet…');
    } catch (caught) {
      startedRef.current = false;
      setWaitingForWallet(false);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível preparar sua Cripto Wallet.',
      );
    }
  }

  useEffect(() => {
    if (!privy?.isReady) return;
    void startWalletOnboarding();
  }, [privy?.isReady]);

  useEffect(() => {
    if (!waitingForWallet || !wallet || linkingRef.current) return;
    setWaitingForWallet(false);
    void linkWallet(wallet);
  }, [waitingForWallet, wallet?.address]);

  function retry() {
    startedRef.current = false;
    linkingRef.current = false;
    setWaitingForWallet(false);
    setError('');
    void startWalletOnboarding();
  }

  if (error) {
    return (
      <Screen>
        <Brand />
        <View style={styles.topSpace} />
        <Badge tone="warning">PASSO 3 DE 4</Badge>
        <Title>Vamos concluir sua Cripto Wallet.</Title>
        <Paragraph>
          Sua conta Nexa está segura. Tente novamente para terminar a criação
          ou o vínculo da carteira.
        </Paragraph>
        <Card>
          <Text style={styles.error}>{error}</Text>
        </Card>
        <ActionButton label="Tentar novamente" onPress={retry} />
      </Screen>
    );
  }

  return (
    <View style={styles.loader}>
      <Brand />
      <Badge tone="info">PASSO 3 DE 4</Badge>
      <ActivityIndicator size="large" color={colors.primary} />
      <Title>Preparando sua Cripto Wallet.</Title>
      <Paragraph>
        A Nexa cuida da parte técnica nos bastidores. Você não precisa escolher
        rede, configurar bridge nem guardar uma nova senha da Nexa.
      </Paragraph>
      <Card>
        <Text style={styles.stage}>{stage}</Text>
        <Text style={styles.helper}>
          Normalmente isso leva apenas alguns instantes.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  topSpace: { height: spacing.md },
  stage: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  helper: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
