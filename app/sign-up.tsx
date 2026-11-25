import { useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [consentEmail,setConsentEmail] = useState(false);
  const [consentWhatsApp,setConsentWhatsApp] = useState(false);
  const [consentTelegram,setConsentTelegram] = useState(false);
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
      if (!privy?.isReady) {
        throw new Error('A preparação segura da carteira ainda está iniciando. Tente novamente em instantes.');
      }
      // Shared devices can retain another Nexa account's Privy session.
      // Disconnect only the old session; never delete its wallet or keys.
      const previousPrivyToken = typeof privy?.getAccessToken === 'function'
        ? await privy.getAccessToken()
        : null;
      if (previousPrivyToken) {
        if (typeof privy?.logout !== 'function') {
          throw new Error('Não foi possível trocar a sessão da carteira. Reabra o aplicativo antes de criar outra conta.');
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
        communicationConsents:{
          email:consentEmail,
          whatsapp:consentWhatsApp,
          telegram:consentTelegram,
        },
      });
      const tokens = tokensFromLogin(response);
      await saveNexaSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: normalizedEmail,
      });

      // A new customer activates/recovers their own Privy wallet before Didit.
      // No financial action is allowed until the necessary KYC is approved.
      // Wallet linking must use the SAME Nexa email; no duplicate account.
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
      <View style={styles.communicationConsent}>
        <Text style={styles.consentTitle}>Como podemos falar com você?</Text>
        <Text style={styles.consentDescription}>
          Escolha onde deseja receber orientações de uso, novidades e ofertas da Nexa.
          Tudo é opcional: seu cadastro funciona mesmo sem marcar nada.
        </Text>
        {([
          {key:'email',label:'E-mail',value:consentEmail,onChange:setConsentEmail},
          {key:'whatsapp',label:'WhatsApp',value:consentWhatsApp,onChange:setConsentWhatsApp},
          {key:'telegram',label:'Telegram',value:consentTelegram,onChange:setConsentTelegram},
        ] as const).map(item=>(
          <Pressable
            key={item.key}
            style={styles.consentRow}
            accessibilityRole="checkbox"
            accessibilityState={{checked:item.value}}
            accessibilityLabel={`Autorizar comunicações por ${item.label}`}
            disabled={loading}
            onPress={()=>item.onChange(!item.value)}
          >
            <View style={[styles.checkbox,item.value && styles.checkboxChecked]}>
              <Text style={styles.checkmark}>{item.value?'✓':''}</Text>
            </View>
            <Text style={styles.consentLabel}>Receber comunicações por {item.label}</Text>
          </Pressable>
        ))}
        <Text style={styles.consentFinePrint}>
          Você poderá mudar suas escolhas ou revogar qualquer autorização
          posteriormente, na área de preferências. Mensagens necessárias ao serviço,
          como alertas de segurança, são tratadas separadamente.
          O Telegram só será utilizado após você vincular seu chat.
        </Text>
      </View>
      <ActionButton
        label="Criar conta e ativar carteira"
        loading={loading}
        disabled={!privy?.isReady}
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
  communicationConsent: { marginVertical: spacing.md, padding: spacing.md,
    borderColor: colors.muted, borderWidth: 1, borderRadius: radius.md },
  consentTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  consentDescription: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  consentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  checkbox: { width: 21, height: 21, borderWidth: 1.5,
    borderColor: colors.muted, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  consentLabel: { flex: 1, color: colors.text, fontSize: 14 },
  consentFinePrint: { color: colors.muted, fontSize: 11, marginTop: spacing.sm },
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
