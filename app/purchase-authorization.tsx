import { useEffect, useState } from 'react';
import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
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
  const emailLogin = useLoginWithEmail() as any;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Verificando sua sessão Privy...');

  async function readAccessToken() {
    if (!privy?.user || typeof privy?.getAccessToken !== 'function') return '';
    try {
      const token = String((await privy.getAccessToken()) || '').trim();
      return looksLikeJwt(token) ? token : '';
    } catch {
      return '';
    }
  }

  async function waitForAccessToken(timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const token = await readAccessToken();
      if (token) return token;
      await sleep(500);
    }
    return '';
  }

  function finishAuthorization(token: string) {
    // The server wallet authorization context expects the authenticated Privy
    // app access token (JWT), not the Identity Token used for profile data.
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

        // Normal path: reuse the current authenticated Privy session. No OTP,
        // no wallet recovery and no second login are necessary.
        if (privy?.user) {
          const token = await waitForAccessToken(5_000);
          if (!active) return;
          if (token) {
            setStatus('Sessão Privy confirmada. Voltando para sua compra...');
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

      // Try the valid logged-in session once more before starting a fresh login.
      if (privy?.user) {
        const currentToken = await readAccessToken();
        if (currentToken) {
          finishAuthorization(currentToken);
          return;
        }
        if (typeof privy?.logout === 'function') {
          await privy.logout();
          await sleep(300);
        }
      }

      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('Autorização por e-mail indisponível nesta instalação.');
      }
      await emailLogin.sendCode({ email, disableSignup: true });
      setCode('');
      setCodeSent(true);
      setStatus('Digite o código enviado para confirmar sua sessão Privy.');
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
      // Never call loginWithCode over an authenticated session. First reuse its
      // access token; only logout if the session cannot issue one.
      if (privy?.user) {
        const existingToken = await readAccessToken();
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
      setStatus('Código confirmado. Obtendo autorização da sua sessão Privy...');

      const token = await waitForAccessToken(20_000);
      if (!token) {
        throw new Error('A Privy confirmou o login, mas não liberou um access token válido.');
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
      <Title>Confirmação segura.</Title>
      <Paragraph>
        A Nexa usa a sessão autenticada da Privy para autorizar esta compra. Não criamos nem trocamos sua carteira neste processo.
      </Paragraph>

      <Card>
        <Text style={styles.label}>Conta Nexa</Text>
        <Text style={styles.muted}>{email ? maskedEmail(email) : '—'}</Text>
        <Text style={styles.status}>{status}</Text>
      </Card>

      {!codeSent ? (
        <ActionButton
          label={privy?.user ? 'Continuar com sessão Privy' : 'Enviar código de autorização'}
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
