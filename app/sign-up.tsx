import { useState } from 'react';
import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Brand, Field, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi, tokensFromLogin } from '@/lib/api';
import { clearNexaSession, saveNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function digits(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export default function SignUpScreen() {
  const privy = usePrivy() as any;
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createAccount() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCpf = digits(cpf);
    const normalizedPhone = digits(phone);

    setError('');
    if (fullName.trim().length < 3) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!normalizedEmail.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (normalizedCpf.length !== 11) {
      setError('Informe um CPF com 11 números.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (privy.user && privy.logout) await privy.logout();
      await clearNexaSession();

      const response = await nexaApi.register({
        fullName: fullName.trim(),
        email: normalizedEmail,
        cpf: normalizedCpf,
        phone: normalizedPhone || undefined,
        password,
      });
      const tokens = tokensFromLogin(response);
      await saveNexaSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: normalizedEmail,
      });

      await sendCode({ email: normalizedEmail });
      setStep('otp');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível criar sua conta.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmEmail() {
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

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Title>{step === 'form' ? 'Criar conta' : 'Confirmar e-mail'}</Title>
      <Paragraph>
        {step === 'form'
          ? 'Preencha seus dados para começar.'
          : `Digite o código enviado para ${email.trim().toLowerCase()}.`}
      </Paragraph>

      {step === 'form' ? (
        <>
          <Field
            label="Nome completo"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholder="Seu nome"
          />
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="voce@email.com"
          />
          <Field
            label="CPF"
            value={cpf}
            onChangeText={setCpf}
            keyboardType="number-pad"
            maxLength={14}
            placeholder="00000000000"
          />
          <Field
            label="Telefone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="11999999999"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres"
          />
          <ActionButton label="Criar conta" loading={loading} onPress={createAccount} />
          <ActionButton
            label="Já tenho conta"
            variant="secondary"
            disabled={loading}
            onPress={() => router.replace('/sign-in')}
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
          <ActionButton label="Confirmar" loading={loading} onPress={confirmEmail} />
          <ActionButton
            label="Entrar depois"
            variant="secondary"
            disabled={loading}
            onPress={() => router.replace('/sign-in')}
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