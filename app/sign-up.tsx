import { useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
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
  const privy = usePrivy() as any;
  const params = useLocalSearchParams<{ countryCode?: string }>();
  const countryCode = String(params.countryCode || 'BR').trim().toUpperCase();
  const isBrazil = countryCode === 'BR';

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
    if (isBrazil && normalizedCpf.length !== 11) {
      return 'Informe um CPF com 11 números.';
    }
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
      // A shared phone may retain a Privy session for another Nexa account.
      // Never silently link that other user's wallet to this new registration.
      // Sign out only the previous Privy session, never delete its wallet.
      const previousPrivyToken = typeof privy?.getAccessToken === 'function'
        ? await privy.getAccessToken()
        : null;
      if (previousPrivyToken) {
        if (typeof privy?.logout !== 'function') {
          throw new Error('Não foi possível trocar a sessão da carteira. Feche e reabra o aplicativo antes de criar uma conta.');
        }
        await privy.logout();
      }
      await clearNexaSession();
      const response = await nexaApi.register({
        fullName: fullName.trim(),
        email: normalizedEmail,
        cpf: isBrazil ? normalizedCpf : undefined,
        countryCode,
        phone: normalizedPhone || undefined,
        password,
      });
      const tokens = tokensFromLogin(response);
      await saveNexaSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: normalizedEmail,
      });

      // Every NEW account activates/reuses its own Privy wallet first.
      // Wallet onboarding verifies the Privy email code and the persisted
      // link before sending the user to Didit KYC. No financial permission
      // is granted by creating or linking the wallet.
      router.replace('/onboarding-wallet' as any);
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
      <Badge tone="info">CADASTRO · ETAPA 1</Badge>
      <View style={styles.badgeGap} />
      <Title>Crie sua Nexa</Title>
      <Paragraph>
        {isBrazil
          ? 'Cadastre-se uma vez. Depois, confirme seu e-mail por código para ativar sua carteira; a verificação de identidade vem em seguida.'
          : 'Cadastre-se uma vez, confirme seu e-mail por código para ativar sua carteira e depois valide sua identidade conforme seu país.'}
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
      {isBrazil ? (
        <Field
          label="CPF"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="number-pad"
          maxLength={14}
          placeholder="00000000000"
        />
      ) : null}
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
        label="Criar conta e ativar carteira"
        loading={loading}
        onPress={createAccount}
      />
      <Text style={styles.country}>País de residência: {countryCode}</Text>
      <ActionButton
        label="Trocar país"
        variant="secondary"
        disabled={loading}
        onPress={() => router.replace('/sign-up-country' as any)}
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
  badgeGap: { height: spacing.md },
  country: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: spacing.md },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
