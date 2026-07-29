import { useState } from 'react';
import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Brand, Field, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi, tokensFromLogin } from '@/lib/api';
import { clearNexaSession, saveNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function profileFrom(response: any) {
  return response?.profile || response || {};
}

function isLegacyProfile(profile: any) {
  const value = String(profile?.settlementProfile || '').toLowerCase();
  return profile?.isLegacyBeta === true || value.includes('legacy');
}

export default function SignInScreen() {
  const privy = usePrivy() as any;
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function authenticateNexa() {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');
    if (!normalizedEmail || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      const response = await nexaApi.login(normalizedEmail, password);
      const tokens = tokensFromLogin(response);
      await saveNexaSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: normalizedEmail,
      });

      const profileResponse = await nexaApi.directProfile(tokens.accessToken);
      const profile = profileFrom(profileResponse);

      // Contas antigas continuam na experiência completa já conhecida, sem
      // autenticação Privy e sem migração de carteira, saldo ou operações.
      if (isLegacyProfile(profile)) {
        router.replace('/legacy' as any);
        return;
      }

      // Uma carteira já vinculada não precisa refazer o onboarding a cada login.
      if (profile?.wallet?.linked === true) {
        router.replace('/(app)');
        return;
      }

      // Privy só entra no fluxo de contas novas que ainda não possuem carteira.
      if (privy.user) {
        router.replace('/onboarding-wallet');
        return;
      }

      await sendCode({ email: normalizedEmail });
      setStep('otp');
    } catch (caught) {
      await clearNexaSession();
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function authenticatePrivy() {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');
    if (code.trim().length < 4) {
      setError('Informe o código enviado ao seu e-mail.');
      return;
    }

    setLoading(true);
    try {
      await loginWithCode({ email: normalizedEmail, code: code.trim() });
      router.replace('/onboarding-wallet');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'O código não pôde ser validado.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function restart() {
    setLoading(true);
    try {
      if (privy.user && privy.logout) await privy.logout();
      await clearNexaSession();
      setCode('');
      setPassword('');
      setStep('credentials');
      setError('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Title>{step === 'credentials' ? 'Entrar' : 'Confirmar e-mail'}</Title>
      <Paragraph>
        {step === 'credentials'
          ? 'Acesse sua conta Nexa.'
          : `Digite o código enviado para ${email.trim().toLowerCase()}.`}
      </Paragraph>

      {step === 'credentials' ? (
        <>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="voce@email.com"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="Sua senha"
          />
          <ActionButton label="Entrar" loading={loading} onPress={authenticateNexa} />
          <ActionButton
            label="Criar conta"
            variant="secondary"
            disabled={loading}
            onPress={() => router.push('/sign-up')}
          />
        </>
      ) : (
        <>
          <Field
            label="Código"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
          />
          <ActionButton label="Confirmar" loading={loading} onPress={authenticatePrivy} />
          <ActionButton
            label="Voltar"
            variant="secondary"
            disabled={loading}
            onPress={restart}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});