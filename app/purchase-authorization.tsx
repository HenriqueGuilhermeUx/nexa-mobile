import { useEffect, useState } from 'react';
import {
  useIdentityToken,
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
import { stashPurchaseIdentityToken } from '@/lib/privyPurchaseAuthorization';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function looksLikeJwt(value: unknown) {
  const token = String(value || '').trim();
  return token.length > 40 && token.split('.').length === 3;
}

function maskedEmail(value: string) {
  const [name, domain] = String(value || '').split('@');
  if (!name || !domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 2))}@${domain}`;
}

export default function PurchaseAuthorizationScreen() {
  const privy = usePrivy() as any;
  const identity = useIdentityToken() as any;
  const emailLogin = useLoginWithEmail() as any;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Verificando sua sessão Privy...');

  async function readIdentityToken() {
    const direct = String(identity?.identityToken || '').trim();
    if (looksLikeJwt(direct)) return direct;

    if (typeof identity?.getIdentityToken === 'function') {
      try {
        const token = String((await identity.getIdentityToken()) || '').trim();
        if (looksLikeJwt(token)) return token;
      } catch {
        // Continue with the refresh path below.
      }
    }
    return '';
  }

  async function refreshAndReadIdentityToken(timeoutMs = 12_000) {
    let token = await readIdentityToken();
    if (token) return token;

    // Privy documents that refreshing the authenticated session can also refresh
    // the identity token. This is safe to call only when a user session exists.
    if (privy?.user && typeof privy?.getAccessToken === 'function') {
      try {
        await privy.getAccessToken();
      } catch {
        // The retry loop below remains the source of truth.
      }
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      token = await readIdentityToken();
      if (token) return token;
      await sleep(500);
    }
    return '';
  }

  function finishAuthorization(token: string) {
    stashPurchaseIdentityToken(token);
    router.back();
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        if (!active) return;
        setEmail(session.email.trim().toLowerCase());

        if (!privy?.isReady) return;

        // Most purchases should end here: the customer is already logged in to
        // Privy, so reuse that session instead of trying to log in a second time.
        if (privy?.user) {
          const token = await refreshAndReadIdentityToken(5_000);
          if (!active) return;
          if (token) {
            setStatus('Identidade confirmada. Voltando para sua compra...');
            finishAuthorization(token);
            return;
          }
          setStatus('Sua sessão Privy precisa ser renovada para autorizar a compra.');
        } else {
          setStatus('Confirme seu e-mail para autorizar a compra.');
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível preparar a autorização.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [privy?.isReady, privy?.user?.id]);

  async function beginOtpAuthorization() {
    setError('');
    setWorking(true);
    try {
      if (!email) throw new Error('E-mail da conta Nexa indisponível.');

      // loginWithCode is a login operation. Privy correctly rejects it when a
      // user is already logged in. If the current session could not issue an
      // identity token, end only the Privy session before starting a fresh OTP.
      if (privy?.user && typeof privy?.logout === 'function') {
        await privy.logout();
        await sleep(300);
      }

      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('Autorização por e-mail indisponível nesta instalação.');
      }
      await emailLogin.sendCode({ email, disableSignup: true });
      setCode('');
      setCodeSent(true);
      setStatus('Digite o código enviado para confirmar a autorização.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o código.');
    } finally {
      setWorking(false);
    }
  }

  async function validateOtpAuthorization() {
    const normalizedCode = code.replace(/\D/g, '').trim();
    setError('');
    if (normalizedCode.length < 4) {
      setError('Informe o código recebido no e-mail.');
      return;
    }

    setWorking(true);
    try {
      // Defensive path: never call loginWithCode over an existing authenticated
      // session, which is what produced the "Already logged in" loop in v124.
      if (privy?.user) {
        const existingToken = await refreshAndReadIdentityToken(3_000);
        if (existingToken) {
          finishAuthorization(existingToken);
          return;
        }
        if (typeof privy?.logout === 'function') {
          await privy.logout();
          await sleep(300);
        }
      }

      if (typeof emailLogin?.loginWithCode !== 'function') {
        throw new Error('Validação Privy por código indisponível nesta instalação.');
      }

      await emailLogin.loginWithCode({ email, code: normalizedCode });
      setStatus('Código confirmado. Obtendo autorização da Privy...');

      const token = await refreshAndReadIdentityToken(20_000);
      if (!token) {
        throw new Error(
          'A Privy confirmou o login, mas não forneceu o Identity Token. Verifique no Privy Dashboard se “Return user data in an identity token” está ativado.',
        );
      }

      finishAuthorization(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível validar a autorização.');
    } finally {
      setWorking(false);
    }
  }

  if (loading || !privy?.isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Preparando autorização da compra...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Badge tone="success">AUTORIZAÇÃO DA COMPRA</Badge>
      <View style={styles.topSpace} />
      <Title>Confirme sua identidade.</Title>
      <Paragraph>
        A Nexa usa sua sessão Privy para autorizar esta compra. Não criamos nem trocamos sua carteira neste processo.
      </Paragraph>

      <Card>
        <Text style={styles.label}>Conta Nexa</Text>
        <Text style={styles.muted}>{email ? maskedEmail(email) : '—'}</Text>
        <Text style={styles.status}>{status}</Text>
      </Card>

      {!codeSent ? (
        <ActionButton
          label={privy?.user ? 'Renovar autorização Privy' : 'Enviar código de autorização'}
          loading={working}
          onPress={beginOtpAuthorization}
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
            label="Validar e voltar para a compra"
            loading={working}
            onPress={validateOtpAuthorization}
          />
          <ActionButton
            label="Enviar novo código"
            variant="secondary"
            disabled={working}
            onPress={beginOtpAuthorization}
          />
        </Card>
      )}

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
  muted: { color: colors.muted, lineHeight: 21 },
  status: { color: colors.text, lineHeight: 21, marginTop: spacing.md, fontWeight: '700' },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
