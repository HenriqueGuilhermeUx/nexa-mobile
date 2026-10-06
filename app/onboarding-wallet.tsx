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
  const [stage, setStage] = useState('Preparando sua wallet…');
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
          : 'Não foi possível concluir sua wallet.',
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
        throw new Error('A criação da wallet não está disponível neste aparelho.');
      }

      setStage('Criando sua wallet…');
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
      setStage('Finalizando sua wallet…');
    } catch (caught) {
      startedRef.current = false;
      setWaitingForWallet(false);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível preparar sua wallet.',
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
        <Title>Vamos ativar sua wallet</Title>
        <Paragraph>
          Sua conta continua protegida. Tente novamente para concluir a ativação da sua wallet.
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
      <View style={styles.progressMark}>
        <Text style={styles.progressMarkText}>N</Text>
      </View>
      <Title>Ativando sua wallet</Title>
      <Paragraph>
        A Nexa cuida da parte técnica nos bastidores. Você não precisa escolher rede, configurar bridge ou entender gas para continuar.
      </Paragraph>
      <Card>
        <View style={styles.progressItem}>
          <Text style={styles.progressDone}>✓</Text>
          <Text style={styles.progressText}>Conta confirmada</Text>
        </View>
        <View style={styles.progressItem}>
          <ActivityIndicator size="small" color={colors.cyan} />
          <Text style={styles.progressText}>{stage}</Text>
        </View>
        <View style={styles.progressItem}>
          <Text style={styles.progressPending}>3</Text>
          <Text style={styles.progressMuted}>Finalizando vínculo da wallet</Text>
        </View>
        <Text style={styles.helper}>
          Você pode aguardar nesta tela; nenhuma movimentação financeira acontece nesta etapa.
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
  progressMark: {
    width: 70,
    height: 70,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  progressMarkText: { color: colors.cyan, fontSize: 32, fontWeight: '900' },
  progressItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressDone: { color: colors.success, fontSize: 16, fontWeight: '900' },
  progressPending: {
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: colors.panelSoft,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  progressText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  progressMuted: { color: colors.muted, fontSize: 13 },
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
