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
import { config } from '@/config';
import { useNexaPrivy } from '@/lib/privyBridge';
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
  const walletOnboarding = returnTo === 'onboarding-wallet';
  const globalProduct = config.globalProduct;
  const privy = useNexaPrivy();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  async function currentAuthorizationToken() {
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

        const token = await currentAuthorizationToken();
        if (!active || !token) return;
        setReady(true);

        if (walletOnboarding) {
          router.replace({
            pathname: '/onboarding-wallet' as any,
            params: { auto: '1' },
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : globalProduct
                ? 'We could not prepare wallet confirmation.'
                : 'Não foi possível preparar a confirmação da carteira.',
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [privy?.getAccessToken, walletOnboarding]);

  async function sendCode() {
    setError('');
    setWorking(true);
    try {
      if (!email) {
        throw new Error(
          globalProduct
            ? 'Your Nexa account email is not available.'
            : 'O e-mail da conta Nexa não está disponível.',
        );
      }
      await privy.sendEmailCode({
        email,
        // No primeiro onboarding a Privy pode ainda não conhecer o usuário.
        // Nos fluxos de recuperação, criação de uma nova identidade continua
        // bloqueada para nunca trocar a carteira silenciosamente.
        disableSignup: !walletOnboarding,
      });
      setCode('');
      setCodeSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : globalProduct
            ? 'We could not send the confirmation code.'
            : 'Não foi possível enviar o código de confirmação.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function waitForAccessToken(timeoutMs = 12_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const token = await currentAuthorizationToken();
      if (token) return token;
      await sleep(400);
    }
    throw new Error(
      globalProduct
        ? 'Your email was confirmed, but the wallet is still being prepared. Try again shortly.'
        : 'Seu e-mail foi confirmado, mas a carteira ainda está sendo preparada. Tente novamente em alguns segundos.',
    );
  }

  async function validateCode() {
    const normalizedCode = code.replace(/\D/g, '').trim();
    setError('');

    if (normalizedCode.length < 4) {
      setError(
        globalProduct
          ? 'Enter the code sent to your email.'
          : 'Informe o código recebido no seu e-mail.',
      );
      return;
    }

    setWorking(true);
    try {
      await privy.loginWithEmailCode({ email, code: normalizedCode });
      await waitForAccessToken();
      setCodeSent(false);
      setReady(true);

      if (walletOnboarding) {
        router.replace({
          pathname: '/onboarding-wallet' as any,
          params: { auto: '1' },
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : globalProduct
            ? 'Invalid or expired code. Request a new one.'
            : 'Código inválido ou expirado. Solicite um novo código.',
      );
    } finally {
      setWorking(false);
    }
  }

  function continueFlow() {
    if (walletOnboarding) {
      router.replace({
        pathname: '/onboarding-wallet' as any,
        params: { auto: '1' },
      });
      return;
    }
    if (returnTo === 'rewards') {
      router.replace('/(app)/rewards' as any);
      return;
    }
    if (returnTo === 'cash-out') {
      router.replace('/(app)/cash-out' as any);
      return;
    }
    if (returnTo === 'onboarding-wallet') {
      router.replace('/onboarding-wallet' as any);
      return;
    }
    router.back();
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Badge tone={ready ? 'success' : 'warning'}>
        {ready
          ? globalProduct ? 'EMAIL CONFIRMED' : 'E-MAIL CONFIRMADO'
          : globalProduct ? 'CONFIRM EMAIL' : 'CONFIRMAR E-MAIL'}
      </Badge>
      <Title>
        {ready
          ? globalProduct ? 'All set.' : 'Tudo certo.'
          : globalProduct ? 'Confirm your email.' : 'Confirme seu e-mail.'}
      </Title>
      <Paragraph>
        {ready
          ? globalProduct
            ? 'The authorization needed to prepare your wallet is ready on this device.'
            : 'A autorização necessária para preparar sua Cripto Wallet está pronta neste aparelho.'
          : walletOnboarding
            ? globalProduct
              ? 'We will send a code to the same email used for your Nexa account. This confirmation protects creation of your wallet.'
              : 'Enviaremos um código para o mesmo e-mail da sua conta Nexa. Essa confirmação protege a criação da sua Cripto Wallet.'
            : globalProduct
              ? 'Use the same email as your Nexa account to restore wallet authorization.'
              : 'Use o mesmo e-mail da sua conta Nexa para restaurar a autorização da carteira já vinculada.'}
      </Paragraph>

      <Card>
        <Text style={styles.label}>{globalProduct ? 'Nexa account' : 'Conta Nexa'}</Text>
        <Text style={styles.muted}>{email ? maskEmail(email) : '—'}</Text>
      </Card>

      {!ready ? (
        !codeSent ? (
          <ActionButton
            label={globalProduct ? 'Send code' : 'Enviar código'}
            loading={working}
            onPress={sendCode}
          />
        ) : (
          <Card>
            <Field
              label={globalProduct ? 'Code sent by email' : 'Código recebido por e-mail'}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder={globalProduct ? 'Enter the code' : 'Digite o código'}
            />
            <ActionButton
              label={globalProduct ? 'Confirm and continue' : 'Confirmar e continuar'}
              loading={working}
              onPress={validateCode}
            />
            <ActionButton
              label={globalProduct ? 'Send new code' : 'Enviar novo código'}
              variant="secondary"
              disabled={working}
              onPress={sendCode}
            />
          </Card>
        )
      ) : (
        <ActionButton label={globalProduct ? 'Continue' : 'Continuar'} onPress={continueFlow} />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!walletOnboarding ? (
        <ActionButton
          label={globalProduct ? 'Back' : 'Voltar'}
          variant="secondary"
          onPress={() => router.back()}
        />
      ) : null}
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
