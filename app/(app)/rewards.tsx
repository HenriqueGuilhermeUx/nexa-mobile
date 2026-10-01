import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrivy } from '@privy-io/expo';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Card,
  Eyebrow,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import {
  bridgeRewardsToBase,
  depositRewards,
  getRewardsAction,
  getRewardsBridgeQuote,
  getRewardsPosition,
  getRewardsVault,
  withdrawRewardsFull,
} from '@/lib/rewardsActions';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

const PENDING_KEY = 'nexa_rewards_pending_action_v1';

type PendingAction = {
  type: 'bridge' | 'deposit' | 'withdraw';
  actionId: string;
  requestedAmount?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseAmount(value: string) {
  const amount = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(amount) ? amount : 0;
}

function formatUsdc(value: unknown, digits = 6) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })} USDC`;
}

function rawUsdc(raw: unknown, decimals = 6) {
  try {
    const value = BigInt(String(raw || '0'));
    const divisor = 10 ** Math.max(0, Math.min(12, decimals));
    return Number(value) / divisor;
  } catch {
    return 0;
  }
}

function currentApyPercent(vaultResponse: any) {
  const vault = vaultResponse?.vault || {};
  const candidates = [
    vault?.apy,
    vault?.net_apy,
    vault?.netApy,
    vault?.current_apy,
    vault?.currentApy,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value > 1 ? value : value * 100;
    }
  }
  return null;
}

function normalizedStatus(action: any) {
  return String(action?.status || '').trim().toLowerCase();
}

export default function RewardsScreen() {
  const privy = usePrivy() as any;
  const [vault, setVault] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [amount, setAmount] = useState('1,00');
  const [quote, setQuote] = useState<any>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const premium = String(vault?.plan || position?.plan || '') === 'premium';
  const apy = useMemo(() => currentApyPercent(vault), [vault]);
  const decimals = Number(position?.summary?.decimals || 6);
  const assetsInVault = rawUsdc(position?.summary?.assetsInVaultRaw, decimals);
  const earnedYield = rawUsdc(position?.summary?.earnedYieldRaw, decimals);

  async function sessionOrThrow() {
    const session = await loadNexaSession();
    if (!session?.accessToken) throw new Error('Sua sessão Nexa expirou.');
    return session;
  }

  async function privyJwtOrThrow() {
    if (typeof privy?.getAccessToken !== 'function') {
      throw new Error('Sua carteira precisa ser autenticada para continuar.');
    }
    const token = String((await privy.getAccessToken()) || '').trim();
    if (token.length < 40 || token.split('.').length !== 3) {
      throw new Error('Sua sessão da carteira expirou. Entre novamente na Nexa para continuar.');
    }
    return token;
  }

  async function savePending(next: PendingAction | null) {
    setPending(next);
    if (next) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(PENDING_KEY);
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const session = await sessionOrThrow();
      const [vaultResponse, positionResponse, stored] = await Promise.all([
        getRewardsVault(session.accessToken),
        getRewardsPosition(session.accessToken),
        AsyncStorage.getItem(PENDING_KEY),
      ]);
      setVault(vaultResponse);
      setPosition(positionResponse);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.actionId && parsed?.type) setPending(parsed);
        } catch {
          await AsyncStorage.removeItem(PENDING_KEY);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível abrir o Nexa Rewards.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function waitForAction(accessToken: string, actionId: string) {
    let last: any = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      last = await getRewardsAction(accessToken, actionId);
      const status = normalizedStatus(last?.action);
      if (status === 'succeeded' || status === 'success' || status === 'completed') {
        return last;
      }
      if (status === 'failed' || status === 'rejected') {
        const detail = String(last?.action?.failureReason || '').trim();
        throw new Error(
          detail
            ? `A operação não foi concluída: ${detail}`
            : 'A operação não foi concluída pela carteira.',
        );
      }
      setStatusText('Confirmando sua operação com segurança…');
      await sleep(3_000);
    }
    throw new Error('A operação continua em processamento. Não repita; atualize o status em instantes.');
  }

  async function seeQuote() {
    const requested = parseAmount(amount);
    setError('');
    setQuote(null);
    if (requested <= 0) {
      setError('Informe quanto USDC deseja turbinar.');
      return;
    }
    setWorking(true);
    try {
      const session = await sessionOrThrow();
      const result = await getRewardsBridgeQuote(session.accessToken, requested);
      setQuote(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível preparar sua estimativa.');
    } finally {
      setWorking(false);
    }
  }

  async function continueBridge(
    accessToken: string,
    privyJwt: string,
    bridgeAction: any,
    requestedAmount: number,
  ) {
    const actionId = String(bridgeAction?.action?.id || bridgeAction?.id || '').trim();
    if (!actionId) throw new Error('A carteira não retornou o identificador da operação.');
    await savePending({ type: 'bridge', actionId, requestedAmount });
    setStatusText('Preparando seu USDC para o Rewards…');
    const finalBridge = await waitForAction(accessToken, actionId);
    const arrived = Number(finalBridge?.action?.destinationAmount || 0);
    if (!Number.isFinite(arrived) || arrived <= 0) {
      throw new Error(
        'Seu USDC já foi movimentado para o Rewards, mas o valor final ainda não ficou disponível. Não repita a operação; atualize o status.',
      );
    }

    setStatusText('Ativando seus Rewards…');
    const deposit = await depositRewards(accessToken, privyJwt, arrived);
    const depositId = String(deposit?.action?.id || '').trim();
    if (!depositId) throw new Error('O Rewards não retornou o identificador do depósito.');
    await savePending({ type: 'deposit', actionId: depositId, requestedAmount: arrived });
    await waitForAction(accessToken, depositId);
    await savePending(null);
    setStatusText('USDC turbinado com sucesso.');
  }

  async function turbocharge() {
    if (pending) {
      setError('Já existe uma operação Rewards em andamento. Atualize o status antes de iniciar outra.');
      return;
    }
    const requested = parseAmount(amount);
    setError('');
    if (requested <= 0) {
      setError('Informe quanto USDC deseja turbinar.');
      return;
    }
    setWorking(true);
    try {
      const session = await sessionOrThrow();
      const privyJwt = await privyJwtOrThrow();
      if (!quote) {
        const result = await getRewardsBridgeQuote(session.accessToken, requested);
        setQuote(result);
      }
      setStatusText('Preparando seu USDC para o Rewards…');
      const bridge = await bridgeRewardsToBase(session.accessToken, privyJwt, requested);
      await continueBridge(session.accessToken, privyJwt, bridge, requested);
      const refreshed = await getRewardsPosition(session.accessToken);
      setPosition(refreshed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir o Turbinar.');
    } finally {
      setWorking(false);
    }
  }

  async function resumePending() {
    if (!pending) return;
    setWorking(true);
    setError('');
    try {
      const session = await sessionOrThrow();
      const result = await getRewardsAction(session.accessToken, pending.actionId);
      const status = normalizedStatus(result?.action);
      if (status === 'failed' || status === 'rejected') {
        await savePending(null);
        throw new Error('A operação anterior não foi concluída. Você pode tentar novamente.');
      }
      if (status !== 'succeeded' && status !== 'success' && status !== 'completed') {
        setStatusText('Sua operação ainda está sendo confirmada.');
        return;
      }

      if (pending.type === 'bridge') {
        const arrived = Number(result?.action?.destinationAmount || 0);
        if (!Number.isFinite(arrived) || arrived <= 0) {
          throw new Error('A transferência foi concluída, mas o valor final ainda não está disponível. Atualize novamente em instantes.');
        }
        const privyJwt = await privyJwtOrThrow();
        setStatusText('Ativando seus Rewards…');
        const deposit = await depositRewards(session.accessToken, privyJwt, arrived);
        const depositId = String(deposit?.action?.id || '').trim();
        if (!depositId) throw new Error('O Rewards não retornou o identificador do depósito.');
        await savePending({ type: 'deposit', actionId: depositId, requestedAmount: arrived });
        await waitForAction(session.accessToken, depositId);
      } else if (pending.type === 'deposit' || pending.type === 'withdraw') {
        await waitForAction(session.accessToken, pending.actionId);
      }

      await savePending(null);
      const refreshed = await getRewardsPosition(session.accessToken);
      setPosition(refreshed);
      setStatusText(pending.type === 'withdraw' ? 'Resgate confirmado.' : 'Rewards confirmados.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a operação.');
    } finally {
      setWorking(false);
    }
  }

  async function withdrawAll() {
    if (pending) {
      setError('Já existe uma operação Rewards em andamento. Atualize o status primeiro.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const session = await sessionOrThrow();
      const privyJwt = await privyJwtOrThrow();
      setStatusText('Resgatando seus Rewards…');
      const result = await withdrawRewardsFull(session.accessToken, privyJwt);
      const actionId = String(result?.action?.id || '').trim();
      if (!actionId) throw new Error('O Rewards não retornou o identificador do resgate.');
      await savePending({ type: 'withdraw', actionId });
      await waitForAction(session.accessToken, actionId);
      await savePending(null);
      const refreshed = await getRewardsPosition(session.accessToken);
      setPosition(refreshed);
      setStatusText('Resgate confirmado na sua carteira.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível resgatar agora.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen>
      <Eyebrow>Nexa Rewards</Eyebrow>
      <Title>Turbine seu USDC.</Title>
      <Paragraph>
        Coloque seu USDC para trabalhar e acompanhe seus Rewards de um jeito simples.
      </Paragraph>

      {premium ? (
        <Card style={styles.premiumCard}>
          <Badge tone="success">SUPER TURBINADO</Badge>
          <Text style={styles.premiumTitle}>+20% de Rewards</Text>
          <Text style={styles.muted}>Benefício exclusivo Nexa Premium.</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Seu USDC turbinado</Text>
        <Text style={styles.balance}>{formatUsdc(assetsInVault)}</Text>
        <Text style={styles.reward}>Rewards acumulados: {formatUsdc(earnedYield)}</Text>
        <Text style={styles.muted}>
          {apy !== null
            ? `Rendimento atual estimado: ${apy.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.*`
            : 'Rendimento variável, atualizado pela estratégia Rewards.*'}
        </Text>
      </Card>

      <Card>
        <Field
          label="Quanto deseja turbinar?"
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setQuote(null);
          }}
          keyboardType="decimal-pad"
          placeholder="1,00"
        />
        {quote ? (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteTitle}>Estimativa pronta</Text>
            <Text style={styles.muted}>
              Você envia {formatUsdc(quote.amountUsdc)} para ativar seus Rewards.
            </Text>
            {quote.estimatedOutputUsdc ? (
              <Text style={styles.muted}>
                Valor estimado disponível para Rewards: {formatUsdc(quote.estimatedOutputUsdc)}
              </Text>
            ) : null}
          </View>
        ) : null}
        <ActionButton label="Ver estimativa" variant="secondary" onPress={seeQuote} loading={working} />
        <ActionButton
          label={premium ? 'Ativar Super Turbinado' : 'Turbinar USDC'}
          onPress={turbocharge}
          loading={working}
          disabled={Boolean(pending) || vault?.liveActionsEnabled !== true}
        />
        {vault?.liveActionsEnabled !== true ? (
          <Text style={styles.pilot}>Homologação final em andamento. Nenhum valor será movimentado até a liberação do piloto.</Text>
        ) : null}
      </Card>

      {pending ? (
        <Card>
          <Badge tone="warning">OPERAÇÃO EM ANDAMENTO</Badge>
          <Text style={styles.muted}>Não inicie outra operação enquanto esta estiver sendo confirmada.</Text>
          <ActionButton label="Atualizar status" variant="secondary" onPress={resumePending} loading={working} />
        </Card>
      ) : null}

      {assetsInVault > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Seu Rewards está ativo</Text>
          <Text style={styles.muted}>Você pode resgatar seu saldo quando quiser, sujeito à liquidez da estratégia.</Text>
          <ActionButton
            label="Resgatar tudo"
            variant="secondary"
            onPress={withdrawAll}
            loading={working}
            disabled={Boolean(pending) || vault?.liveActionsEnabled !== true}
          />
        </Card>
      ) : null}

      {statusText ? <Text style={styles.status}>{statusText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.loading}>Atualizando Rewards…</Text> : null}

      <Text style={styles.disclaimer}>
        *Rendimento variável e não garantido. O valor pode oscilar e existem riscos de mercado, protocolo e liquidez.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  premiumCard: { backgroundColor: '#11143C' },
  premiumTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  label: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  balance: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: spacing.sm },
  reward: { color: colors.cyan, fontWeight: '900', marginTop: spacing.sm, marginBottom: spacing.sm },
  muted: { color: colors.muted, lineHeight: 21 },
  quoteBox: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 5,
  },
  quoteTitle: { color: colors.text, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontWeight: '900', fontSize: 18, marginBottom: spacing.sm },
  pilot: { color: colors.warning, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  status: {
    color: colors.cyan,
    backgroundColor: '#101B2F',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  loading: { color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: spacing.xl },
});
