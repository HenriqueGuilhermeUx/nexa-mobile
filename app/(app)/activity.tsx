import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi, PixRedemption } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

type ActivityItem =
  | { kind: 'order'; date: string; value: any }
  | { kind: 'redemption'; date: string; value: PixRedemption };

function brl(value: unknown) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function usdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} USDC`;
}

function formatOrderAmount(order: any) {
  if (order.grossBrl !== undefined && order.grossBrl !== null) {
    return brl(order.grossBrl);
  }
  return usdc(order.amountUsdc);
}

function dateOf(value: any) {
  return String(value?.completedAt || value?.createdAt || new Date(0).toISOString());
}

function statusLabel(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  const labels: Record<string, string> = {
    pending: 'SOLICITADO',
    processing: 'EM PROCESSAMENTO',
    completed: 'PIX CONCLUÍDO',
    failed: 'CANCELADO',
    quoted: 'ESTIMATIVA REGISTRADA',
    awaiting_pix: 'AGUARDANDO PIX',
    pix_confirmed: 'PIX CONFIRMADO',
    awaiting_provider: 'AGUARDANDO PROVEDOR',
    awaiting_onchain_confirmation: 'AGUARDANDO BLOCKCHAIN',
    cancelled: 'CANCELADO',
    expired: 'EXPIRADO',
  };
  return labels[normalized] || String(status || 'REGISTRADO').toUpperCase();
}

function statusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'success';
  if (['failed', 'cancelled', 'expired'].includes(normalized)) return 'danger';
  if (['processing', 'awaiting_provider', 'awaiting_onchain_confirmation'].includes(normalized)) {
    return 'info';
  }
  return 'warning';
}

function referenceOf(redemption: PixRedemption) {
  return (
    redemption.endToEndId ||
    redemption.externalId ||
    redemption.pixReference ||
    redemption.id
  );
}

function RedemptionCard({ redemption }: { redemption: PixRedemption }) {
  const completed = String(redemption.status).toLowerCase() === 'completed';
  const failed = String(redemption.status).toLowerCase() === 'failed';
  const actualSale = redemption.saleProceedsBrl;
  const finalPayout = redemption.settledAmountBrl;
  const estimatedPayout = redemption.estimatedAmountBrl ?? redemption.amountBrl;
  const hasActualSettlement =
    actualSale !== null &&
    actualSale !== undefined &&
    finalPayout !== null &&
    finalPayout !== undefined;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.type}>RESGATE USDC → PIX</Text>
          <Text style={styles.date}>
            {redemption.createdAt
              ? new Date(redemption.createdAt).toLocaleString('pt-BR')
              : '—'}
          </Text>
        </View>
        <Badge tone={statusTone(redemption.status)}>
          {statusLabel(redemption.status)}
        </Badge>
      </View>

      <Text style={styles.amount}>{usdc(redemption.amountUsdc)}</Text>

      <View style={styles.settlementBox}>
        <Text style={styles.settlementTitle}>
          {hasActualSettlement ? 'Liquidação confirmada' : 'Estimativa antes da venda'}
        </Text>
        <Text style={styles.settlementValue}>
          {hasActualSettlement ? brl(finalPayout) : brl(estimatedPayout)}
        </Text>
        <Text style={styles.settlementExplanation}>
          {hasActualSettlement
            ? 'Valor final calculado sobre o BRL líquido realmente recebido na venda.'
            : 'Este valor não é garantido. O Pix final nasce somente após a venda real do USDC.'}
        </Text>
      </View>

      {hasActualSettlement ? (
        <>
          <KeyRow label="BRL líquido da venda" value={brl(actualSale)} />
          <KeyRow label="Fee Nexa" value={`− ${brl(redemption.nexaFeeBrl)}`} />
          <KeyRow label="Pix Out" value={`− ${brl(redemption.pixOutFeeBrl)}`} />
          <KeyRow label="Pix enviado" value={brl(finalPayout)} strong />
          <KeyRow
            label="Cotação efetiva"
            value={`${brl(redemption.exchangeRate)} por USDC`}
          />
        </>
      ) : (
        <>
          <KeyRow label="Estimativa líquida" value={brl(estimatedPayout)} />
          <KeyRow label="USDC reservado" value={usdc(redemption.amountUsdc)} />
          <KeyRow label="Prazo operacional" value="Até 1 dia útil" />
        </>
      )}

      <KeyRow label="Referência" value={referenceOf(redemption)} selectable />
      {completed && redemption.completedAt ? (
        <KeyRow
          label="Concluído em"
          value={new Date(redemption.completedAt).toLocaleString('pt-BR')}
        />
      ) : null}
      {failed && redemption.failureReason ? (
        <Text style={styles.failure}>{redemption.failureReason}</Text>
      ) : null}
    </Card>
  );
}

function KeyRow({
  label,
  value,
  strong = false,
  selectable = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  selectable?: boolean;
}) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text
        selectable={selectable}
        style={[styles.ruleValue, strong && styles.ruleValueStrong]}
      >
        {value}
      </Text>
    </View>
  );
}

function OrderCard({ order }: { order: any }) {
  const executionEnabled = order.executionEnabled === true;
  const fundsMoved = order.fundsMoved === true;
  return (
    <Card>
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
        <Badge tone={fundsMoved ? 'danger' : executionEnabled ? 'info' : 'warning'}>
          {fundsMoved
            ? 'REVISÃO NECESSÁRIA'
            : executionEnabled
              ? statusLabel(order.status)
              : 'MODO SEGURO'}
        </Badge>
      </View>
      <Text style={styles.amount}>{formatOrderAmount(order)}</Text>
      <KeyRow label="Status" value={statusLabel(order.status)} />
      <KeyRow label="Plano aplicado" value={order.plan || 'FREE'} />
      <KeyRow
        label="Execução financeira"
        value={executionEnabled ? 'Habilitada pelo backend' : 'Desativada'}
      />
      <KeyRow
        label="Fundos movimentados"
        value={fundsMoved ? 'Sim' : 'Não'}
      />
      <KeyRow
        label="Referência"
        value={order.clientRequestId || order.id}
        selectable
      />
    </Card>
  );
}

export default function ActivityScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<PixRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const [ordersResult, redemptionsResult] = await Promise.allSettled([
        nexaApi.listOrders(session.accessToken),
        nexaApi.listPixRedemptions(session.accessToken),
      ]);

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value?.orders || []);
      } else {
        setOrders([]);
      }
      if (redemptionsResult.status === 'fulfilled') {
        setRedemptions(
          Array.isArray(redemptionsResult.value) ? redemptionsResult.value : [],
        );
      } else {
        setRedemptions([]);
      }
      if (
        ordersResult.status === 'rejected' &&
        redemptionsResult.status === 'rejected'
      ) {
        throw ordersResult.reason;
      }
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

  const activity = useMemo<ActivityItem[]>(
    () =>
      [
        ...orders.map((value) => ({
          kind: 'order' as const,
          date: dateOf(value),
          value,
        })),
        ...redemptions.map((value) => ({
          kind: 'redemption' as const,
          date: dateOf(value),
          value,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [orders, redemptions],
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
      <Eyebrow>Extrato operacional</Eyebrow>
      <Title>Estimativa, execução e valor final.</Title>
      <Paragraph>
        Cada item mostra o que realmente aconteceu. Uma estimativa não é Pix
        garantido, e uma intenção não representa dinheiro movimentado.
      </Paragraph>

      {activity.map((item) =>
        item.kind === 'redemption' ? (
          <RedemptionCard key={`redemption-${item.value.id}`} redemption={item.value} />
        ) : (
          <OrderCard key={`order-${item.value.id}`} order={item.value} />
        ),
      )}

      {!loading && !activity.length ? (
        <Card>
          <Text style={styles.emptyTitle}>Nenhuma atividade registrada.</Text>
          <Text style={styles.emptyBody}>
            Suas futuras intenções, vendas conciliadas e liquidações aparecerão
            aqui.
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
  settlementBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  settlementTitle: { color: colors.muted, fontSize: 12 },
  settlementValue: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 24,
    marginTop: 5,
  },
  settlementExplanation: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  rule: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  ruleLabel: { color: colors.muted, fontSize: 11 },
  ruleValue: { color: colors.text, fontWeight: '800', marginTop: 3 },
  ruleValueStrong: { color: colors.cyan, fontSize: 18 },
  failure: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  emptyBody: { color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
