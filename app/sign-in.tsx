import { useState } from 'react';
import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi, tokensFromLogin } from '@/lib/api';
import { clearNexaSession, saveNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

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
      setError('Informe e-mail e senha da Nexa.');
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
          : 'O código não pôde ser validado pela Privy.',
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
      <Badge tone="info">CONVITE NEXA</Badge>
      <View style={styles.topSpace} />
      <Eyebrow>Uma conta, duas verificações</Eyebrow>
      <Title>{step === 'credentials' ? 'Entre na sua conta.' : 'Confirme seu e-mail.'}</Title>
      <Paragraph>
        {step === 'credentials'
          ? 'Primeiro validamos sua conta Nexa. Depois, a Privy confirma o mesmo e-mail para proteger a carteira individual.'
          : `Enviamos um código para ${email.trim().toLowerCase()}. O mesmo e-mail precisa existir na Nexa e na Privy.`}
      </Paragraph>

      {step === 'credentials' ? (
        <>
          <Field
            label="E-mail Nexa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="voce@email.com"
          />
          <Field
            label="Senha Nexa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="Sua senha"
          />
          <ActionButton
            label="Continuar com segurança"
            loading={loading}
            onPress={authenticateNexa}
          />
        </>
      ) : (
        <>
          <Field
            label="Código de acesso"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
          />
          <ActionButton
            label="Validar e preparar carteira"
            loading={loading}
            onPress={authenticatePrivy}
          />
          <ActionButton
            label="Recomeçar"
            variant="secondary"
            disabled={loading}
            onPress={restart}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={styles.securityCard}>
        <Text style={styles.securityTitle}>O app nunca pede sua chave privada.</Text>
        <Text style={styles.securityBody}>
          O token da Nexa fica no armazenamento seguro do aparelho. O token da
          Privy é usado apenas no momento da vinculação e não é salvo pelo app.
        </Text>
      </Card>
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
  securityCard: { marginTop: spacing.xl },
  securityTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  securityBody: {
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
