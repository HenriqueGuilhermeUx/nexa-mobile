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

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      // O saldo e todas as operações oficiais usam o ledger Nexa. A carteira
      // Privy permanece opcional e nunca participa do login.
      router.replace('/legacy' as any);
    } catch (caught) {
      await clearNexaSession();
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Title>Entrar</Title>
      <Paragraph>Acesse sua conta Nexa.</Paragraph>

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
      <ActionButton
        label="Entrar"
        loading={loading}
        onPress={authenticateNexa}
      />
      <ActionButton
        label="Criar conta"
        variant="secondary"
        disabled={loading}
        onPress={() => router.push('/sign-up')}
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
