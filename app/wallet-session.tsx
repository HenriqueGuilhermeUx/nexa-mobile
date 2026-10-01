import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function maskEmail(value: string) {
  const [name, domain] = String(value || '').split('@');
  if (!name || !domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 2))}@${domain}`;
}

export default function WalletSessionScreen() {
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = firstParam(params.returnTo) || '';
  const privy = usePrivy() as any;
  const emailLogin = useLoginWithEmail() as any;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  async function currentPrivyToken() {
    if (typeof privy?.getAccessToken !== 'function') return '';
    try {
      const token = String((await privy.getAccessToken()) || '').trim();
      return token.length > 40 && token.split('.').length === 3 ? token : '';
    } catch {
      return '';
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session?.email) {
          router.replace('/sign-in');
          return;
        }
        if (!active) return;
        setEmail(session.email.trim().toLowerCase());
        const token = await currentPrivyToken();
        if (active && token) setReady(true);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível preparar a confirmação da carteira.',
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [privy?.isReady]);

  async function sendCode() {
    setError('');
    setWorking(true);
    try {
      if (!email) throw new Error('O e-mail da conta Nexa não está disponível.');
      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('A confirmação Privy por e-mail não está disponível nesta versão.');
      }
      await emailLogin.sendCode({ email, disableSignup: true });
      setCode('');
      setCodeSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar o código de confirmação.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function waitForAccessToken(timeoutMs = 12_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown = null;
    while (Date.now() < deadline) {
      try {
        const token = await currentPrivyToken();
        if (token) return token;
      } catch (caught) {
        lastError = caught;
      }
      await sleep(400);
    }
    throw new Error(
      lastError instanceof Error
        ? `Sua identidade foi confirmada, mas a sessão da carteira ainda não ficou disponível: ${lastError.message}`
        : 'Sua identidade foi confirmada, mas a sessão da carteira ainda não ficou disponível. Tente novamente em alguns segundos.',
    );
  }

  async function validateCode() {
    const normalizedCode = code.replace(/\D/g, '').trim();
    setError('');
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
      await waitForAccessToken();
      setCodeSent(false);
      setReady(true);
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

  function continueFlow() {
    if (returnTo === 'rewards') {
      router.replace('/(app)/rewards' as any);
      return;
    }
    router.back();
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Badge tone={ready ? 'success' : 'warning'}>
        {ready ? 'CARTEIRA CONFIRMADA' : 'CONFIRMAR CARTEIRA'}
      </Badge>
      <Title>{ready ? 'Sua carteira está pronta.' : 'Confirme sua carteira.'}</Title>
      <Paragraph>
        {ready
          ? 'A sessão Privy foi restaurada neste aparelho. Nenhuma nova carteira foi criada.'
          : 'Use o mesmo e-mail da sua conta Nexa para restaurar a sessão Privy da carteira já vinculada. A Nexa não cria nem troca seu endereço neste fluxo.'}
      </Paragraph>

      <Card>
        <Text style={styles.label}>Conta Nexa</Text>
        <Text style={styles.muted}>{email ? maskEmail(email) : '—'}</Text>
      </Card>

      {!ready ? (
        !codeSent ? (
          <ActionButton
            label="Enviar código de confirmação"
            loading={working}
            onPress={sendCode}
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
              label="Validar carteira"
              loading={working}
              onPress={validateCode}
            />
            <ActionButton
              label="Enviar novo código"
              variant="secondary"
              disabled={working}
              onPress={sendCode}
            />
          </Card>
        )
      ) : (
        <ActionButton
          label={returnTo === 'rewards' ? 'Voltar ao Turbinar' : 'Continuar'}
          onPress={continueFlow}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  muted: { color: colors.text, marginTop: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
