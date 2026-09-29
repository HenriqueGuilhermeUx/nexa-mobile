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
    if (!otpVerified || recovered) return;
    const timeout = setTimeout(() => {
      setError(
        'A autenticação Privy foi concluída, mas a carteira recuperada não corresponde à carteira já vinculada à Nexa. Nenhuma nova carteira foi criada.',
      );
    }, 10_000);
    return () => clearTimeout(timeout);
  }, [otpVerified, recovered]);

  async function sendRecoveryCode() {
    setError('');
    setWorking(true);
    try {
      if (!email) throw new Error('E-mail da conta Nexa indisponível.');

      // Se este aparelho estiver com outra sessão Privy, ela não pode ser usada
      // para assinar pela wallet já vinculada. Encerramos somente a sessão Privy
      // local e autenticamos explicitamente a identidade já existente.
      if (typeof privy?.logout === 'function' && !recovered) {
        await privy.logout().catch(() => undefined);
      }

      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('A recuperação Privy por e-mail não está disponível nesta versão.');
      }

      // disableSignup é essencial: recuperação nunca pode criar uma nova
      // identidade/wallet silenciosamente se o e-mail não corresponder ao usuário
      // Privy já existente.
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

      // O SDK Expo mantém o e-mail da etapa sendCode. O campo email adicional
      // mantém compatibilidade com versões anteriores sem alterar a identidade.
      await emailLogin.loginWithCode({ email, code: normalizedCode });
      setOtpVerified(true);
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

  if (loading || !privy?.isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Preparando recuperação segura...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Badge tone={recovered ? 'success' : 'warning'}>
        {recovered ? 'CARTEIRA DISPONÍVEL' : 'NOVO DISPOSITIVO'}
      </Badge>
      <View style={styles.topSpace} />
      <Title>Recupere a mesma carteira.</Title>
      <Paragraph>
        A Nexa não criará outro endereço. Vamos autenticar sua identidade Privy
        existente e só continuar se a carteira recuperada for exatamente a já
        vinculada à sua conta.
      </Paragraph>

      <Card>
        <Text style={styles.label}>Carteira vinculada</Text>
        <Text selectable style={styles.address}>{expectedWallet || '—'}</Text>
        <Text style={styles.muted}>
          Código de recuperação: {email ? maskedEmail(email) : '—'}
        </Text>
      </Card>

      {recovered ? (
        <Card>
          <Text style={styles.successTitle}>Acesso restaurado neste aparelho</Text>
          <Text style={styles.muted}>
            O endereço local corresponde exatamente à carteira Wallet-First já
            vinculada. Nenhuma nova carteira foi criada.
          </Text>
          <ActionButton
            label="Continuar na Nexa"
            onPress={() => router.replace('/(app)' as any)}
          />
        </Card>
      ) : (
        <>
          {!codeSent ? (
            <ActionButton
              label="Enviar código de recuperação"
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
                label="Validar e recuperar carteira"
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

      {otpVerified && !recovered && !error ? (
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
