import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthorizationSignature, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
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
  getRewardsWalletBalances,
  prepareRewardsAuthorization,
  returnRewardsToWallet,
  runRewardsAuthorizationDiagnostic,
  type RewardsAuthorizationAction,
  type RewardsAuthorizationProof,
  withdrawRewardsFull,
} from '@/lib/rewardsActions';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

const PENDING_KEY = 'nexa_rewards_pending_action_v1';

type PendingAction = {
  type: 'bridge' | 'deposit' | 'withdraw' | 'return';
  actionId: string;
  requestedAmount?: number;
  nextRequestStarted?: 'deposit' | 'return';
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

function isCompleted(status: string) {
  return status === 'succeeded' || status === 'success' || status === 'completed';
}

function isFailed(status: string) {
  return status === 'failed' || status === 'rejected';
}

function failureMessage(result: any) {
  const detail = String(result?.action?.failureReason || '').trim();
  return detail
    ? `A operação não foi concluída: ${detail}. Não repita antes de verificarmos esta action.`
    : 'A operação não foi concluída. Não repita antes de verificarmos esta action.';
}

function safeReturnAmount(result: any, fallback?: number) {
  const preferred = Number(fallback || 0);
  if (Number.isFinite(preferred) && preferred > 0) return preferred;

  const candidates = [result?.action?.destinationAmount, result?.action?.amount];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export default function RewardsScreen() {
  const privy = usePrivy() as any;
  const walletAuthorization = useAuthorizationSignature() as any;
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

  async function ensurePrivySession() {
    let token = '';
    try {
      if (typeof privy?.getAccessToken === 'function') {
        token = String((await privy.getAccessToken()) || '').trim();
      }
    } catch {
      token = '';
    }

    if (token.length < 40 || token.split('.').length !== 3) {
      router.push({
        pathname: '/wallet-session',
        params: { returnTo: 'rewards' },
      } as any);
      throw new Error(
        'Confirme sua carteira para continuar. Nenhum valor foi movimentado.',
      );
    }
  }

  async function authorizeRewardsAction(
    accessToken: string,
    action: RewardsAuthorizationAction,
    input: { amountUsdc?: number; full?: boolean } = {},
  ): Promise<RewardsAuthorizationProof> {
    await ensurePrivySession();
    const prepared = await prepareRewardsAuthorization(
      accessToken,
      action,
      input,
    );

    if (
      !prepared?.request ||
      typeof walletAuthorization?.generateAuthorizationSignature !== 'function'
    ) {
      throw new Error(
        'A assinatura segura da carteira não está disponível nesta versão.',
      );
    }

    const signed = await walletAuthorization.generateAuthorizationSignature(
      prepared.request,
    );
    const signature = String(signed?.signature || '').trim();
    if (signature.length < 40) {
      throw new Error(
        'A carteira não conseguiu autorizar esta operação. Nenhum valor foi movimentado.',
      );
    }

    return {
      ...prepared.execution,
      signature,
    };
  }

  async function savePending(next: PendingAction | null) {
    setPending(next);
    if (next) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(PENDING_KEY);
  }

  async function refreshPosition(accessToken: string) {
    const refreshed = await getRewardsPosition(accessToken);
    setPosition(refreshed);
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
      if (isCompleted(status)) return last;
      if (isFailed(status)) throw new Error(failureMessage(last));
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

  async function startDepositAfterBridge(
    accessToken: string,
    bridgeActionId: string,
    arrived: number,
  ) {
    await savePending({
      type: 'bridge',
      actionId: bridgeActionId,
      requestedAmount: arrived,
      nextRequestStarted: 'deposit',
    });
    setStatusText('Autorizando depósito no Rewards…');
    const authorization = await authorizeRewardsAction(
      accessToken,
      'deposit',
      { amountUsdc: arrived },
    );
    setStatusText('Ativando seus Rewards…');
    const deposit = await depositRewards(accessToken, arrived, authorization);
    const depositId = String(deposit?.action?.id || '').trim();
    if (!depositId) {
      throw new Error('O depósito foi solicitado, mas não recebemos o identificador da action. Não repita a operação.');
    }
    await savePending({ type: 'deposit', actionId: depositId, requestedAmount: arrived });
    await waitForAction(accessToken, depositId);
    await savePending(null);
    setStatusText('USDC turbinado com sucesso.');
  }

  async function startDepositFromBase(
    accessToken: string,
    amountUsdc: number,
  ) {
    setStatusText('USDC já localizado na rede Rewards. Autorizando depósito…');
    const authorization = await authorizeRewardsAction(
      accessToken,
      'deposit',
      { amountUsdc },
    );
    setStatusText('Ativando seus Rewards…');
    const deposit = await depositRewards(
      accessToken,
      amountUsdc,
      authorization,
    );
    const depositId = String(deposit?.action?.id || '').trim();
    if (!depositId) {
      throw new Error('O depósito foi solicitado, mas não recebemos o identificador da action. Não repita a operação.');
    }
    await savePending({ type: 'deposit', actionId: depositId, requestedAmount: amountUsdc });
    await waitForAction(accessToken, depositId);
    await savePending(null);
    await refreshPosition(accessToken);
    setStatusText('USDC turbinado com sucesso.');
  }

  async function continueBridge(
    accessToken: string,
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
    await startDepositAfterBridge(accessToken, actionId, arrived);
  }

  async function startReturnToWallet(
    accessToken: string,
    withdrawActionId: string,
    amountUsdc: number,
  ) {
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      throw new Error(
        'O resgate saiu do Rewards, mas o valor de retorno ainda não pôde ser confirmado. Não repita a operação.',
      );
    }

    await savePending({
      type: 'withdraw',
      actionId: withdrawActionId,
      requestedAmount: amountUsdc,
      nextRequestStarted: 'return',
    });
    setStatusText('Autorizando retorno ao saldo Nexa…');
    const authorization = await authorizeRewardsAction(
      accessToken,
      'return',
      { amountUsdc },
    );
    setStatusText('Devolvendo seu USDC ao saldo Nexa…');
    const returned = await returnRewardsToWallet(
      accessToken,
      amountUsdc,
      authorization,
    );
    const returnId = String(returned?.action?.id || '').trim();
    if (!returnId) {
      throw new Error('O retorno ao saldo Nexa foi solicitado, mas não recebemos o identificador da action. Não repita a operação.');
    }

    await savePending({ type: 'return', actionId: returnId, requestedAmount: amountUsdc });
    await waitForAction(accessToken, returnId);
    await savePending(null);
    await refreshPosition(accessToken);
    setStatusText('Resgate concluído no seu saldo Nexa.');
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
      await ensurePrivySession();
      if (!quote) {
        const result = await getRewardsBridgeQuote(session.accessToken, requested);
        setQuote(result);
      }

      setStatusText('Conferindo seus saldos antes de movimentar…');
      const balances = await getRewardsWalletBalances(session.accessToken);
      const polygonUsdc = Number(balances?.polygonUsdc || 0);
      const baseUsdc = Number(balances?.baseUsdc || 0);

      if (vault?.authorizationDiagnosticOnly === true) {
        setStatusText('Validando a autorização segura da sua carteira…');
        const authorization = await authorizeRewardsAction(
          session.accessToken,
          'diagnostic',
        );
        const diagnostic = await runRewardsAuthorizationDiagnostic(
          session.accessToken,
          authorization,
        );
        if (diagnostic?.authorizationVerified !== true) {
          throw new Error(
            'A autorização segura da carteira não pôde ser confirmada.',
          );
        }
        setStatusText(
          'Autorização da carteira validada. Nenhum USDC foi movimentado.',
        );
        return;
      }

      if (Number.isFinite(baseUsdc) && baseUsdc + 0.000001 >= requested) {
        await startDepositFromBase(session.accessToken, requested);
        return;
      }

      if (!Number.isFinite(polygonUsdc) || polygonUsdc + 0.000001 < requested) {
        throw new Error(
          `Saldo disponível na Polygon insuficiente para turbinar ${formatUsdc(requested)}. Nenhuma nova movimentação foi feita.`,
        );
      }

      setStatusText('Autorizando sua carteira…');
      const authorization = await authorizeRewardsAction(
        session.accessToken,
        'bridge',
        { amountUsdc: requested },
      );
      setStatusText('Preparando seu USDC para o Rewards…');
      const bridge = await bridgeRewardsToBase(
        session.accessToken,
        requested,
        authorization,
      );
      await continueBridge(session.accessToken, bridge, requested);
      await refreshPosition(session.accessToken);
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

      if (isFailed(status)) {
        if (pending.type === 'deposit') {
          await savePending(null);
          await refreshPosition(session.accessToken);
          setStatusText(
            'A tentativa anterior de depósito foi encerrada sem concluir. Você pode tentar novamente com segurança.',
          );
        }
        throw new Error(failureMessage(result));
      }
      if (!isCompleted(status)) {
        setStatusText('Sua operação ainda está sendo confirmada.');
        return;
      }

      if (pending.type === 'bridge') {
        if (pending.nextRequestStarted === 'deposit') {
          throw new Error(
            'A próxima etapa do Rewards foi solicitada, mas ficou sem confirmação. Não repita; precisamos verificar antes de continuar.',
          );
        }
        const arrived = Number(result?.action?.destinationAmount || 0);
        if (!Number.isFinite(arrived) || arrived <= 0) {
          throw new Error(
            'A transferência foi concluída, mas o valor final ainda não está disponível. Não repita; atualize novamente em instantes.',
          );
        }
        await startDepositAfterBridge(
          session.accessToken,
          pending.actionId,
          arrived,
        );
        await refreshPosition(session.accessToken);
        return;
      }

      if (pending.type === 'deposit') {
        await savePending(null);
        await refreshPosition(session.accessToken);
        setStatusText('Rewards confirmados.');
        return;
      }

      if (pending.type === 'withdraw') {
        if (pending.nextRequestStarted === 'return') {
          throw new Error(
            'O retorno ao saldo Nexa foi solicitado, mas ficou sem confirmação. Não repita; precisamos verificar a action antes de continuar.',
          );
        }
        const returnAmount = safeReturnAmount(result, pending.requestedAmount);
        await startReturnToWallet(
          session.accessToken,
          pending.actionId,
          returnAmount,
        );
        return;
      }

      if (pending.type === 'return') {
        await savePending(null);
        await refreshPosition(session.accessToken);
        setStatusText('Resgate concluído no seu saldo Nexa.');
      }
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
    if (!Number.isFinite(assetsInVault) || assetsInVault <= 0) {
      setError('Você não possui USDC turbinado para resgatar.');
      return;
    }

    setWorking(true);
    setError('');
    try {
      const session = await sessionOrThrow();
      setStatusText('Autorizando resgate na sua carteira…');
      const authorization = await authorizeRewardsAction(
        session.accessToken,
        'withdraw',
        { full: true },
      );
      setStatusText('Resgatando seus Rewards…');
      const result = await withdrawRewardsFull(
        session.accessToken,
        authorization,
      );
      const actionId = String(result?.action?.id || '').trim();
      if (!actionId) throw new Error('O Rewards não retornou o identificador do resgate.');

      await savePending({
        type: 'withdraw',
        actionId,
        requestedAmount: assetsInVault,
      });
      const finalWithdraw = await waitForAction(session.accessToken, actionId);
      const returnAmount = safeReturnAmount(finalWithdraw, assetsInVault);
      await startReturnToWallet(
        session.accessToken,
        actionId,
        returnAmount,
      );
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
        <ActionButton
          label="Ver estimativa"
          variant="secondary"
          onPress={seeQuote}
          loading={working}
        />
        <ActionButton
          label={premium ? 'Ativar Super Turbinado' : 'Turbinar USDC'}
          onPress={turbocharge}
          loading={working}
          disabled={Boolean(pending) || vault?.liveActionsEnabled !== true}
        />
        {vault?.liveActionsEnabled !== true ? (
          <Text style={styles.pilot}>
            Homologação final em andamento. Nenhum valor será movimentado até a liberação do piloto.
          </Text>
        ) : null}
      </Card>

      {pending ? (
        <Card>
          <Badge tone="warning">OPERAÇÃO EM ANDAMENTO</Badge>
          <Text style={styles.muted}>
            Não inicie outra operação enquanto esta estiver sendo confirmada.
          </Text>
          <ActionButton
            label="Atualizar status"
            variant="secondary"
            onPress={resumePending}
            loading={working}
          />
        </Card>
      ) : null}

      {assetsInVault > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Seu Rewards está ativo</Text>
          <Text style={styles.muted}>
            Você pode resgatar seu saldo quando quiser, sujeito à liquidez da estratégia.
          </Text>
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
  balance: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  reward: {
    color: colors.cyan,
    fontWeight: '900',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  pilot: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
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
  disclaimer: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: spacing.xl,
  },
});