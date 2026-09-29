import { useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { loadNexaSession } from '@/lib/session';
import {
  normalizeWalletAddress,
  sendPreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import {
  approveWalletFirstExitPix,
  createWalletFirstExitIntent,
  createWalletFirstExitPix,
  getWalletFirstExitQuote,
  prepareWalletFirstExitTransfer,
  reconcileWalletFirstExitPix,
  reconcileWalletFirstExitProvider,
  reconcileWalletFirstExitSell,
  submitWalletFirstExitSell,
  verifyWalletFirstExitTransfer,
  type WalletFirstExitQuote,
} from '@/lib/walletFirstExit';
import { colors, radius, spacing } from '@/theme';

type ExitPhase =
  | 'idle'
  | 'quoted'
  | 'ready_to_sign'
  | 'onchain'
  | 'provider'
  | 'sell'
  | 'pix'
  | 'completed';

function parseUsdc(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMoreThanSixDecimals(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const decimal = normalized.split('.')[1] || '';
  return decimal.length > 6;
}

function formatBrl(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatRate(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} USDC`;
}

function sellStatus(result: any) {
  return String(
    result?.execution?.status ||
      result?.order?.metadata?.walletFirstExitSell?.status ||
      '',
  ).toLowerCase();
}

function payoutStatus(result: any) {
  return String(
    result?.payout?.status ||
      result?.order?.metadata?.walletFirstPixPayout?.status ||
      '',
  ).toLowerCase();
}

function requiresManualReview(result: any) {
  return Boolean(
    result?.requiresManualReview === true ||
      result?.manualReviewRequired === true ||
      result?.providerSubmissionUncertain === true ||
      result?.providerCreationUncertain === true,
  );
}

export default function CashOutScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const [amountUsdc, setAmountUsdc] = useState('');
  const [quote, setQuote] = useState<WalletFirstExitQuote | null>(null);
  const [intent, setIntent] = useState<any>(null);
  const [prepared, setPrepared] = useState<any>(null);
  const [txHash, setTxHash] = useState('');
  const [phase, setPhase] = useState<ExitPhase>('idle');
  const [statusText, setStatusText] = useState('');
  const [finalResult, setFinalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function resetExecution() {
    setIntent(null);
    setPrepared(null);
    setTxHash('');
    setFinalResult(null);
    setStatusText('');
    setPhase('idle');
  }

  async function providerFor(address: string) {
    const expected = normalizeWalletAddress(address);
    const wallet = wallets.find(
      (candidate) => normalizeWalletAddress(candidate?.address) === expected,
    );
    if (!wallet) {
      throw new Error(
        'A carteira vinculada à Nexa não está disponível neste dispositivo.',
      );
    }
    if (typeof wallet.getProvider === 'function') return wallet.getProvider();
    if (typeof wallet.getEthereumProvider === 'function') {
      return wallet.getEthereumProvider();
    }
    throw new Error(
      'A carteira deste dispositivo não expôs o provedor de assinatura.',
    );
  }

  async function sessionToken() {
    const session = await loadNexaSession();
    if (!session) throw new Error('Sua sessão Nexa expirou.');
    return session.accessToken;
  }

  async function requestQuote() {
    setError('');
    setQuote(null);
    resetExecution();
    const amount = parseUsdc(amountUsdc);
    if (!(amount > 0)) {
      setError('Informe uma quantidade de USDC maior que zero.');
      return;
    }
    if (hasMoreThanSixDecimals(amountUsdc)) {
      setError('USDC permite no máximo 6 casas decimais nesta operação.');
      return;
    }

    setLoading(true);
    try {
      const accessToken = await sessionToken();
      const nextQuote = await getWalletFirstExitQuote(accessToken, amount);
      setQuote(nextQuote);
      setPhase('quoted');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cotação Nexa indisponível no momento.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function prepareExit() {
    if (!quote) return;
    setError('');
    setLoading(true);
    try {
      const accessToken = await sessionToken();
      let currentIntent = intent;
      if (!currentIntent?.order?.id) {
        const clientRequestId = `wf-exit-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
        currentIntent = await createWalletFirstExitIntent(
          accessToken,
          parseUsdc(amountUsdc),
          clientRequestId,
        );
        if (!currentIntent?.order?.id) {
          throw new Error('A Nexa não criou um intent de saque válido.');
        }
        setIntent(currentIntent);
      }

      setStatusText('Validando saída completa e destino Pix…');
      const nextPrepared = await prepareWalletFirstExitTransfer(
        accessToken,
        currentIntent.order.id,
      );
      if (!nextPrepared?.transaction?.from || !nextPrepared?.transaction?.data) {
        throw new Error('A Nexa não retornou uma transação de saída válida.');
      }
      setPrepared(nextPrepared);
      setPhase('ready_to_sign');
      setStatusText('Tudo pronto. Falta apenas sua assinatura na carteira.');
    } catch (caught) {
      setStatusText('');
      setError(
        caught instanceof Error
          ? caught.message
          : 'O saque ainda não está disponível.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function advanceExit(orderId: string, hash: string) {
    const accessToken = await sessionToken();

    setPhase('onchain');
    setStatusText('Confirmando sua transferência na Polygon…');
    const onchain = await verifyWalletFirstExitTransfer(
      accessToken,
      orderId,
      hash,
    );
    if (requiresManualReview(onchain)) {
      throw new Error('A confirmação on-chain requer revisão manual da Nexa.');
    }
    if (onchain?.verified !== true) {
      setStatusText(
        'A Polygon ainda está confirmando a transferência. Toque em continuar para verificar novamente.',
      );
      return;
    }

    setPhase('provider');
    setStatusText('Confirmando o crédito de USDC para liquidação…');
    const provider = await reconcileWalletFirstExitProvider(
      accessToken,
      orderId,
    );
    if (requiresManualReview(provider)) {
      throw new Error('O crédito de USDC requer revisão manual da Nexa.');
    }
    const providerCredited =
      provider?.providerDepositCredited === true || provider?.credited === true;
    if (!providerCredited) {
      setStatusText(
        'USDC confirmado na rede. Aguardando o provedor reconhecer o crédito.',
      );
      return;
    }

    setPhase('sell');
    setStatusText('Convertendo USDC para reais…');
    let sell = await submitWalletFirstExitSell(accessToken, orderId);
    if (requiresManualReview(sell)) {
      throw new Error('A conversão USDC/BRL requer revisão manual da Nexa.');
    }
    if (sellStatus(sell) !== 'sell_filled') {
      sell = await reconcileWalletFirstExitSell(accessToken, orderId);
      if (requiresManualReview(sell)) {
        throw new Error('A conversão USDC/BRL requer revisão manual da Nexa.');
      }
    }
    if (sellStatus(sell) !== 'sell_filled') {
      setStatusText(
        'Conversão enviada. Aguardando confirmação do provedor de liquidação.',
      );
      return;
    }

    setPhase('pix');
    setStatusText('Preparando seu Pix…');
    let pix = await createWalletFirstExitPix(accessToken, orderId);
    if (requiresManualReview(pix)) {
      throw new Error('A criação do Pix requer revisão manual da Nexa.');
    }

    let currentPayoutStatus = payoutStatus(pix);
    if (currentPayoutStatus === 'request_created') {
      setStatusText('Enviando Pix para sua chave verificada…');
      pix = await approveWalletFirstExitPix(accessToken, orderId);
      if (requiresManualReview(pix)) {
        throw new Error('O envio do Pix requer revisão manual da Nexa.');
      }
      currentPayoutStatus = payoutStatus(pix);
    }

    if (currentPayoutStatus !== 'completed') {
      setStatusText('Confirmando o Pix…');
      pix = await reconcileWalletFirstExitPix(accessToken, orderId);
      if (requiresManualReview(pix)) {
        throw new Error('A confirmação do Pix requer revisão manual da Nexa.');
      }
      currentPayoutStatus = payoutStatus(pix);
    }

    if (currentPayoutStatus === 'completed') {
      setFinalResult(pix);
      setPhase('completed');
      setStatusText('Pix concluído.');
      return;
    }

    setStatusText(
      'Pix enviado ao provedor. Toque em continuar para confirmar a conclusão.',
    );
  }

  async function signAndWithdraw() {
    if (!prepared?.transaction || !intent?.order?.id) return;
    setError('');
    setLoading(true);
    try {
      const provider = await providerFor(prepared.transaction.from);
      const hash = await sendPreparedWalletTransaction(
        provider,
        prepared.transaction,
      );
      setTxHash(hash);
      await advanceExit(intent.order.id, hash);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir o saque.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueProcessing() {
    if (!intent?.order?.id || !txHash) return;
    setError('');
    setLoading(true);
    try {
      await advanceExit(intent.order.id, txHash);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível atualizar o saque.',
      );
    } finally {
      setLoading(false);
    }
  }

  const completedAmountBrl =
    finalResult?.payout?.amountBrl ||
    finalResult?.order?.netBrl ||
    quote?.estimatedPayoutBrl ||
    0;

  return (
    <Screen>
      <Brand />
      <Eyebrow>USDC → PIX</Eyebrow>
      <Title>Sacar para Pix.</Title>
      <Paragraph>
        Você autoriza a saída na sua própria carteira. A Nexa confirma a Polygon,
        liquida USDC em reais e só conclui quando o Pix real estiver confirmado.
      </Paragraph>

      <Card>
        <Badge>USDC · POLYGON</Badge>
        <View style={styles.spacer} />
        <Field
          label="Quanto USDC?"
          value={amountUsdc}
          onChangeText={(value) => {
            setAmountUsdc(value);
            setQuote(null);
            setError('');
            resetExecution();
          }}
          keyboardType="decimal-pad"
          placeholder="Ex.: 1,00"
        />
        <ActionButton
          label={quote ? 'Atualizar cotação' : 'Ver cotação'}
          onPress={requestQuote}
          loading={loading && phase === 'idle'}
          disabled={phase !== 'idle' && phase !== 'quoted'}
        />
      </Card>

      {quote ? (
        <Card style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>{quote.label || 'Cotação Nexa'}</Text>
          <Text style={styles.rate}>
            1 USDC = R$ {formatRate(quote.nexaRateBrl)}
          </Text>
          <Text style={styles.receiveLabel}>Você recebe aproximadamente</Text>
          <Text style={styles.receiveValue}>
            {formatBrl(quote.estimatedPayoutBrl)}
          </Text>
          <Text style={styles.validity}>
            Cotação indicativa válida por {quote.validForSeconds || 30}s. A
            liquidação final usa a execução real e as proteções do fluxo.
          </Text>
          {phase === 'quoted' ? (
            <ActionButton
              label="Continuar saque"
              onPress={prepareExit}
              loading={loading}
            />
          ) : null}
        </Card>
      ) : null}

      {prepared && phase === 'ready_to_sign' ? (
        <Card>
          <Badge tone="warning">SUA ASSINATURA É NECESSÁRIA</Badge>
          <Text style={styles.stepTitle}>Revise antes de enviar</Text>
          <Text style={styles.stepText}>
            Saída: {formatUsdc(prepared.amountUsdc)}
          </Text>
          <Text style={styles.stepText}>Rede: Polygon</Text>
          <Text style={styles.stepText}>
            Pix próprio verificado: {prepared?.beneficiary?.pixKeyType || 'sim'}
          </Text>
          <Text style={styles.stepText}>
            A Nexa não possui sua chave privada e não consegue assinar esta saída por você.
          </Text>
          <ActionButton
            label="Confirmar e assinar saque"
            onPress={signAndWithdraw}
            loading={loading}
          />
        </Card>
      ) : null}

      {txHash && phase !== 'completed' ? (
        <Card>
          <Badge tone="info">SAQUE EM ANDAMENTO</Badge>
          <Text style={styles.stepTitle}>{statusText || 'Processando…'}</Text>
          <Text selectable style={styles.hash}>{txHash}</Text>
          <ActionButton
            label="Continuar processamento"
            variant="secondary"
            onPress={continueProcessing}
            loading={loading}
          />
        </Card>
      ) : null}

      {phase === 'completed' ? (
        <Card style={styles.completedCard}>
          <Badge tone="success">PIX CONCLUÍDO</Badge>
          <Text style={styles.completedAmount}>{formatBrl(completedAmountBrl)}</Text>
          <Text style={styles.successText}>
            A saída foi confirmada na Polygon, liquidada e o Pix foi concluído pelo provedor.
          </Text>
          {txHash ? <Text selectable style={styles.hash}>{txHash}</Text> : null}
        </Card>
      ) : null}

      {!txHash && statusText ? (
        <Text style={styles.status}>{statusText}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label="Voltar"
        variant="secondary"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: { height: spacing.md },
  quoteCard: { backgroundColor: '#11143C' },
  completedCard: { backgroundColor: '#0E2930' },
  quoteLabel: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  rate: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  receiveLabel: {
    color: colors.muted,
    marginTop: spacing.lg,
    fontSize: 13,
  },
  receiveValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  validity: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginVertical: spacing.md,
  },
  stepTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 17,
    marginTop: spacing.md,
  },
  stepText: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  hash: {
    color: colors.cyan,
    fontSize: 11,
    lineHeight: 17,
    marginVertical: spacing.md,
  },
  status: {
    color: colors.muted,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  completedAmount: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    marginTop: spacing.lg,
  },
  successText: {
    color: colors.success,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
});
