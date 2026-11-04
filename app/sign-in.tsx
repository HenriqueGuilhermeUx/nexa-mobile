import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
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
  const params = useLocalSearchParams<{ mode?: string; cnpj?: string }>();
  const [companyMode, setCompanyMode] = useState(String(params.mode||'') === 'pj');
  const [cnpj,setCnpj] = useState(String(params.cnpj||'').replace(/\D/g,'').slice(0,14));
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

  async function goToAuthenticatedArea(
    profile: any,
    accessToken: string,
  ) {
    const target = await resolveAuthenticatedRoute(profile, accessToken);
    if(companyMode && String(profile?.kycStatus||'').toLowerCase()==='approved'){
      router.replace({pathname:'/(app)/pj-entry',params:{cnpj}} as any);
    } else {
      router.replace(target as any);
    }
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
    if (companyMode && cnpj && cnpj.length!==14){setError('Informe um CNPJ com 14 números ou deixe em branco para selecionar após entrar.');return;}
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

      // /user/me is the canonical onboarding profile: KYC, payout Pix,
      // Premium and linked wallet all come from the same source of truth.
      const profile = await nexaApi.me(tokens.accessToken);
      await maybeOfferDeviceProtection(profile, tokens.accessToken);
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
      <Title>{companyMode?'Nexa Empresa':'Bem-vindo de volta'}</Title>
      <ActionButton label={companyMode?'✓ Empresa (CNPJ)':'Pessoa Física'} variant="secondary" disabled={loading} onPress={()=>{setCompanyMode(!companyMode);setError('')}} />
      <Paragraph>
        {companyMode?'Entre com seu e-mail e senha Nexa. O CNPJ identifica a empresa; o acesso depende da aprovação PJ.':'Acesse sua Nexa Wallet. Sua senha não é armazenada neste aparelho.'}
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
      {companyMode?<Field label="CNPJ da empresa (opcional)" value={cnpj} onChangeText={v=>setCnpj(v.replace(/\D/g,'').slice(0,14))} keyboardType="numeric" placeholder="14 números" />:null}
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
        label={companyMode?"Criar conta e solicitar Nexa PJ":"Criar conta"}
        variant="secondary"
        disabled={loading}
        onPress={() => router.push({pathname:'/sign-up-country',params:{mode:companyMode?'pj':'pf'}} as any)}
      />

      <Text style={styles.securityNote}>Biometria pode proteger o acesso depois do primeiro login neste aparelho.</Text>

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
