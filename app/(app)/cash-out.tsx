import {
  alchemyWalletTransport,
  createSmartWalletClient,
} from '@alchemy/wallet-apis';
import { useEffect, useState } from 'react';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  createWalletClient,
  custom,
  parseSignature,
  type AuthorizationRequest,
  type Hex,
} from 'viem';
import { toAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { hashAuthorization } from 'viem/utils';

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
  type PreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import {
  approveWalletFirstExitPix,
  createWalletFirstExitIntent,
  createWalletFirstExitPix,
  getWalletFirstActiveExit,
  getWalletFirstExitQuote,
  getWalletFirstExitSwapSponsorshipCredentials,
  getWalletFirstExitTransferSponsorshipCredentials,
  prepareWalletFirstExitTransfer,
  prepareWalletFirstExitUsdtSwap,
  confirmWalletFirstExitUsdtSwap,
  reconcileWalletFirstExitPix,
  reconcileWalletFirstExitProvider,
  reconcileWalletFirstExitSell,
  submitWalletFirstExitSell,
  verifyWalletFirstExitTransfer,
  type WalletFirstExitQuote,
  type WalletFirstExitSponsorshipCredentials,
} from '@/lib/walletFirstExit';
import { colors, radius, spacing } from '@/theme';

type ExitPhase =
  | 'idle'
  | 'quoted'
  | 'swap_ready_to_sign'
  | 'swap_confirming'
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

type SponsoredCall = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
};

function toSponsoredCall(
  transaction: PreparedWalletTransaction,
): SponsoredCall {
  return {
    to: transaction.to as `0x${string}`,
    data: transaction.data as `0x${string}`,
    value: BigInt(String(transaction.value || '0x0')),
  };
}

function isPolygonChainId(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized === '0x89' ||
    normalized === '137' ||
    normalized === 'eip155:137'
  );
}

async function buildPrivySigner(wallet: any) {
  const provider =
    (typeof wallet?.getProvider === 'function'
      ? await wallet.getProvider()
      : typeof wallet?.getEthereumProvider === 'function'
        ? await wallet.getEthereumProvider()
        : null);
  if (!provider) {
    throw new Error('A carteira Privy não disponibilizou o assinador Ethereum.');
  }

  let currentChainId = await provider.request({
    method: 'eth_chainId',
    params: [],
  });
  if (!isPolygonChainId(currentChainId)) {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }],
    });
    currentChainId = await provider.request({
      method: 'eth_chainId',
      params: [],
    });
  }
  if (!isPolygonChainId(currentChainId)) {
    throw new Error('Não foi possível preparar sua carteira na Polygon.');
  }

  const address = String(wallet.address || '') as `0x${string}`;
  const rpcWallet = createWalletClient({
    account: address,
    chain: polygon,
    transport: custom(provider),
  });

  return toAccount({
    address,
    signAuthorization: async (request: AuthorizationRequest) => {
      const implementationAddress =
        'address' in request ? request.address : request.contractAddress;
      if (!implementationAddress) {
        throw new Error(
          'A autorização EIP-7702 não informou o contrato de delegação.',
        );
      }
      const authorization = {
        chainId: Number(request.chainId),
        address: implementationAddress,
        nonce: Number(request.nonce),
      };
      const signature = (await provider.request({
        method: 'secp256k1_sign',
        params: [hashAuthorization(authorization)],
      })) as Hex;
      return {
        ...authorization,
        ...parseSignature(signature),
      };
    },
    signMessage: async ({ message }) =>
      (await rpcWallet.signMessage({ message })) as Hex,
    signTypedData: async (parameters) =>
      (await rpcWallet.signTypedData(parameters as any)) as Hex,
    signTransaction: async (transaction) =>
      (await rpcWallet.signTransaction(transaction as any)) as Hex,
  });
}

async function sponsoredClient(
  wallet: any,
  credentials: WalletFirstExitSponsorshipCredentials,
) {
  const signer = await buildPrivySigner(wallet);
  return createSmartWalletClient({
    signer,
    chain: polygon,
    transport: alchemyWalletTransport({ jwt: credentials.jwt }),
    paymaster: { policyId: credentials.policyId },
  });
}

