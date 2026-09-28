import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Eyebrow, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi, PixRedemption } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

type ActivityItem =
  | { kind: 'deposit'; date: string; value: any }
  | { kind: 'order'; date: string; value: any }
  | { kind: 'redemption'; date: string; value: PixRedemption };

function brl(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
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

function dateOf(value: any) {
  return String(value?.completedAt || value?.updatedAt || value?.createdAt || new Date(0).toISOString());
}

function statusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'available', 'succeeded'].includes(normalized)) return 'success';
  if (['failed', 'cancelled', 'expired', 'review', 'manual_review'].includes(normalized)) return 'danger';
  if (['processing', 'sending', 'pix_received', 'awaiting_provider', 'awaiting_onchain_confirmation'].includes(normalized)) return 'info';
  return 'warning';
}

function redemptionLabel(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  const labels: Record<string, string> = {
    pending: 'Solicitado',
    processing: 'Processando',
    completed: 'Pix enviado',
    failed: 'Não concluído',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };
  return labels[normalized] || 'Registrado';
}

function KeyRow({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text selectable={selectable} style={styles.ruleValue}>{value}</Text>
    </View>
  );
}

function DepositCard({ deposit }: { deposit: any }) {
  const live = deposit.walletFirstStatus || null;
  const stage = String(live?.stage || '').toLowerCase();
  const label = live?.label || (deposit.status === 'paid' ? 'Pix recebido' : 'Processando');
  const completed = stage === 'available' || live?.completed === true;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.type}>ENTRADA VIA PIX</Text>
          <Text style={styles.date}>
            {deposit.createdAt ? new Date(deposit.createdAt).toLocaleString('pt-BR') : '—'}
          </Text>
        </View>
        <Badge tone={statusTone(stage || deposit.status)}>{String(label).toUpperCase()}</Badge>
      </View>

      <Text style={styles.amount}>{brl(deposit.amountBrl)}</Text>
      <View style={styles.settlementBox}>
        <Text style={styles.settlementTitle}>{completed ? 'Disponível' : 'Andamento'}</Text>
        <Text style={styles.settlementValue}>
          {completed && Number(live?.quotedUsdc || 0) > 0
            ? usdc(live.quotedUsdc)
            : label}
        </Text>
        <Text style={styles.settlementExplanation}>
          {completed
            ? 'Entrega confirmada na sua carteira.'
            : 'A Nexa acompanha a operação automaticamente. Você não precisa escolher rede nem endereço.'}
        </Text>
      </View>

      {Number(live?.quotedUsdc || 0) > 0 && !completed ? (
        <KeyRow label="USDC em processamento" value={usdc(live.quotedUsdc)} />
      ) : null}
      {live?.txHash ? <KeyRow label="Comprovante blockchain" value={live.txHash} selectable /> : null}
      <KeyRow label="Referência" value={String(deposit.externalId || deposit.id)} selectable />
    </Card>
  );
}

function RedemptionCard({ redemption }: { redemption: PixRedemption }) {
  const completed = String(redemption.status).toLowerCase() === 'completed';
  const finalPayout = redemption.settledAmountBrl;
  const estimatedPayout = redemption.estimatedAmountBrl ?? redemption.amountBrl;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.type}>USDC → PIX</Text>
          <Text style={styles.date}>
            {redemption.createdAt ? new Date(redemption.createdAt).toLocaleString('pt-BR') : '—'}
          </Text>
        </View>
        <Badge tone={statusTone(redemption.status)}>
          {redemptionLabel(redemption.status).toUpperCase()}
        </Badge>
      </View>

      <Text style={styles.amount}>{usdc(redemption.amountUsdc)}</Text>
      <View style={styles.settlementBox}>
        <Text style={styles.settlementTitle}>{completed ? 'Valor enviado' : 'Estimativa'}</Text>
        <Text style={styles.settlementValue}>
          {brl(completed ? finalPayout ?? redemption.amountBrl : estimatedPayout)}
        </Text>
        <Text style={styles.settlementExplanation}>
          {completed
            ? 'Resgate concluído e Pix conciliado.'
            : 'O valor final será confirmado depois da venda e da conciliação.'}
        </Text>
      </View>
      <KeyRow label="Referência" value={String(redemption.endToEndId || redemption.externalId || redemption.pixReference || redemption.id)} selectable />
      {redemption.failureReason ? <Text style={styles.failure}>{redemption.failureReason}</Text> : null}
    </Card>
  );
}

