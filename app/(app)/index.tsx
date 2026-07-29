import { useEffect, useState } from 'react';
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

export default function HomeScreen() {
  const privy = usePrivy() as any;
  const [me, setMe] = useState<any>({});
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
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
      const [meResponse, profileResponse, ordersResponse] = await Promise.all([
        nexaApi.me(session.accessToken),
        nexaApi.directProfile(session.accessToken),
        nexaApi.listOrders(session.accessToken),
      ]);
      setMe(meResponse?.user || meResponse || {});
      setProfile(profileFrom(profileResponse));
      setOrders(ordersResponse?.orders || []);
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

  const executionEnabled = profile.executable === true;
  const directReady = profile.directSettlementReady === true;
  const settlementProfile = String(profile.settlementProfile || 'direct');
  const walletAddress = profile.wallet?.address || me.walletAddress || null;
  const walletLinked = profile.wallet?.linked === true || Boolean(walletAddress);

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
        <Badge tone={executionEnabled ? 'success' : 'warning'}>
          {executionEnabled ? 'OPERAÇÃO LIBERADA' : 'MODO SEGURO'}
        </Badge>
      </View>

      <Eyebrow>Olá, {me.fullName?.split(' ')[0] || 'Nexa'}</Eyebrow>
      <Title>Seu acesso aos ativos digitais.</Title>
      <Paragraph>
        A conta mostra apenas informações registradas pela API e pela carteira.
        Nenhum saldo é criado por estimativa no aplicativo.
      </Paragraph>

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo USDC na carteira</Text>
        <Text style={styles.balanceValue}>Aguardando leitura on-chain</Text>
        <Text style={styles.balanceExplanation}>
          O app não substitui a leitura da blockchain por um saldo interno.
        </Text>
        <Text style={styles.walletText} numberOfLines={1}>
          {walletAddress || 'Carteira ainda não vinculada'}
        </Text>
      </Card>

      <View style={styles.actionGrid}>
        <View style={styles.actionItem}>
          <ActionButton
            label="Nova operação"
            disabled={!walletLinked || profile.isLegacyBeta === true}
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
        <KeyValue label="Perfil" value={settlementProfile} />
        <KeyValue
          label="Carteira vinculada"
          valueNode={
            <Badge tone={walletLinked ? 'success' : 'warning'}>
              {walletLinked ? 'Sim' : 'Pendente'}
            </Badge>
          }
        />
        <KeyValue
          label="Prontidão direta"
          valueNode={
            <Badge tone={directReady ? 'success' : 'warning'}>
              {directReady ? 'Validada' : 'Aguardando auditoria completa'}
            </Badge>
          }
        />
        <KeyValue
          label="Movimentação financeira"
          valueNode={
            <Badge tone={executionEnabled ? 'success' : 'warning'}>
              {executionEnabled ? 'Liberada' : 'Desativada'}
            </Badge>
          }
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas intenções</Text>
          <Text style={styles.sectionCount}>{orders.length}</Text>
        </View>
        {orders.slice(0, 3).map((order) => (
          <View key={order.id} style={styles.orderRow}>
            <View>
              <Text style={styles.orderTitle}>
                {String(order.type || 'ordem').toUpperCase()}
              </Text>
              <Text style={styles.orderDate}>
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleString('pt-BR')
                  : '—'}
              </Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderAmount}>
                {order.grossBrl
                  ? Number(order.grossBrl).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : `${Number(order.amountUsdc || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 8,
                    })} USDC`}
              </Text>
              <Text style={styles.orderStatus}>{order.status || 'criada'}</Text>
            </View>
          </View>
        ))}
        {!orders.length ? (
          <Text style={styles.empty}>Nenhuma intenção registrada.</Text>
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
  orderTitle: { color: colors.text, fontWeight: '900' },
  orderDate: { color: colors.muted, fontSize: 11, marginTop: 4 },
  orderRight: { alignItems: 'flex-end', flexShrink: 1 },
  orderAmount: { color: colors.text, fontWeight: '800' },
  orderStatus: { color: colors.warning, fontSize: 11, marginTop: 4 },
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
