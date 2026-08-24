import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Brand,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi, tokensFromLogin } from '@/lib/api';
import { clearNexaSession, saveNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function digits(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validateForm() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCpf = digits(cpf);

    if (fullName.trim().length < 3) return 'Informe seu nome completo.';
    if (!normalizedEmail.includes('@')) return 'Informe um e-mail válido.';
    if (normalizedCpf.length !== 11) return 'Informe um CPF com 11 números.';
    if (password.length < 6) {
      return 'A senha precisa ter pelo menos 6 caracteres.';
    }
    return '';
  }

  async function createAccount() {
    const validationError = validateForm();
    setError(validationError);
    if (validationError) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCpf = digits(cpf);
    const normalizedPhone = digits(phone);

    setLoading(true);
    try {
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

      // Todo novo cliente passa imediatamente pelo KYC. O fluxo Brasil usa
      // CPF + selfie com prova de vida e só pede documento quando necessário.
      router.replace('/kyc' as any);
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
      <Title>Criar conta</Title>
      <Paragraph>
        Cadastre-se e confirme sua identidade. Na maioria dos casos, a
        verificação no Brasil precisa apenas do CPF e de uma selfie com prova de
        vida.
      </Paragraph>

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
        label="Criar conta"
        loading={loading}
        onPress={createAccount}
      />
      <ActionButton
        label="Já tenho conta"
        variant="secondary"
        disabled={loading}
        onPress={() => router.replace('/sign-in')}
      />

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
