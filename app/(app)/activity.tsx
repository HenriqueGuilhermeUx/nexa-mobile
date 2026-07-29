import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Eyebrow, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function formatAmount(order: any) {
  if (order.grossBrl !== undefined && order.grossBrl !== null) {
    return Number(order.grossBrl).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }
  return `${Number(order.amountUsdc || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} USDC`;
}

export default function ActivityScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const response = await nexaApi.listOrders(session.accessToken);
      setOrders(response?.orders || []);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível carregar o histórico.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={colors.primary}
        />
      }
    >
      <Eyebrow>Histórico auditável</Eyebrow>
      <Title>Atividade da sua conta.</Title>
      <Paragraph>
        Cada item diferencia intenção, execução e movimentação. Uma ordem criada
        não significa que Pix ou USDC foram liquidados.
      </Paragraph>

      {orders.map((order) => {
        const executionEnabled = order.executionEnabled === true;
        return (
          <Card key={order.id}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.type}>
                  {String(order.type || 'ordem').toUpperCase()}
                </Text>
                <Text style={styles.date}>
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString('pt-BR')
                    : '—'}
                </Text>
              </View>
              <Badge tone={executionEnabled ? 'info' : 'warning'}>
                {executionEnabled ? 'EXECUÇÃO PENDENTE' : 'MODO SEGURO'}
              </Badge>
            </View>
            <Text style={styles.amount}>{formatAmount(order)}</Text>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Status</Text>
              <Text style={styles.ruleValue}>{order.status || 'created'}</Text>
            </View>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Plano aplicado</Text>
              <Text style={styles.ruleValue}>{order.plan || 'FREE'}</Text>
            </View>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Execução habilitada</Text>
              <Text style={styles.ruleValue}>
                {executionEnabled ? 'Sim' : 'Não'}
              </Text>
            </View>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Referência</Text>
              <Text selectable style={styles.reference}>
                {order.clientRequestId || order.id}
              </Text>
            </View>
          </Card>
        );
      })}

      {!loading && !orders.length ? (
        <Card>
          <Text style={styles.emptyTitle}>Nenhuma atividade registrada.</Text>
          <Text style={styles.emptyBody}>
            Suas futuras intenções e liquidações aparecerão aqui.
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  type: { color: colors.cyan, fontWeight: '900', fontSize: 12 },
  date: { color: colors.muted, fontSize: 11, marginTop: 4 },
  amount: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 28,
    marginVertical: spacing.lg,
  },
  rule: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  ruleLabel: { color: colors.muted, fontSize: 11 },
  ruleValue: { color: colors.text, fontWeight: '800', marginTop: 3 },
  reference: { color: colors.text, marginTop: 3, fontSize: 12 },
  emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  emptyBody: { color: colors.muted, marginTop: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
