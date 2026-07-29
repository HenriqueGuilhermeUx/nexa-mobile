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

  function validateForm() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCpf = digits(cpf);

    if (fullName.trim().length < 3) return 'Informe seu nome completo.';
    if (!normalizedEmail.includes('@')) return 'Informe um e-mail válido.';
    if (normalizedCpf.length !== 11) return 'Informe um CPF com 11 números.';
    if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
    return '';
  }

  async function requestEmailCode() {
    const validationError = validateForm();
    setError(validationError);
    if (validationError) return;

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      if (privy.user && privy.logout) await privy.logout();
      await clearNexaSession();
      await sendCode({ email: normalizedEmail });
      setStep('otp');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar o código de confirmação.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmEmailAndCreateAccount() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCpf = digits(cpf);
    const normalizedPhone = digits(phone);

    setError('');
    if (code.trim().length < 4) {
      setError('Informe o código enviado ao seu e-mail.');
      return;
    }

    setLoading(true);
    try {
      // O cadastro financeiro só é criado depois que o e-mail foi validado na
      // Privy. Assim uma falha de OTP não deixa um usuário incompleto no banco.
      await loginWithCode({ email: normalizedEmail, code: code.trim() });

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

      router.replace('/onboarding-wallet');
    } catch (caught) {
      await clearNexaSession();
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir seu cadastro.',
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
          <ActionButton
            label="Continuar"
            loading={loading}
            onPress={requestEmailCode}
          />
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
          <ActionButton
            label="Criar conta"
            loading={loading}
            onPress={confirmEmailAndCreateAccount}
          />
          <ActionButton
            label="Voltar"
            variant="secondary"
            disabled={loading}
            onPress={() => {
              setCode('');
              setError('');
              setStep('form');
            }}
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