async function waitSponsoredCall(
  wallet: any,
  credentials: WalletFirstExitSponsorshipCredentials,
  callId: string,
) {
  const client = await sponsoredClient(wallet, credentials);
  const status = await client.waitForCallsStatus({
    id: callId as any,
    timeout: 120_000,
  });
  if (status.status !== 'success') {
    throw new Error(
      'A operação patrocinada ainda não foi confirmada. Não repita a operação.',
    );
  }
  const receipt = status.receipts?.[status.receipts.length - 1];
  const hash = String(receipt?.transactionHash || '').trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error(
      'A operação patrocinada foi enviada, mas o hash ainda não ficou disponível. Não repita.',
    );
  }
  return hash;
}

export default function CashOutScreen() {
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const [amountUsdc, setAmountUsdc] = useState('');
  const [quote, setQuote] = useState<WalletFirstExitQuote | null>(null);
  const [intent, setIntent] = useState<any>(null);
  const [swapPrepared, setSwapPrepared] = useState<any>(null);
  const [swapSponsorship, setSwapSponsorship] =
    useState<WalletFirstExitSponsorshipCredentials | null>(null);
  const [swapCallId, setSwapCallId] = useState('');
  const [swapTxHash, setSwapTxHash] = useState('');
  const [prepared, setPrepared] = useState<any>(null);
  const [transferSponsorship, setTransferSponsorship] =
    useState<WalletFirstExitSponsorshipCredentials | null>(null);
  const [transferCallId, setTransferCallId] = useState('');
  const [txHash, setTxHash] = useState('');
  const [phase, setPhase] = useState<ExitPhase>('idle');
  const [statusText, setStatusText] = useState('');
  const [finalResult, setFinalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resumedActive, setResumedActive] = useState(false);

  function resetExecution() {
    setIntent(null);
    setSwapPrepared(null);
    setSwapSponsorship(null);
    setSwapCallId('');
    setSwapTxHash('');
    setPrepared(null);
    setTransferSponsorship(null);
    setTransferCallId('');
    setTxHash('');
    setFinalResult(null);
    setStatusText('');
    setPhase('idle');
    setResumedActive(false);
  }

  async function ensurePrivyWalletSession() {
    let token = '';
    try {
      if (typeof privy?.getAccessToken === 'function') {
        token = String((await privy.getAccessToken()) || '').trim();
      }
    } catch {
      token = '';
    }

    if (token.length >= 40 && token.split('.').length === 3) return;

    router.push({
      pathname: '/wallet-session',
      params: { returnTo: 'cash-out' },
    } as any);
    throw new Error(
      'Confirme sua carteira neste aparelho e depois gere uma nova cotação. Nenhum valor foi movimentado.',
    );
  }

  async function walletFor(address: string) {
    await ensurePrivyWalletSession();
    const expected = normalizeWalletAddress(address);
    const wallet = wallets.find(
      (candidate) => normalizeWalletAddress(candidate?.address) === expected,
    );
    if (!wallet) {
      router.push({
        pathname: '/wallet-session',
        params: { returnTo: 'cash-out' },
      } as any);
      throw new Error(
        'A sessão da carteira precisa ser restaurada neste aparelho. Nenhum valor foi movimentado.',
      );
    }
    return wallet;
  }

  async function sessionToken() {
    const session = await loadNexaSession();
    if (!session) throw new Error('Sua sessão Nexa expirou.');
    return session.accessToken;
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const accessToken = await sessionToken();
        const active = await getWalletFirstActiveExit(accessToken);
        const order = active?.order || null;
        const hash = String(order?.transactionHash || '').trim();
        if (
          cancelled ||
          active?.active !== true ||
          !order?.id ||
          !/^0x[a-fA-F0-9]{64}$/.test(hash)
        ) {
          return;
        }

        setResumedActive(true);
        setIntent({ order });
        setAmountUsdc(
          Number(order?.amountUsdc || 0)
            .toFixed(6)
            .replace(/0+$/, '')
            .replace(/\.$/, ''),
        );
        setTxHash(hash);

        const payout = String(
          order?.metadata?.walletFirstPixPayout?.status || '',
        ).toLowerCase();
        const sell = String(
          order?.metadata?.walletFirstExitSell?.status || '',
        ).toLowerCase();

        if (payout === 'completed' || String(order?.status) === 'COMPLETED') {
          setFinalResult({ order, payout: order?.metadata?.walletFirstPixPayout });
          setPhase('completed');
          setStatusText('Pix concluído.');
          return;
        }

        setPhase(sell ? 'sell' : 'onchain');
        setStatusText(
          'Saque anterior encontrado. Retome daqui; a Nexa não criará outra saída nem repetirá a transferência.',
        );
      } catch {
        // No active exit is a normal state; keep the fresh quote flow available.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function requestQuote() {
    if (resumedActive) {
      setError(
        'Já existe um saque em andamento. Use Continuar processamento para retomar exatamente do ponto salvo.',
      );
      return;
    }
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

      setStatusText('Preparando conversão USDC → USDT na Polygon…');
      const nextSwap = await prepareWalletFirstExitUsdtSwap(
        accessToken,
        currentIntent.order.id,
      );
      if (
        !nextSwap?.intentToken ||
        !nextSwap?.swapTransaction?.from ||
        !nextSwap?.swapTransaction?.data
      ) {
        throw new Error(
          'A Nexa não retornou uma conversão USDC → USDT válida.',
        );
      }

      const sponsorship =
        await getWalletFirstExitSwapSponsorshipCredentials(
          accessToken,
          currentIntent.order.id,
          nextSwap.intentToken,
        );
      if (
        sponsorship?.chainId !== 137 ||
        !sponsorship?.jwt ||
        !sponsorship?.policyId ||
        normalizeWalletAddress(sponsorship.wallet) !==
          normalizeWalletAddress(nextSwap.swapTransaction.from)
      ) {
        throw new Error(
          'O patrocínio de gas não corresponde à carteira deste saque.',
        );
      }

      setSwapPrepared(nextSwap);
      setSwapSponsorship(sponsorship);
      setPhase('swap_ready_to_sign');
      setStatusText(
        'Primeiro, autorize a conversão USDC → USDT na sua carteira. A Nexa patrocina o gas desta etapa.',
      );
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

  async function finalizeSwapAndPrepareTransfer(
    accessToken: string,
    orderId: string,
    currentSwap: any,
    hash: string,
  ) {
    const confirmed = await confirmWalletFirstExitUsdtSwap(
      accessToken,
      orderId,
      currentSwap.intentToken,
      hash,
      'client_sponsored_eip7702',
    );
    if (confirmed?.completed !== true) {
      setPhase('swap_confirming');
      setStatusText(
        'Conversão USDC → USDT enviada. Aguardando confirmações da Polygon.',
      );
      return;
    }

    setStatusText('Conversão confirmada. Validando destino de liquidação e Pix…');
    const nextPrepared = await prepareWalletFirstExitTransfer(
      accessToken,
      orderId,
    );
    if (!nextPrepared?.transaction?.from || !nextPrepared?.transaction?.data) {
      throw new Error(
        'A Nexa não retornou uma transferência USDT de saída válida.',
      );
    }

    const sponsorship =
      await getWalletFirstExitTransferSponsorshipCredentials(
        accessToken,
        orderId,
      );
    if (
      sponsorship?.chainId !== 137 ||
      !sponsorship?.jwt ||
      !sponsorship?.policyId ||
      normalizeWalletAddress(sponsorship.wallet) !==
        normalizeWalletAddress(nextPrepared.transaction.from)
    ) {
      throw new Error(
        'O patrocínio de gas da transferência não corresponde à carteira deste saque.',
      );
    }

    setPrepared(nextPrepared);
    setTransferSponsorship(sponsorship);
    setPhase('ready_to_sign');
    setStatusText(
      'USDT pronto para liquidação. Falta sua assinatura para continuar; o gas também será patrocinado pela Nexa.',
    );
  }

  async function signSwap() {
    if (
      !swapPrepared ||
      !swapSponsorship ||
      !intent?.order?.id
    ) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      const accessToken = await sessionToken();
      const wallet = await walletFor(swapSponsorship.wallet);
      const client = await sponsoredClient(wallet, swapSponsorship);
      const calls: SponsoredCall[] = [];

      if (
        swapPrepared.approvalRequired === true &&
        swapPrepared.approvalTransaction
      ) {
        calls.push(toSponsoredCall(swapPrepared.approvalTransaction));
      }
      calls.push(toSponsoredCall(swapPrepared.swapTransaction));

      setStatusText(
        'Autorizando e convertendo USDC → USDT com gas patrocinado pela Nexa…',
      );
      const result = await client.sendCalls({ calls });
      const callId = String(result?.id || '').trim();
      if (!callId) {
        throw new Error(
          'A carteira não retornou o identificador da operação patrocinada.',
        );
      }
      setSwapCallId(callId);
      setPhase('swap_confirming');
      setStatusText(
        'Operação patrocinada enviada. Aguardando confirmação da Polygon; não repita.',
      );

      const hash = await waitSponsoredCall(
        wallet,
        swapSponsorship,
        callId,
      );
      setSwapTxHash(hash);
      await finalizeSwapAndPrepareTransfer(
        accessToken,
        intent.order.id,
        swapPrepared,
        hash,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir a conversão USDC → USDT.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueSwap() {
    if (
      !swapPrepared ||
      !swapSponsorship ||
      !intent?.order?.id ||
      (!swapCallId && !swapTxHash)
    ) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      const accessToken = await sessionToken();
      let hash = swapTxHash;
      if (!hash) {
        const wallet = await walletFor(swapSponsorship.wallet);
        hash = await waitSponsoredCall(
          wallet,
          swapSponsorship,
          swapCallId,
        );
        setSwapTxHash(hash);
      }
      await finalizeSwapAndPrepareTransfer(
        accessToken,
        intent.order.id,
        swapPrepared,
        hash,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível atualizar a conversão USDC → USDT.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function advanceExit(orderId: string, hash: string) {
    const accessToken = await sessionToken();

    setPhase('onchain');
    setStatusText('Confirmando sua transferência USDT na Polygon…');
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
    setStatusText('Confirmando o crédito de USDT para liquidação…');
    const provider = await reconcileWalletFirstExitProvider(
      accessToken,
      orderId,
    );
    if (requiresManualReview(provider)) {
      throw new Error('O crédito de USDT requer revisão manual da Nexa.');
    }
    const providerCredited =
      provider?.providerDepositCredited === true || provider?.credited === true;
    if (!providerCredited) {
      setStatusText(
        'USDT confirmado na rede. Aguardando o provedor reconhecer o crédito.',
      );
      return;
    }

    setPhase('sell');
    setStatusText('Convertendo USDT para reais…');
    let sell = await submitWalletFirstExitSell(accessToken, orderId);
    if (requiresManualReview(sell)) {
      throw new Error('A conversão para reais requer revisão manual da Nexa.');
    }
    if (sellStatus(sell) !== 'sell_filled') {
      sell = await reconcileWalletFirstExitSell(accessToken, orderId);
      if (requiresManualReview(sell)) {
        throw new Error('A conversão para reais requer revisão manual da Nexa.');
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
    if (
      !prepared?.transaction ||
      !transferSponsorship ||
      !intent?.order?.id
    ) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      const wallet = await walletFor(transferSponsorship.wallet);
      const client = await sponsoredClient(wallet, transferSponsorship);
      setStatusText(
        'Enviando USDT para liquidação com gas patrocinado pela Nexa…',
      );
      const result = await client.sendCalls({
        calls: [toSponsoredCall(prepared.transaction)],
      });
      const callId = String(result?.id || '').trim();
      if (!callId) {
        throw new Error(
          'A carteira não retornou o identificador da transferência patrocinada.',
        );
      }
      setTransferCallId(callId);
      setPhase('onchain');
      setStatusText(
        'Transferência patrocinada enviada. Aguardando confirmação; não repita.',
      );
      const hash = await waitSponsoredCall(
        wallet,
        transferSponsorship,
        callId,
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
    if (
      !intent?.order?.id ||
      (!txHash && (!transferCallId || !transferSponsorship))
    ) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      let hash = txHash;
      if (!hash) {
        const wallet = await walletFor(transferSponsorship!.wallet);
        hash = await waitSponsoredCall(
          wallet,
          transferSponsorship!,
          transferCallId,
        );
        setTxHash(hash);
      }
      await advanceExit(intent.order.id, hash);
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
        converte para USDT, liquida em reais e só conclui quando o Pix real estiver confirmado.
      </Paragraph>

      <Card>
        <Badge>USDC · POLYGON</Badge>
        <View style={styles.spacer} />
        <Field
          label="Quanto USDC?"
          value={amountUsdc}
          onChangeText={(value) => {
            if (resumedActive) return;
            setAmountUsdc(value);
            setQuote(null);
            setError('');
            resetExecution();
          }}
          editable={!resumedActive}
          keyboardType="decimal-pad"
          placeholder="Ex.: 1,00"
        />
        <ActionButton
          label={quote ? 'Atualizar cotação' : 'Ver cotação'}
          onPress={requestQuote}
          loading={loading && phase === 'idle'}
          disabled={
            resumedActive || (phase !== 'idle' && phase !== 'quoted')
          }
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

      {swapPrepared && phase === 'swap_ready_to_sign' ? (
        <Card>
          <Badge tone="warning">CONVERSÃO NA SUA CARTEIRA</Badge>
          <Text style={styles.stepTitle}>USDC → USDT na Polygon</Text>
          <Text style={styles.stepText}>
            A liquidação usa USDT na Polygon. A conversão acontece primeiro na sua própria carteira.
          </Text>
          <Text style={styles.stepText}>
            Estimado: {Number(swapPrepared.estimatedAmountUsdt || 0).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} USDT
          </Text>
          <Text style={styles.stepText}>
            A Nexa não possui sua chave privada. Se houver aprovação 0x, ela é limitada ao valor deste saque e o gas da Polygon é patrocinado pela Nexa.
          </Text>
          <ActionButton
            label="Autorizar conversão USDC → USDT"
            onPress={signSwap}
            loading={loading}
          />
        </Card>
      ) : null}

      {swapPrepared && (swapTxHash || swapCallId) && phase === 'swap_confirming' ? (
        <Card>
          <Badge tone="info">CONVERSÃO EM ANDAMENTO</Badge>
          <Text style={styles.stepTitle}>{statusText || 'Confirmando na Polygon…'}</Text>
          <Text selectable style={styles.hash}>
            {swapTxHash || `Operação patrocinada: ${swapCallId}`}
          </Text>
          <ActionButton
            label="Continuar confirmação"
            variant="secondary"
            onPress={continueSwap}
            loading={loading}
          />
        </Card>
      ) : null}

      {prepared && phase === 'ready_to_sign' ? (
        <Card>
          <Badge tone="warning">SUA ASSINATURA É NECESSÁRIA</Badge>
          <Text style={styles.stepTitle}>Revise antes de enviar</Text>
          <Text style={styles.stepText}>
            Liquidação: {Number(prepared.amountUsdt || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT
          </Text>
          <Text style={styles.stepText}>Rede: Polygon</Text>
          <Text style={styles.stepText}>
            Pix próprio verificado: {prepared?.beneficiary?.pixKeyType || 'sim'}
          </Text>
          <Text style={styles.stepText}>
            A Nexa não possui sua chave privada e não consegue assinar esta saída por você. O gas da Polygon é patrocinado pela Nexa.
          </Text>
          <ActionButton
            label="Enviar USDT para liquidação"
            onPress={signAndWithdraw}
            loading={loading}
          />
        </Card>
      ) : null}

      {(txHash || transferCallId) && phase !== 'completed' ? (
        <Card>
          <Badge tone="info">SAQUE EM ANDAMENTO</Badge>
          <Text style={styles.stepTitle}>{statusText || 'Processando…'}</Text>
          <Text selectable style={styles.hash}>
            {txHash || `Operação patrocinada: ${transferCallId}`}
          </Text>
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
