import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

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
import { nexaApi } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

const experiences = [
  { value: 'never_used', label: 'Nunca usei' },
  { value: 'tried_once', label: 'Já tentei e achei confuso' },
  { value: 'already_uses', label: 'Já uso cripto' },
];

const interests = [
  { value: 'usdc', label: 'Acessar USDC' },
  { value: 'dollar_exposure', label: 'Exposição ao dólar' },
  { value: 'learning', label: 'Aprender sem complicação' },
  { value: 'business', label: 'Soluções para empresa' },
];

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EarlyAccessScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experience, setExperience] = useState('never_used');
  const [interest, setInterest] = useState('usdc');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  async function submit() {
    setError('');
    if (!fullName.trim() || !email.trim()) {
      setError('Informe nome e e-mail.');
      return;
    }
    if (!lgpdConsent) {
      setError('Aceite o tratamento dos dados para entrar na lista.');
      return;
    }

    setLoading(true);
    try {
      const response = await nexaApi.joinEarlyAccess({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        preferredChannel: phone.trim() ? 'whatsapp' : 'email',
        cryptoExperience: experience,
        primaryInterest: interest,
        source: 'nexa_mobile',
        campaign: 'primeiros_nexa',
        lgpdConsent,
        marketingConsent,
        metadata: {
          platform: 'mobile',
          screen: 'primeiros_nexa',
        },
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar na lista.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Screen>
        <Brand />
        <Badge tone="success">VOCÊ ESTÁ DENTRO</Badge>
        <View style={styles.topSpace} />
        <Title>Bem-vindo aos Primeiros Nexa.</Title>
        <Paragraph>
          {result.alreadyRegistered
            ? 'Seu cadastro já existia e foi atualizado sem perder a prioridade.'
            : 'Seu interesse foi registrado. A abertura será gradual e os convites chegarão pelo canal informado.'}
        </Paragraph>
        <Card>
          <Text style={styles.cardLabel}>Seu código de indicação</Text>
          <Text selectable style={styles.referralCode}>
            {result.lead?.referralCode || 'Será disponibilizado em breve'}
          </Text>
        </Card>
        <Text style={styles.note}>
          Entrar na lista não cria conta financeira, KYC, carteira ou saldo.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Brand />
      <Eyebrow>A primeira comunidade da Nexa</Eyebrow>
      <Title>Quero receber acesso primeiro.</Title>
      <Paragraph>
        Suas respostas ajudam a Nexa a organizar os primeiros convites e a
        simplificar o que realmente importa.
      </Paragraph>

      <Field
        label="Seu nome"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        autoComplete="name"
        placeholder="Como podemos chamar você?"
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
        label="WhatsApp com DDD (opcional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="(31) 99999-9999"
      />

      <Text style={styles.sectionLabel}>Sua experiência com cripto</Text>
      <View style={styles.choiceGroup}>
        {experiences.map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            selected={experience === option.value}
            onPress={() => setExperience(option.value)}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Principal interesse</Text>
      <View style={styles.choiceGroup}>
        {interests.map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            selected={interest === option.value}
            onPress={() => setInterest(option.value)}
          />
        ))}
      </View>

      <Card>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            Concordo com o tratamento dos dados para participar da lista.
          </Text>
          <Switch
            value={lgpdConsent}
            onValueChange={setLgpdConsent}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <Pressable
          onPress={() => Linking.openURL('https://trynexa.com.br/privacidade')}
        >
          <Text style={styles.link}>Ler Política de Privacidade</Text>
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            Autorizo conteúdos, pesquisas e novidades. Posso cancelar depois.
          </Text>
          <Switch
            value={marketingConsent}
            onValueChange={setMarketingConsent}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton
        label="Quero ser um dos Primeiros Nexa"
        loading={loading}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  sectionLabel: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  choiceGroup: { gap: spacing.sm, marginBottom: spacing.md },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: { color: colors.muted, fontWeight: '700' },
  choiceTextSelected: { color: colors.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchText: { color: colors.text, flex: 1, lineHeight: 20 },
  link: { color: colors.cyan, fontWeight: '700', marginTop: spacing.sm },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardLabel: { color: colors.muted, fontSize: 13 },
  referralCode: {
    color: colors.cyan,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  note: { color: colors.muted, textAlign: 'center', lineHeight: 19 },
});
