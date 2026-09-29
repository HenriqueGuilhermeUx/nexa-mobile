import { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { clearNexaSession, loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function profileFrom(response: any) {
  return response?.profile || response || {};
}

function isLegacyProfile(profile: any) {
  const value = String(profile?.settlementProfile || '').toLowerCase();
  return profile?.isLegacyBeta === true || value.includes('legacy');
}

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

function depositStatus(deposit: any) {
  const routing = deposit?.rawPayload?.walletV15Routing || {};
  if (routing.onchainVerified === true || routing.completed === true) {
    return 'Disponível na carteira';
  }
  if (routing.walletFirstTreasurySubmitted === true) {
    return 'Enviando USDC';
  }
  if (routing.routed === true || String(deposit?.status || '').toLowerCase() === 'paid') {
    return 'Pix recebido';
  }
  return 'Processando';
}

export default function HomeScreen() {
  const privy = usePrivy() as any;
  const [me, setMe] = useState<any>({});
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }
      const [meResponse, profileResponse, ordersResponse, paymentsResponse, depositsResponse] =
        await Promise.all([
          nexaApi.me(session.accessToken),
          nexaApi.directProfile(session.accessToken),
          nexaApi.listOrders(session.accessToken),
          nexaApi.listPixRedemptions(session.accessToken),
          nexaApi.listFiatDeposits(session.accessToken),
        ]);
      setMe(meResponse?.user || meResponse || {});
      setProfile(profileFrom(profileResponse));
      setOrders(ordersResponse?.orders || []);
      setPayments(Array.isArray(paymentsResponse) ? paymentsResponse : []);
      setDeposits(Array.isArray(depositsResponse) ? depositsResponse : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao carregar a conta.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function logout() {
    await clearNexaSession();
    if (privy.logout) await privy.logout();
    router.replace('/');
  }

  const legacy = isLegacyProfile(profile);
  const walletAddress = profile.wallet?.address || me.walletAddress || null;
  const walletLinked = profile.wallet?.linked === true || Boolean(walletAddress);
  const legacyBalance = Number(me.availableBalanceUsdc || 0);

  const latest = useMemo(
    () =>
      [
        ...deposits.map((deposit) => ({
          id: `deposit-${deposit.id}`,
          title: 'PIX → USDC',
          createdAt: deposit.createdAt,
          amount: formatBrl(deposit.amountBrl),
          status: depositStatus(deposit),
        })),
        ...payments.map((payment) => ({
          id: `payment-${payment.id}`,
          title: 'USDC → PIX',
          createdAt: payment.createdAt,
          amount: formatUsdc(payment.amountUsdc),
          status:
            String(payment.status).toLowerCase() === 'completed'
              ? `Pix enviado: ${formatBrl(payment.settledAmountBrl ?? payment.amountBrl)}`
              : 'Processando resgate',
        })),
        ...orders.map((order) => ({
          id: `order-${order.id}`,
          title: String(order.type || 'operação').toUpperCase(),
          createdAt: order.createdAt,
          amount: order.grossBrl ? formatBrl(order.grossBrl) : formatUsdc(order.amountUsdc),
          status: String(order.status || 'processando'),
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 3),
    [deposits, orders, payments],
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.topRow}>
        <Brand />
        <Badge tone={walletLinked || legacy ? 'success' : 'warning'}>
          {legacy ? 'CONTA NEXA' : walletLinked ? 'CARTEIRA PRONTA' : 'CONFIGURANDO'}
        </Badge>
      </View>

      <Eyebrow>Olá, {me.fullName?.split(' ')[0] || 'Nexa'}</Eyebrow>
      <Title>Cripto sem complicação.</Title>
      <Paragraph>
        Adicione reais por Pix, envie e troque ativos diretamente pela sua
        carteira. A Nexa cuida da parte técnica para você.
      </Paragraph>

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{legacy ? 'Seu saldo' : 'Sua carteira'}</Text>
        <Text style={styles.balanceValue}>
          {legacy ? formatUsdc(legacyBalance) : 'USDC · Polygon'}
        </Text>
        <Text style={styles.balanceExplanation}>
          {legacy
            ? 'Seu saldo existente continua preservado.'
            : walletLinked
              ? 'Carteira vinculada e sob seu controle.'
              : 'Finalize a carteira para começar.'}
        </Text>
        {!legacy && walletAddress ? (
          <Text style={styles.walletText} numberOfLines={1}>
            {walletAddress}
          </Text>
        ) : null}
      </Card>

      <View style={styles.actionGrid}>
        <View style={styles.actionItem}>
          <ActionButton
            label={legacy ? 'Resgatar' : 'Adicionar dinheiro'}
            disabled={!legacy && !walletLinked}
            onPress={() => router.push('/(app)/new-order')}
          />
        </View>
        <View style={styles.actionItem}>
          <ActionButton
            label={legacy ? 'Atividade' : 'Sacar'}
            variant="secondary"
            disabled={!legacy && !walletLinked}
            onPress={() =>
              router.push(legacy ? '/(app)/activity' : '/(app)/cash-out')
            }
          />
        </View>
      </View>

      {!legacy ? (
        <View style={styles.actionGrid}>
          <View style={styles.actionItem}>
            <ActionButton
              label="Enviar"
              variant="secondary"
              disabled={!walletLinked}
              onPress={() => router.push('/(app)/send-nexa' as any)}
            />
          </View>
          <View style={styles.actionItem}>
            <ActionButton
              label="Comprar"
              variant="secondary"
              disabled={!walletLinked}
              onPress={() => router.push('/(app)/buy-crypto' as any)}
            />
          </View>
        </View>
      ) : null}

      {!legacy ? (
        <View style={styles.activityAction}>
          <ActionButton
            label="Atividade"
            variant="secondary"
            onPress={() => router.push('/(app)/activity')}
          />
        </View>
      ) : null}

      {!legacy ? (
        <Card>
          <Text style={styles.sectionTitle}>Wallet-First por padrão</Text>
          <Text style={styles.simpleText}>Pix entra. USDC chega à sua carteira.</Text>
          <Text style={styles.simpleText}>Envios Nexa → Nexa vão carteira → carteira.</Text>
          <Text style={styles.simpleText}>Trocas são autorizadas por você na sua wallet.</Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas movimentações</Text>
          <Text style={styles.sectionCount}>
            {deposits.length + orders.length + payments.length}
          </Text>
        </View>
        {latest.map((item) => (
          <View key={item.id} style={styles.orderRow}>
            <View style={styles.orderLeft}>
              <Text style={styles.orderTitle}>{item.title}</Text>
              <Text style={styles.orderDate}>
                {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '—'}
              </Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderAmount}>{item.amount}</Text>
              <Text style={styles.orderStatus}>{item.status}</Text>
            </View>
          </View>
        ))}
        {!latest.length ? (
          <Text style={styles.empty}>Sua primeira movimentação aparecerá aqui.</Text>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.loading}>Atualizando…</Text> : null}

      <ActionButton label="Sair da conta" variant="secondary" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: spacing.sm },
  balanceCard: { backgroundColor: '#11143C' },
  balanceLabel: { color: colors.muted, fontSize: 13 },
  balanceValue: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  balanceExplanation: { color: colors.muted, fontSize: 12, marginTop: 7 },
  walletText: { color: colors.cyan, fontSize: 12, marginTop: spacing.md },
  actionGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  actionItem: { flex: 1 },
  activityAction: { marginBottom: spacing.md },
  simpleText: { color: colors.muted, lineHeight: 22, marginTop: 5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  sectionCount: { color: colors.cyan, fontWeight: '900' },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.md,
  },
  orderLeft: { flex: 1 },
  orderTitle: { color: colors.text, fontWeight: '900' },
  orderDate: { color: colors.muted, fontSize: 11, marginTop: 4 },
  orderRight: { alignItems: 'flex-end', flex: 1 },
  orderAmount: { color: colors.text, fontWeight: '800' },
  orderStatus: {
    color: colors.warning,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  empty: { color: colors.muted, marginTop: spacing.md },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  loading: { color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
});
