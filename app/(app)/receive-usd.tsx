import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { futureFinancialFeatures } from '@/lib/futureFinancialFeatures';
import { colors, radius, spacing } from '@/theme';

export default function ReceiveUsdPreparedScreen() {
  if (!futureFinancialFeatures.usReceivingEnabled) {
    return <Redirect href={'/legacy' as any} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>RECEBER DO EXTERIOR</Text>
      <Text style={styles.title}>Seus dados em USD</Text>
      <Text style={styles.subtitle}>
        Área preparada para Bridge Virtual Accounts. Nenhuma conta bancária é
        criada enquanto o produto não estiver homologado e habilitado.
      </Text>

      <View style={styles.card}>
        <Field label="Beneficiário" value="Aguardando habilitação" />
        <Field label="Routing number" value="•••••••••" />
        <Field label="Account number" value="••••••••••••" />
        <Field label="Métodos" value="ACH / Wire / instantâneo se disponível" />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Liquidação prevista</Text>
        <Text style={styles.noticeText}>
          USD recebido → conversão homologada → USDC → wallet Privy do cliente.
          A wallet continua sendo a fonte de verdade.
        </Text>
      </View>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
    fontSize: 30,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  field: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
  },
  label: { color: colors.mutedStrong, fontSize: 11, fontWeight: '700' },
  value: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 5 },
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
