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
  KeyValue,
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

export default function HomeScreen() {
  const privy = usePrivy() as any;
  const [me, setMe] = useState<any>({});
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
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
      const [meResponse, profileResponse, ordersResponse, paymentsResponse] =
        await Promise.all([
          nexaApi.me(session.accessToken),
          nexaApi.directProfile(session.accessToken),
          nexaApi.listOrders(session.accessToken),
          nexaApi.listPixRedemptions(session.accessToken),
        ]);
      setMe(meResponse?.user || meResponse || {});
      setProfile(profileFrom(profileResponse));
      setOrders(ordersResponse?.orders || []);
      setPayments(Array.isArray(paymentsResponse) ? paymentsResponse : []);
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
  const executionEnabled = profile.executable === true;
  const directReady = profile.directSettlementReady === true;
  const walletAddress = profile.wallet?.address || me.walletAddress || null;
  const walletLinked = profile.wallet?.linked === true || Boolean(walletAddress);
  const legacyBalance = Number(me.availableBalanceUsdc || 0);

  const latest = useMemo(
    () =>
      [
        ...payments.map((payment) => ({
          id: `payment-${payment.id}`,
          title: 'RESGATE PIX',
          createdAt: payment.createdAt,
          amount: formatUsdc(payment.amountUsdc),
          status:
            String(payment.status).toLowerCase() === 'completed'
              ? `Pix enviado: ${formatBrl(
                  payment.settledAmountBrl ?? payment.amountBrl,
                )}`
              : Number(payment.settledAmountBrl || 0) > 0
                ? `Valor final: ${formatBrl(payment.settledAmountBrl)}`
                : `Estimativa: ${formatBrl(
                    payment.estimatedAmountBrl ?? payment.amountBrl,
                  )}`,
        })),
        ...orders.map((order) => ({
          id: `order-${order.id}`,
          title: String(order.type || 'solicitação').toUpperCase(),
          createdAt: order.createdAt,
          amount: order.grossBrl
            ? formatBrl(order.grossBrl)
            : formatUsdc(order.amountUsdc),
          status:
            order.executionEnabled === true
              ? String(order.status || 'em processamento')
              : 'Solicitação registrada',
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 3),
    [orders, payments],
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
        <Badge tone={legacy || executionEnabled ? 'success' : 'warning'}>
          {legacy
            ? 'CONTA NEXA'
            : executionEnabled
              ? 'OPERAÇÃO LIBERADA'
              : 'ABERTURA GRADUAL'}
        </Badge>
      </View>

      <Eyebrow>Olá, {me.fullName?.split(' ')[0] || 'Nexa'}</Eyebrow>
      <Title>Seu acesso aos ativos digitais.</Title>
      <Paragraph>
        A conta mostra apenas informações registradas pela API, pelo ledger ou
        pela carteira. Estimativas nunca são apresentadas como dinheiro
        liquidado.
      </Paragraph>

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>
          {legacy ? 'Saldo USDC disponível' : 'Saldo USDC na carteira'}
        </Text>
        <Text style={styles.balanceValue}>
          {legacy ? formatUsdc(legacyBalance) : 'Aguardando leitura on-chain'}
        </Text>
        <Text style={styles.balanceExplanation}>
          {legacy
            ? 'Saldo oficial preservado no ledger da sua conta existente.'
            : 'O app não substitui a leitura da blockchain por um saldo interno.'}
        </Text>
        <Text style={styles.walletText} numberOfLines={1}>
          {legacy
            ? 'Conta existente preservada sem migração automática'
            : walletAddress || 'Carteira ainda não vinculada'}
        </Text>
      </Card>

      <View style={styles.actionGrid}>
        <View style={styles.actionItem}>
          <ActionButton
            label={legacy ? 'Resgatar USDC' : 'Nova solicitação'}
            disabled={!legacy && !walletLinked}
            onPress={() => router.push('/(app)/new-order')}
          />
        </View>
        <View style={styles.actionItem}>
          <ActionButton
            label="Atividade"
            variant="secondary"
            onPress={() => router.push('/(app)/activity')}
          />
        </View>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Status da conta</Text>
        <KeyValue
          label="Modelo"
          value={legacy ? 'Conta Nexa existente' : 'Carteira individual'}
        />
        <KeyValue
          label={legacy ? 'Histórico' : 'Carteira vinculada'}
          valueNode={
            <Badge tone={legacy || walletLinked ? 'success' : 'warning'}>
              {legacy ? 'Preservado' : walletLinked ? 'Sim' : 'Pendente'}
            </Badge>
          }
        />
        <KeyValue
          label="Operação disponível"
          valueNode={
            <Badge tone={legacy || directReady ? 'success' : 'warning'}>
              {legacy
                ? 'Resgate conciliado'
                : directReady
                  ? 'Carteira validada'
                  : 'Aguardando homologação'}
            </Badge>
          }
        />
        <KeyValue
          label="Movimentação automática"
          valueNode={
            <Badge tone={executionEnabled ? 'success' : 'warning'}>
              {executionEnabled ? 'Liberada' : 'Desativada'}
            </Badge>
          }
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Atividade recente</Text>
          <Text style={styles.sectionCount}>{orders.length + payments.length}</Text>
        </View>
        {latest.map((item) => (
          <View key={item.id} style={styles.orderRow}>
            <View style={styles.orderLeft}>
              <Text style={styles.orderTitle}>{item.title}</Text>
              <Text style={styles.orderDate}>
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString('pt-BR')
                  : '—'}
              </Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderAmount}>{item.amount}</Text>
              <Text style={styles.orderStatus}>{item.status}</Text>
            </View>
          </View>
        ))}
        {!latest.length ? (
          <Text style={styles.empty}>Nenhuma atividade registrada.</Text>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.loading}>Atualizando dados oficiais...</Text> : null}

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
  actionGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionItem: { flex: 1 },
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
