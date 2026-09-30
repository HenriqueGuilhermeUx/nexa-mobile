import { useEffect, useMemo, useState } from 'react';
import {
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Card,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function expectedWalletFrom(profileResponse: any, meResponse: any) {
  const profile = profileResponse?.profile || profileResponse || {};
  const me = meResponse?.user || meResponse || {};
  return String(
    profile?.destinationWallet ||
      profile?.wallet?.address ||
      profile?.walletAddress ||
      me?.walletAddress ||
      '',
  ).trim();
}

function maskedEmail(value: string) {
  const [name, domain] = String(value || '').split('@');
  if (!name || !domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 2))}@${domain}`;
}

export default function WalletRecoveryScreen() {
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
    asset?: string | string[];
    amount?: string | string[];
  }>();
  const returnToPurchase = firstParam(params.returnTo) === 'buy-crypto';
  const returnAsset = firstParam(params.asset) === 'ETH' ? 'ETH' : 'BTC';
  const returnAmount = firstParam(params.amount) || '';

  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const emailLogin = useLoginWithEmail() as any;
  const wallets = (embedded.wallets || []) as any[];

  const [email, setEmail] = useState('');
  const [expectedWallet, setExpectedWallet] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const localAddresses = useMemo(
    () => wallets.map((wallet) => normalizeAddress(wallet?.address)).filter(Boolean),
    [wallets],
  );
  const recovered = Boolean(
    expectedWallet && localAddresses.includes(normalizeAddress(expectedWallet)),
  );

  useEffect(() => {
    let active = true;
    void (async () => {
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
        if (!active) return;
        const address = expectedWalletFrom(profileResponse, meResponse);
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new Error('A Nexa não encontrou a carteira Wallet-First vinculada à sua conta.');
        }
        setEmail(session.email.trim().toLowerCase());
        setExpectedWallet(address);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível preparar a recuperação da carteira.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (returnToPurchase || !otpVerified || recovered) return;
    const timeout = setTimeout(() => {
      setError(
        'A autenticação Privy foi concluída, mas a carteira recuperada não corresponde à carteira já vinculada à Nexa. Nenhuma nova carteira foi criada.',
      );
    }, 10_000);
    return () => clearTimeout(timeout);
  }, [otpVerified, recovered, returnToPurchase]);

  async function sendRecoveryCode() {
    setError('');
    setWorking(true);
    try {
      if (!email) throw new Error('E-mail da conta Nexa indisponível.');

      // Para a autorização da compra patrocinada, precisamos renovar a identidade
      // Privy do usuário. Se houver uma sessão local diferente, encerramos somente
      // essa sessão Privy antes de autenticar o e-mail já vinculado à conta Nexa.
      if (typeof privy?.logout === 'function' && !recovered) {
        await privy.logout().catch(() => undefined);
      }

      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('A recuperação Privy por e-mail não está disponível nesta versão.');
      }

      await emailLogin.sendCode({ email, disableSignup: true });
      setCodeSent(true);
      setCode('');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar o código de recuperação.',
      );
    } finally {
      setWorking(false);
    }
  }

  function returnToPurchaseScreen() {
    router.replace({
      pathname: '/(app)/buy-crypto',
      params: {
        asset: returnAsset,
        amount: returnAmount,
        identityRecovered: '1',
      },
    } as any);
  }

  async function verifyRecoveryCode() {
    setError('');
    const normalizedCode = code.replace(/\D/g, '').trim();
    if (normalizedCode.length < 4) {
      setError('Informe o código recebido no seu e-mail.');
      return;
    }

    setWorking(true);
    try {
      if (typeof emailLogin?.loginWithCode !== 'function') {
        throw new Error('A validação Privy por código não está disponível nesta versão.');
      }

      await emailLogin.loginWithCode({ email, code: normalizedCode });
      setOtpVerified(true);

      // Para compra patrocinada, o que autoriza a operação é a identidade Privy
      // (identity JWT) verificada server-side contra a wallet vinculada no intent.
      // Não aguardamos a embedded wallet local reaparecer no aparelho.
      if (returnToPurchase) {
        returnToPurchaseScreen();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Código inválido ou expirado. Solicite um novo código.',
      );
    } finally {
      setWorking(false);
    }
  }

  function continueInNexa() {
    if (returnToPurchase) {
      returnToPurchaseScreen();
      return;
    }
    router.replace('/(app)' as any);
  }

  if (loading || !privy?.isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Preparando autorização segura...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Badge tone={returnToPurchase || recovered ? 'success' : 'warning'}>
        {returnToPurchase ? 'AUTORIZAÇÃO DA COMPRA' : recovered ? 'CARTEIRA DISPONÍVEL' : 'NOVO DISPOSITIVO'}
      </Badge>
      <View style={styles.topSpace} />
      <Title>{returnToPurchase ? 'Confirme sua identidade.' : 'Recupere a mesma carteira.'}</Title>
      <Paragraph>
        {returnToPurchase
          ? 'Vamos confirmar sua identidade Privy. A wallet vinculada à compra será validada novamente pela Nexa e pela Privy antes da execução.'
          : 'A Nexa não criará outro endereço. Vamos autenticar sua identidade Privy existente e só continuar se a carteira recuperada for exatamente a já vinculada à sua conta.'}
      </Paragraph>

      <Card>
        <Text style={styles.label}>Carteira vinculada</Text>
        <Text selectable style={styles.address}>{expectedWallet || '—'}</Text>
        <Text style={styles.muted}>
          Código de confirmação: {email ? maskedEmail(email) : '—'}
        </Text>
      </Card>

      {!returnToPurchase && recovered ? (
        <Card>
          <Text style={styles.successTitle}>Acesso restaurado neste aparelho</Text>
          <Text style={styles.muted}>
            O endereço local corresponde exatamente à carteira Wallet-First já
            vinculada. Nenhuma nova carteira foi criada.
          </Text>
          <ActionButton label="Continuar na Nexa" onPress={continueInNexa} />
        </Card>
      ) : (
        <>
          {!codeSent ? (
            <ActionButton
              label="Enviar código de confirmação"
              loading={working}
              onPress={sendRecoveryCode}
            />
          ) : (
            <Card>
              <Field
                label="Código recebido por e-mail"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="Digite o código"
              />
              <ActionButton
                label={returnToPurchase ? 'Validar e voltar para a compra' : 'Validar e recuperar carteira'}
                loading={working}
                onPress={verifyRecoveryCode}
              />
              <ActionButton
                label="Enviar novo código"
                variant="secondary"
                disabled={working}
                onPress={sendRecoveryCode}
              />
            </Card>
          )}
        </>
      )}

      {!returnToPurchase && otpVerified && !recovered && !error ? (
        <Card>
          <Text style={styles.muted}>
            Identidade Privy confirmada. Recuperando a carteira neste aparelho...
          </Text>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
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
  topSpace: { height: spacing.lg },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  address: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  muted: { color: colors.muted, lineHeight: 21 },
  successTitle: {
    color: colors.success,
    fontWeight: '900',
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