function OrderCard({ order }: { order: any }) {
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.type}>OPERAÇÃO ANTERIOR</Text>
          <Text style={styles.date}>
            {order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : '—'}
          </Text>
        </View>
        <Badge tone={statusTone(order.status)}>{String(order.status || 'registrada').toUpperCase()}</Badge>
      </View>
      <Text style={styles.amount}>
        {order.grossBrl !== undefined && order.grossBrl !== null
          ? brl(order.grossBrl)
          : usdc(order.amountUsdc)}
      </Text>
      <KeyRow label="Referência" value={String(order.clientRequestId || order.id)} selectable />
    </Card>
  );
}

export default function ActivityScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<PixRedemption[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const [ordersResult, redemptionsResult, depositsResult] = await Promise.allSettled([
        nexaApi.listOrders(session.accessToken),
        nexaApi.listPixRedemptions(session.accessToken),
        nexaApi.listFiatDeposits(session.accessToken),
      ]);

      setOrders(ordersResult.status === 'fulfilled' ? ordersResult.value?.orders || [] : []);
      setRedemptions(
        redemptionsResult.status === 'fulfilled' && Array.isArray(redemptionsResult.value)
          ? redemptionsResult.value
          : [],
      );

      const rawDeposits =
        depositsResult.status === 'fulfilled' && Array.isArray(depositsResult.value)
          ? depositsResult.value
          : [];
      const recentDeposits = rawDeposits.slice(0, 20);
      const enriched = await Promise.all(
        recentDeposits.map(async (deposit: any) => {
          const correlationID = String(deposit?.externalId || '').trim();
          if (!correlationID.startsWith('nexa_v15_')) return deposit;
          try {
            const walletFirstStatus = await nexaApi.getWalletFirstPixStatus(
              session.accessToken,
              correlationID,
            );
            return { ...deposit, walletFirstStatus };
          } catch {
            return deposit;
          }
        }),
      );
      setDeposits(enriched);

      if (
        ordersResult.status === 'rejected' &&
        redemptionsResult.status === 'rejected' &&
        depositsResult.status === 'rejected'
      ) {
        throw ordersResult.reason;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o histórico.');
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
        ...deposits.map((value) => ({ kind: 'deposit' as const, date: dateOf(value), value })),
        ...orders.map((value) => ({ kind: 'order' as const, date: dateOf(value), value })),
        ...redemptions.map((value) => ({ kind: 'redemption' as const, date: dateOf(value), value })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [deposits, orders, redemptions],
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
      }
    >
      <Eyebrow>Atividade</Eyebrow>
      <Title>Seu dinheiro, sem mistério.</Title>
      <Paragraph>
        Acompanhe Pix, conversões e entregas na carteira com estados simples e comprovantes quando concluídos.
      </Paragraph>

      {activity.map((item) => {
        if (item.kind === 'deposit') {
          return <DepositCard key={`deposit-${item.value.id}`} deposit={item.value} />;
        }
        if (item.kind === 'redemption') {
          return <RedemptionCard key={`redemption-${item.value.id}`} redemption={item.value} />;
        }
        return <OrderCard key={`order-${item.value.id}`} order={item.value} />;
      })}

      {!loading && !activity.length ? (
        <Card>
          <Text style={styles.emptyTitle}>Nenhuma movimentação ainda.</Text>
          <Text style={styles.emptyBody}>Quando você adicionar ou retirar dinheiro, tudo aparece aqui.</Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1 },
  type: { color: colors.cyan, fontWeight: '900', fontSize: 12 },
  date: { color: colors.muted, fontSize: 11, marginTop: 4 },
  amount: { color: colors.text, fontWeight: '900', fontSize: 28, marginVertical: spacing.lg },
  settlementBox: { borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.panelSoft, borderColor: colors.border, borderWidth: 1, marginBottom: spacing.sm },
  settlementTitle: { color: colors.muted, fontSize: 12 },
  settlementValue: { color: colors.text, fontWeight: '900', fontSize: 24, marginTop: 5 },
  settlementExplanation: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  rule: { borderTopColor: colors.border, borderTopWidth: 1, paddingVertical: spacing.sm },
  ruleLabel: { color: colors.muted, fontSize: 11 },
  ruleValue: { color: colors.text, fontWeight: '800', marginTop: 3 },
  failure: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  emptyTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  emptyBody: { color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
});
