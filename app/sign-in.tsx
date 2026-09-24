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
import { nexaApi, tokensFromLogin } from '@/lib/api';
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

  useEffect(() => {
    let active = true;
    void loadNexaEmail().then((savedEmail) => {
      if (active && savedEmail) setEmail(savedEmail);
    });
    return () => {
      active = false;
    };
  }, []);

  function goToAuthenticatedArea(profile: any) {
    if (profile?.kycStatus === 'approved') {
      router.replace('/legacy' as any);
    } else {
      router.replace('/kyc' as any);
    }
  }

  async function maybeOfferDeviceProtection(profile: any) {
    if (!(await shouldOfferAppLock())) {
      goToAuthenticatedArea(profile);
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
              goToAuthenticatedArea(profile);
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
              goToAuthenticatedArea(profile);
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

      const profile = response.user || (await nexaApi.me(tokens.accessToken));
      await maybeOfferDeviceProtection(profile);
    } catch (caught) {
      await clearNexaTokens();
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível entrar.',
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
      <Title>Entrar</Title>
      <Paragraph>
        Seu e-mail fica lembrado neste aparelho. Por segurança, sua senha não é armazenada.
      </Paragraph>

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
        label="Esqueci minha senha"
        variant="secondary"
        disabled={loading}
        onPress={openPasswordRecovery}
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
