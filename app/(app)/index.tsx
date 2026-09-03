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
import { nexaApi, WalletV15EntryReadiness } from '@/lib/api';
import { clearNexaSession, loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} USDC`;
}

function formatBrl(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function profileFrom(snapshot: any) {
  return snapshot?.status?.profile || null;
}

function statusLabel(readiness: WalletV15EntryReadiness | null, profile: any) {
  if (readiness?.ready) return 'PIX → USDC LIBERADO';
  if (profile?.userControlledWalletConfirmed !== true) return 'CONFIRME SUA WALLET';
  if (profile?.status !== 'active') return 'AGUARDANDO PILOTO';
  return 'JANELA FECHADA';
}

function blockerLabel(code: string) {
  const labels: Record<string, string> = {
    PILOT_ALLOWLIST_EMPTY: 'Piloto ainda sem usuário autorizado',
    PILOT_USER_NOT_ALLOWED: 'Conta aguardando liberação no piloto',
    WALLET_V15_PROFILE_NOT_ACTIVE: 'Perfil aguardando ativação controlada',
    WALLET_V15_DISABLED: 'Janela Wallet V1.5 fechada',
    WOOVI_V15_ROUTING_DISABLED: 'Entrada Pix ainda fechada',
    ORCHESTRATOR_DISABLED: 'Processamento automático ainda fechado',
    ORCHESTRATOR_EXTERNAL_EXECUTION_DISABLED: 'Compra Foxbit ainda fechada',
    FOXBIT_EXCHANGE_EXECUTION_DISABLED: 'Execução Foxbit ainda fechada',
    DESTINATION_WALLET_CRYPTOGRAPHIC_PROOF_REQUIRED:
      'Prova de controle da wallet pendente',
    KYC_NOT_APPROVED: 'KYC ainda não aprovado',
    ACCOUNT_NOT_ELIGIBLE: 'Conta indisponível para o piloto',
  };
  if (code.startsWith('CIRCUIT_BREAKER:')) {
    return 'Controle de risco bloqueou temporariamente novas entradas';
  }
  return labels[code] || code;
}

export default function HomeScreen() {
  const privy = usePrivy() as any;
  const [me, setMe] = useState<any>({});
  const [snapshot, setSnapshot] = useState<any>(null);
  const [readiness, setReadiness] = useState<WalletV15EntryReadiness | null>(null);
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

      const [meResponse, walletResponse, readinessResponse, depositResponse] =
        await Promise.all([
          nexaApi.me(session.accessToken),
          nexaApi.walletV15Me(session.accessToken),
          nexaApi.walletV15EntryReadiness(session.accessToken),
          nexaApi.listWalletV15FiatDeposits(session.accessToken),
        ]);

      const nextMe = meResponse?.user || meResponse || {};
      const profile = profileFrom(walletResponse);

      if (nextMe?.kycStatus !== 'approved') {
        router.replace('/kyc' as any);
        return;
      }
      if (!profile?.destinationWallet || profile?.userControlledWalletConfirmed !== true) {
        router.replace('/onboarding-wallet' as any);
        return;
      }

      setMe(nextMe);
      setSnapshot(walletResponse);
      setReadiness(readinessResponse);
      setDeposits(Array.isArray(depositResponse) ? depositResponse : []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível atualizar sua Wallet V1.5.',
      );
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

  const profile = profileFrom(snapshot);
  const balances = snapshot?.balances || {};
  const operational = Number(balances.operationalUsdc || 0);
  const pending = Number(balances.pendingSettlementUsdc || 0);
  const settledOnchain = Number(balances.settledOnchainJournalUsdc || 0);
  const blockers = readiness?.blockers || [];

  const latestDeposits = useMemo(
    () =>
      deposits
        .slice()
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 3),
    [deposits],
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
        <Badge tone={readiness?.ready ? 'success' : 'warning'}>
          {statusLabel(readiness, profile)}
        </Badge>
      </View>

      <Eyebrow>Olá, {me.fullName?.split(' ')[0] || 'Nexa'}</Eyebrow>
      <Title>Seu Saldo Nexa.</Title>
      <Paragraph>
        O saldo operacional é o USDC disponível para usar dentro da Nexa. Uma
        entrada Pix só é liberada quando toda a janela controlada está pronta.
      </Paragraph>

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo Nexa disponível</Text>
        <Text style={styles.balanceValue}>{formatUsdc(operational)}</Text>
        <View style={styles.balanceBreakdown}>
          <Text style={styles.balanceSecondary}>
            Em processamento: {formatUsdc(pending)}
          </Text>
          <Text style={styles.balanceSecondary}>
            Liquidado on-chain (histórico): {formatUsdc(settledOnchain)}
          </Text>
        </View>
      </Card>

      <ActionButton
        label={readiness?.ready ? 'Adicionar via Pix' : 'Pix aguardando liberação'}
        disabled={!readiness?.ready}
        onPress={() => router.push('/(app)/new-order')}
      />

      {!readiness?.ready ? (
        <Card>
          <Text style={styles.sectionTitle}>Preparação do piloto</Text>
          <Text style={styles.helper}>
            Sua conta e sua wallet já podem ficar prontas antes da abertura da
            janela financeira. Você não precisa operar endpoints manualmente.
          </Text>
          {blockers.slice(0, 4).map((code) => (
            <Text key={code} style={styles.blocker}>
              • {blockerLabel(code)}
            </Text>
          ))}
          <Text selectable style={styles.userId}>
            ID piloto: {me.id || '—'}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Conta V1.5</Text>
        <KeyValue label="KYC" value={me.kycStatus === 'approved' ? 'Aprovado' : 'Pendente'} />
        <KeyValue label="Perfil" value={String(profile?.status || 'pilot')} />
        <KeyValue
          label="Wallet confirmada"
          value={profile?.userControlledWalletConfirmed ? 'Sim' : 'Não'}
        />
        <Text style={styles.walletLabel}>Wallet Polygon</Text>
        <Text selectable style={styles.wallet}>
          {profile?.destinationWallet || '—'}
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Entradas Pix recentes</Text>
        {latestDeposits.length ? (
          latestDeposits.map((deposit) => (
            <View key={deposit.id} style={styles.depositRow}>
              <View style={styles.depositLeft}>
                <Text style={styles.depositTitle}>PIX</Text>
                <Text style={styles.depositDate}>
                  {deposit.createdAt
                    ? new Date(deposit.createdAt).toLocaleString('pt-BR')
                    : '—'}
                </Text>
              </View>
              <View style={styles.depositRight}>
                <Text style={styles.depositAmount}>
                  {formatBrl(deposit.amountBrl)}
                </Text>
                <Text style={styles.depositStatus}>
                  {String(deposit.status || 'aguardando')}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>Nenhuma entrada Pix registrada.</Text>
        )}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <Text style={styles.loading}>Atualizando Wallet V1.5...</Text>
      ) : null}

      <ActionButton label="Atualizar" variant="secondary" onPress={() => load(true)} />
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
    fontSize: 31,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  balanceBreakdown: { marginTop: spacing.md, gap: 5 },
  balanceSecondary: { color: colors.muted, fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  helper: { color: colors.muted, lineHeight: 20, marginTop: spacing.sm },
  blocker: { color: colors.warning, marginTop: 7, lineHeight: 19 },
  userId: { color: colors.cyan, fontSize: 11, marginTop: spacing.md },
  walletLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  wallet: { color: colors.cyan, fontSize: 12, marginTop: 5 },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingVertical: spacing.md,
  },
  depositLeft: { flex: 1 },
  depositTitle: { color: colors.text, fontWeight: '900' },
  depositDate: { color: colors.muted, fontSize: 11, marginTop: 4 },
  depositRight: { alignItems: 'flex-end', flex: 1 },
  depositAmount: { color: colors.text, fontWeight: '800' },
  depositStatus: { color: colors.warning, fontSize: 11, marginTop: 4 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  loading: { color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
});
