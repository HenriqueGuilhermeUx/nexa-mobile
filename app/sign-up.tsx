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
      // Prevent one customer's previous Privy session from becoming the
      // identity associated with another new Nexa account on a shared phone.
      // This signs out the old session; it never deletes any wallet.
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
          email:consentEmail,whatsapp:consentWhatsApp,telegram:consentTelegram,
        },
      });
      const tokens = tokensFromLogin(response);
      await saveNexaSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: normalizedEmail,
      });

      // O cliente cria/recupera sua própria Privy wallet antes do KYC.
      // KYC continua obrigatório antes das operações financeiras.
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
          Escolha onde quer receber orientações de uso, novidades e ofertas.
          Tudo é opcional; você pode criar a conta sem autorizar nenhum canal.
        </Text>
        {([
          {key:'email',label:'E-mail',value:consentEmail,onChange:setConsentEmail},
          {key:'whatsapp',label:'WhatsApp',value:consentWhatsApp,onChange:setConsentWhatsApp},
          {key:'telegram',label:'Telegram',value:consentTelegram,onChange:setConsentTelegram},
        ] as const).map(item=>(
          <Pressable key={item.key} style={styles.consentRow}
            accessibilityRole="checkbox"
            accessibilityState={{checked:item.value}}
            disabled={loading}
            onPress={()=>item.onChange(!item.value)}>
            <View style={[styles.checkbox,item.value&&styles.checkboxChecked]}>
              <Text style={styles.checkmark}>{item.value?'✓':''}</Text>
            </View>
            <Text style={styles.consentLabel}>Receber comunicações por {item.label}</Text>
          </Pressable>
        ))}
        <Text style={styles.consentFinePrint}>
          Você pode alterar ou revogar suas autorizações depois.
          Alertas de segurança são tratados separadamente.
          Para receber mensagens pelo Telegram, vincule seu chat.
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
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
  consentTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  consentDescription: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  consentRow: { flexDirection:'row', alignItems:'center', paddingVertical:9, gap:10 },
  checkbox: { width:21,height:21,borderWidth:1.5,borderColor:colors.muted,
    borderRadius:5,alignItems:'center',justifyContent:'center' },
  checkboxChecked: { backgroundColor:colors.primary,borderColor:colors.primary },
  checkmark: { color:colors.white,fontWeight:'bold',fontSize:15 },
  consentLabel: { flex:1,color:colors.text,fontSize:14 },
  consentFinePrint: { color:colors.muted,fontSize:11,marginTop:spacing.sm },
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
