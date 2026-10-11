import { useState } from 'react';
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
import { config } from '@/config';
import { nexaApi, tokensFromLogin } from '@/lib/api';
import { globalJurisdiction } from '@/lib/globalProduct';
import { clearNexaSession, saveNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function digits(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ countryCode?: string }>();
  const countryCode = String(params.countryCode || 'BR').trim().toUpperCase();
  const isBrazil = countryCode === 'BR';
  const globalProduct = config.globalProduct;
  const country = globalJurisdiction(countryCode);
  const countryLabel = country?.label || countryCode;

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

    if (fullName.trim().length < 3) {
      return globalProduct ? 'Enter your full name.' : 'Informe seu nome completo.';
    }
    if (!normalizedEmail.includes('@')) {
      return globalProduct ? 'Enter a valid email address.' : 'Informe um e-mail válido.';
    }
    if (isBrazil && normalizedCpf.length !== 11) {
      return 'Informe um CPF com 11 números.';
    }
    if (password.length < 6) {
      return globalProduct
        ? 'Your password must have at least 6 characters.'
        : 'A senha precisa ter pelo menos 6 caracteres.';
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

      // Todo novo cliente passa imediatamente pelo KYC. O backend define o
      // fluxo por país e o app nunca presume CPF/Pix fora do Brasil.
      router.replace('/kyc' as any);
    } catch (caught) {
      await clearNexaSession();
      setError(
        caught instanceof Error
          ? caught.message
          : globalProduct
            ? 'We could not complete your registration.'
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
      <Badge tone="info">
        {globalProduct ? 'SIGN UP · STEP 1' : 'CADASTRO · ETAPA 1'}
      </Badge>
      <View style={styles.badgeGap} />
      <Title>{globalProduct ? 'Create your Nexa' : 'Crie sua Nexa'}</Title>
      <Paragraph>
        {globalProduct
          ? 'Your wallet starts here. Create your account and verify your identity with the documents supported in your country of residence.'
          : isBrazil
            ? 'Sua wallet começa aqui. Cadastre-se e confirme sua identidade para liberar sua experiência Nexa.'
            : 'Sua wallet começa aqui. Cadastre-se e confirme sua identidade com os documentos aceitos no seu país de residência.'}
      </Paragraph>

      <Field
        label={globalProduct ? 'Full name' : 'Nome completo'}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        placeholder={globalProduct ? 'Your name' : 'Seu nome'}
      />
      <Field
        label={globalProduct ? 'Email' : 'E-mail'}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        placeholder={globalProduct ? 'you@example.com' : 'voce@email.com'}
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
        label={globalProduct ? 'Phone' : 'Telefone'}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder={globalProduct ? '+1 555 555 0100' : '11999999999'}
      />
      <Field
        label={globalProduct ? 'Password' : 'Senha'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholder={globalProduct ? 'At least 6 characters' : 'Mínimo de 6 caracteres'}
      />
      <ActionButton
        label={globalProduct ? 'Continue' : 'Continuar'}
        loading={loading}
        onPress={createAccount}
      />
      <Text style={styles.country}>
        {globalProduct ? 'Country of residence' : 'País de residência'}: {countryLabel}
      </Text>
      <ActionButton
        label={globalProduct ? 'Change country' : 'Trocar país'}
        variant="secondary"
        disabled={loading}
        onPress={() => router.replace('/sign-up-country' as any)}
      />
      <ActionButton
        label={globalProduct ? 'I already have an account' : 'Já tenho conta'}
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
