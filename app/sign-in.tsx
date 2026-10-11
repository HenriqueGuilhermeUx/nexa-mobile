import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Brand,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { config } from '@/config';
import { nexaApi, tokensFromLogin } from '@/lib/api';
import { resolveAuthenticatedRoute } from '@/lib/onboarding';
import {
  enableAppLock,
  markAppLockOfferSeen,
  shouldOfferAppLock,
} from '@/lib/appLock';
import {
  clearNexaTokens,
  loadNexaEmail,
  saveNexaSession,
} from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const globalProduct = config.globalProduct;

  useEffect(() => {
    let active = true;
    void loadNexaEmail().then((savedEmail) => {
      if (active && savedEmail) setEmail(savedEmail);
    });
    return () => {
      active = false;
    };
  }, []);

  async function goToAuthenticatedArea(
    profile: any,
    accessToken: string,
  ) {
    const target = await resolveAuthenticatedRoute(profile, accessToken);
    router.replace(target as any);
  }

  async function maybeOfferDeviceProtection(
    profile: any,
    accessToken: string,
  ) {
    if (!(await shouldOfferAppLock())) {
      await goToAuthenticatedArea(profile, accessToken);
      return;
    }

    Alert.alert(
      'Proteger a Nexa neste aparelho?',
      'Ative biometria ou a credencial de desbloqueio do aparelho para proteger o acesso à sua conta. Sua senha Nexa continua disponível como recuperação.',
      [
        {
          text: 'Agora não',
          style: 'cancel',
          onPress: () => {
            void markAppLockOfferSeen().finally(() => {
              void goToAuthenticatedArea(profile, accessToken);
            });
          },
        },
        {
          text: 'Ativar proteção',
          onPress: () => {
            void (async () => {
              const result = await enableAppLock();
              await markAppLockOfferSeen();
              if (!result.success) {
                Alert.alert(
                  'Proteção não ativada',
                  'Você pode continuar usando a Nexa com sua senha. A proteção do aparelho poderá ser ativada em uma próxima atualização de segurança.',
                );
              }
              void goToAuthenticatedArea(profile, accessToken);
            })();
          },
        },
      ],
      { cancelable: false },
    );
  }

  async function authenticateNexa() {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');
    if (!normalizedEmail || !password) {
      setError(
        globalProduct
          ? 'Enter your email and password.'
          : 'Informe seu e-mail e sua senha.',
      );
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

      // /user/me is the canonical onboarding profile: KYC, payout Pix,
      // Premium and linked wallet all come from the same source of truth.
      const profile = await nexaApi.me(tokens.accessToken);
      await maybeOfferDeviceProtection(profile, tokens.accessToken);
    } catch (caught) {
      await clearNexaTokens();
      setError(
        caught instanceof Error
          ? caught.message
          : globalProduct
            ? 'We could not sign you in.'
            : 'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function openPasswordRecovery() {
    setError('');
    try {
      await Linking.openURL('https://trynexa.com.br/login');
    } catch {
      setError(
        'Não foi possível abrir a recuperação de senha. Acesse trynexa.com.br/login no navegador.',
      );
    }
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Title>{globalProduct ? 'Welcome back' : 'Bem-vindo de volta'}</Title>
      <Paragraph>
        {globalProduct
          ? 'Access your Nexa Global wallet. Your Nexa password is not stored on this device.'
          : 'Acesse sua Nexa Wallet. Sua senha não é armazenada neste aparelho.'}
      </Paragraph>

      <Field
        label={globalProduct ? 'Email' : 'E-mail'}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        placeholder={globalProduct ? 'you@example.com' : 'voce@email.com'}
      />
      <Field
        label={globalProduct ? 'Password' : 'Senha'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder={globalProduct ? 'Your password' : 'Sua senha'}
      />
      <ActionButton
        label={globalProduct ? 'Sign in' : 'Entrar'}
        loading={loading}
        onPress={authenticateNexa}
      />
      <ActionButton
        label={globalProduct ? 'Forgot my password' : 'Esqueci minha senha'}
        variant="secondary"
        disabled={loading}
        onPress={openPasswordRecovery}
      />
      <ActionButton
        label={globalProduct ? 'Create account' : 'Criar conta'}
        variant="secondary"
        disabled={loading}
        onPress={() => router.push('/sign-up-country' as any)}
      />

      <Text style={styles.securityNote}>
        {globalProduct
          ? 'Biometrics can protect access after your first sign-in on this device.'
          : 'Biometria pode proteger o acesso depois do primeiro login neste aparelho.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  securityNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.md },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
