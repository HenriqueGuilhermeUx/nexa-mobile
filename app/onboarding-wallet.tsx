import { useEffect, useMemo, useState } from 'react';
import {
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Brand,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function valueFromProfile(response: any) {
  return response?.profile || response || {};
}

function isPremiumActive(user: any) {
  const status = String(
    user?.premiumStatus ||
      user?.subscriptionStatus ||
      user?.plan ||
      user?.premium?.status ||
      '',
  ).toLowerCase();

  const enabled =
    user?.isPremium === true ||
    user?.premiumActive === true ||
    user?.premium?.isPremium === true ||
    user?.premium?.active === true ||
    status === 'premium' ||
    status === 'active' ||
    status === 'ativo';

  if (!enabled) return false;

  const premiumUntil = user?.premiumUntil || user?.premium?.premiumUntil;
  if (!premiumUntil) return true;
  return new Date(premiumUntil).getTime() > Date.now();
}

export default function WalletOnboardingScreen() {
  const privy = usePrivy() as any;
  const { sendCode, loginWithCode } = useLoginWithEmail() as any;
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
  const [eligible, setEligible] = useState(false);
  const [nexaEmail, setNexaEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
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

        const [meResponse, profileResponse] = await Promise.all([
          nexaApi.me(session.accessToken),
          nexaApi.directProfile(session.accessToken),
        ]);
        if (!mounted) return;

        const me = meResponse?.user || meResponse || {};
        const profile = valueFromProfile(profileResponse);
        const email = String(me?.email || session.email || '')
          .trim()
          .toLowerCase();

        setNexaEmail(email);

        const profileWalletProvider = String(
          profile?.wallet?.provider || '',
        ).toLowerCase();
        const meWalletProvider = String(
          me?.wallet?.provider || me?.walletProvider || '',
        ).toLowerCase();

        const existingPrivyAddress =
          profileWalletProvider === 'privy'
            ? profile?.wallet?.address
            : meWalletProvider === 'privy'
              ? me?.wallet?.address || me?.walletAddress
              : null;

        if (
          existingPrivyAddress &&
          /^0x[a-fA-F0-9]{40}$/.test(String(existingPrivyAddress))
        ) {
          router.replace('/premium-wallet' as any);
          return;
        }

        if (!isPremiumActive(me)) {
          setEligible(false);
          setError(
            'A carteira individual é um recurso Nexa Premium. Seu Saldo Nexa e as transferências por @username continuam disponíveis normalmente.',
          );
          return;
        }

        if (String(me?.kycStatus || '').toLowerCase() !== 'approved') {
          setEligible(false);
          setError(
            'Conclua a verificação de identidade antes de criar sua carteira individual.',
          );
          return;
        }

        setEligible(true);
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

  async function requestPrivyCode() {
    if (!eligible || !nexaEmail) return;
    setWorking(true);
    setError('');

    try {
      await sendCode({ email: nexaEmail });
      setCodeSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar o código de verificação.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function authenticatePrivy() {
    if (!code.trim() || !nexaEmail) {
      setError('Digite o código enviado ao seu e-mail Nexa.');
      return;
    }

    setWorking(true);
    setError('');

    try {
      await loginWithCode({
        code: code.trim(),
        email: nexaEmail,
      });
      setCode('');
      setCodeSent(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Código inválido ou expirado.',
      );
    } finally {
      setWorking(false);
    }
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
      if (!eligible) {
        throw new Error(
          'Carteira individual disponível para clientes Nexa Premium.',
        );
      }
      if (!currentWallet?.address) {
        throw new Error('A carteira ainda não ficou pronta. Tente novamente.');
      }

      const getAccessToken = privy.getAccessToken;
      if (typeof getAccessToken !== 'function') {
        throw new Error(
          'Confirme novamente seu e-mail para continuar com a carteira.',
        );
      }

      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) {
        throw new Error(
          'Confirme novamente seu e-mail para continuar com a carteira.',
        );
      }

      const privyWalletId = String(
        currentWallet.id ||
          currentWallet.walletId ||
          currentWallet.address,
      );

      await nexaApi.linkWallet(
        session.accessToken,
        privyAccessToken,
        {
          privyWalletId,
          walletAddress: currentWallet.address,
        },
      );

      void nexaApi.auditWallet(session.accessToken).catch(
        () => undefined,
      );
      router.replace('/premium-wallet' as any);
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

    if (!eligible) {
      router.replace('/legacy' as any);
      return;
    }

    if (!privy.user) {
      await requestPrivyCode();
      return;
    }

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
    if (!linkWhenReady || !wallet || working || !eligible) return;
    setLinkWhenReady(false);
    void linkWallet(wallet);
  }, [linkWhenReady, wallet?.address, working, eligible]);

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
          <Title>Carteira individual Premium</Title>
          <Paragraph>
            Crie sua carteira Privy vinculada à Nexa para receber e
            movimentar USDC on-chain pela rede Polygon.
          </Paragraph>
        </View>

        {eligible && !privy.user && !codeSent ? (
          <>
            <Text style={styles.email}>
              Confirmação: {nexaEmail || 'seu e-mail Nexa'}
            </Text>
            <ActionButton
              label="Enviar código de confirmação"
              loading={working}
              onPress={requestPrivyCode}
            />
          </>
        ) : null}

        {eligible && !privy.user && codeSent ? (
          <>
            <Field
              label="Código recebido"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="000000"
            />
            <ActionButton
              label="Confirmar e continuar"
              loading={working}
              onPress={authenticatePrivy}
            />
            <ActionButton
              label="Enviar novo código"
              variant="secondary"
              disabled={working}
              onPress={requestPrivyCode}
            />
          </>
        ) : null}

        {eligible && privy.user ? (
          <ActionButton
            label={
              wallet
                ? 'Vincular minha carteira'
                : 'Criar carteira individual'
            }
            loading={working || linkWhenReady}
            onPress={prepareWallet}
          />
        ) : null}

        {!eligible ? (
          <ActionButton
            label="Voltar para a Nexa"
            variant="secondary"
            onPress={() => router.replace('/legacy' as any)}
          />
        ) : null}

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
  email: {
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
