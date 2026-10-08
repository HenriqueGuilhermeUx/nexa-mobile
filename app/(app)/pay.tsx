import { Redirect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { futureFinancialFeatures } from '@/lib/futureFinancialFeatures';
import { colors, radius, spacing } from '@/theme';

const METHODS = [
  {
    title: 'Escanear QR Pix',
    subtitle: 'Prioridade para contas e cobranças com QR Pix.',
  },
  {
    title: 'Pix Copia e Cola',
    subtitle: 'Cole o código Pix para preparar o pagamento.',
  },
  {
    title: 'Código de barras',
    subtitle: 'Fallback para boleto ou conta sem QR Pix.',
  },
  {
    title: 'Chave Pix',
    subtitle: 'Pagamento para uma chave Pix validada.',
  },
];

export default function NexaPayPreparedScreen() {
  if (!futureFinancialFeatures.nexaPayEnabled) {
    return <Redirect href={'/legacy' as any} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>NEXA PAY</Text>
      <Text style={styles.title}>Pagar</Text>
      <Text style={styles.subtitle}>
        Escolha como identificar a cobrança. A execução financeira permanece
        bloqueada até a homologação dos rails.
      </Text>

      <View style={styles.list}>
        {METHODS.map((method) => (
          <Pressable
            key={method.title}
            disabled
            accessibilityState={{ disabled: true }}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{method.title}</Text>
            <Text style={styles.cardText}>{method.subtitle}</Text>
            <Text style={styles.badge}>PREPARADO · NÃO HABILITADO</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Pagamento com USDC</Text>
        <Text style={styles.noticeText}>
          Estrutura prevista para Premium. Só será liberada depois de settlement,
          cotação, autorização da wallet, liquidez e payout estarem homologados.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  kicker: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  list: { gap: spacing.md, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    opacity: 0.9,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  cardText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  badge: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.md,
  },
  notice: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  noticeTitle: { color: colors.cyan, fontSize: 16, fontWeight: '800' },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
