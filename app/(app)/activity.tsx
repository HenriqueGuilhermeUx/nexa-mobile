import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Eyebrow, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function formatBrl(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} USDC`;
}

function formatOrderAmount(order: any) {
  if (order.grossBrl !== undefined && order.grossBrl !== null) {
    return formatBrl(order.grossBrl);
  }
  return formatUsdc(order.amountUsdc);
}

function paymentStage(payment: any) {
  const status = String(payment.status || '').toLowerCase();
  if (status === 'completed') {
    return { label: 'PIX ENVIADO', tone: 'success' as const };
  }
  if (status === 'failed') {
    return { label: 'RESGATE CANCELADO', tone: 'danger' as const };
  }
  if (payment.settledAmountBrl || payment.saleProceedsBrl) {
    return { label: 'PIX EM PROCESSAMENTO', tone: 'info' as const };
  }
  return { label: 'CONVERSÃO EM PROCESSAMENTO', tone: 'warning' as const };
}

function orderStage(order: any) {
  const status = String(order.status || '').toUpperCase();
  if (status === 'COMPLETED') return { label: 'CONCLUÍDA', tone: 'success' as const };
  if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(status)) {
    return { label: status, tone: 'danger' as const };
  }
  if (order.executionEnabled === true) {
    return { label: 'EXECUÇÃO PENDENTE', tone: 'info' as const };
  }
  return { label: 'MODO SEGURO', tone: 'warning' as const };
}

export default function ActivityScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const [ordersResponse, paymentsResponse] = await Promise.all([
        nexaApi.listOrders(session.accessToken),
        nexaApi.listPayments(session.accessToken),
      ]);
      setOrders(ordersResponse?.orders || []);
      setPayments(
        Array.isArray(paymentsResponse)
          ? paymentsResponse
          : paymentsResponse?.payments || [],
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar o histórico.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const timeline = useMemo(
    () =>
      [
        ...payments.map((payment) => ({
          kind: 'payment' as const,
          id: payment.id,
          createdAt: payment.createdAt,
          value: payment,
        })),
        ...orders.map((order) => ({
          kind: 'order' as const,
          id: order.id,
          createdAt: order.createdAt,
          value: order,
        })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      ),
    [orders, payments],
  );

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
        Estimativa, reserva, venda, fee, Pix e conclusão aparecem separadamente.
        Uma solicitação nunca é apresentada como dinheiro liquidado antes da hora.
      </Paragraph>

      {timeline.map((item) => {
        if (item.kind === 'payment') {
          const payment = item.value;
          const stage = paymentStage(payment);
          const completed = String(payment.status).toLowerCase() === 'completed';
          const estimated = Number(
            payment.estimatedAmountBrl ?? payment.amountBrl ?? 0,
          );
          const finalAmount = Number(
            payment.settledAmountBrl ??
              (completed ? payment.amountBrl : 0) ??
              0,
          );
          return (
            <Card key={`payment-${payment.id}`}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.type}>RESGATE PIX</Text>
                  <Text style={styles.date}>
                    {payment.createdAt
                      ? new Date(payment.createdAt).toLocaleString('pt-BR')
                      : '—'}
                  </Text>
                </View>
                <Badge tone={stage.tone}>{stage.label}</Badge>
              </View>

              <Text style={styles.amount}>{formatUsdc(payment.amountUsdc)}</Text>

              <View style={styles.rule}>
                <Text style={styles.ruleLabel}>Valor em reais</Text>
                <Text style={styles.ruleValue}>
                  {finalAmount > 0
                    ? `${formatBrl(finalAmount)} — FINAL`
                    : `${formatBrl(estimated)} — ESTIMATIVA`}
                </Text>
              </View>

              {payment.saleProceedsBrl !== null &&
              payment.saleProceedsBrl !== undefined ? (
                <View style={styles.rule}>
                  <Text style={styles.ruleLabel}>BRL líquido recebido na venda</Text>
                  <Text style={styles.ruleValue}>
                    {formatBrl(payment.saleProceedsBrl)}
                  </Text>
                </View>
              ) : null}

              {payment.nexaFeeBrl !== null &&
              payment.nexaFeeBrl !== undefined ? (
                <View style={styles.rule}>
                  <Text style={styles.ruleLabel}>Fee Nexa</Text>
                  <Text style={styles.ruleValue}>
                    {formatBrl(payment.nexaFeeBrl)}
                  </Text>
                </View>
              ) : null}

              {payment.pixOutFeeBrl !== null &&
              payment.pixOutFeeBrl !== undefined ? (
                <View style={styles.rule}>
                  <Text style={styles.ruleLabel}>Custo Pix Out</Text>
                  <Text style={styles.ruleValue}>
                    {formatBrl(payment.pixOutFeeBrl)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.rule}>
                <Text style={styles.ruleLabel}>Chave Pix</Text>
                <Text style={styles.ruleValue}>{payment.pixKey || '—'}</Text>
              </View>

              <View style={styles.rule}>
                <Text style={styles.ruleLabel}>Referência</Text>
                <Text selectable style={styles.reference}>
                  {payment.pixReference || payment.id}
                </Text>
              </View>

              {!completed && String(payment.status).toLowerCase() !== 'failed' ? (
                <Text style={styles.estimateNotice}>
                  O valor final será confirmado após a venda real e a conciliação.
                </Text>
              ) : null}
            </Card>
          );
        }

        const order = item.value;
        const stage = orderStage(order);
        return (
          <Card key={`order-${order.id}`}>
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
              <Badge tone={stage.tone}>{stage.label}</Badge>
            </View>
            <Text style={styles.amount}>{formatOrderAmount(order)}</Text>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Status</Text>
              <Text style={styles.ruleValue}>{order.status || 'created'}</Text>
            </View>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Plano aplicado</Text>
              <Text style={styles.ruleValue}>{order.plan || 'FREE'}</Text>
            </View>
            <View style={styles.rule}>
              <Text style={styles.ruleLabel}>Fundos movimentados</Text>
              <Text style={styles.ruleValue}>
                {order.fundsMoved === true ? 'Sim' : 'Não'}
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

      {!loading && !timeline.length ? (
        <Card>
          <Text style={styles.emptyTitle}>Nenhuma atividade registrada.</Text>
          <Text style={styles.emptyBody}>
            Suas solicitações, conversões e liquidações aparecerão aqui.
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
  estimateNotice: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  emptyBody: { color: colors.muted, marginTop: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
