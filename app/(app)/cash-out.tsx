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
  createWalletFirstExitIntent,
  getWalletFirstActiveExit,
  getWalletFirstExitQuote,
  getWalletFirstExitSwapSponsorshipCredentials,
  getWalletFirstExitTransferSponsorshipCredentials,
  prepareWalletFirstExitTransfer,
  prepareWalletFirstExitUsdtSwap,
  confirmWalletFirstExitUsdtSwap,
  reconcileWalletFirstExitPix,
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
  | 'requested'
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
    throw new Error('Sua carteira não está pronta para autorizar esta operação.');
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
    throw new Error('Não foi possível preparar sua carteira para esta operação.');
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

        const payoutState = await reconcileWalletFirstExitPix(
          accessToken,
          order.id,
        ).catch(() => null);
        const paid =
          payoutState?.confirmed === true ||
          String(payoutState?.batch?.status || '').toLowerCase() === 'paid';

        if (paid) {
          setFinalResult(payoutState);
          setPhase('completed');
          setStatusText('Pix enviado.');
          return;
        }

        setFinalResult(payoutState);
        setPhase('requested');
        setStatusText(
          payoutState?.customerStatus ||
            'Resgate solicitado. Pagamento em até 1 dia útil.',
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
          throw new Error('A Nexa não criou uma solicitação de resgate válida.');
        }
        setIntent(currentIntent);
      }

      setStatusText('Preparando a primeira autorização do resgate…');
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
          'A Nexa não conseguiu preparar a primeira autorização do resgate.',
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
          'Não foi possível preparar as taxas desta operação para sua carteira.',
        );
      }

      setSwapPrepared(nextSwap);
      setSwapSponsorship(sponsorship);
      setPhase('swap_ready_to_sign');
      setStatusText(
        'Primeiro, autorize a preparação do resgate na sua carteira. A Nexa cuida das taxas desta etapa.',
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
        'Autorização enviada. Aguardando confirmação da rede.',
      );
      return;
    }

    setStatusText('Autorização confirmada. Preparando a confirmação final…');
    const nextPrepared = await prepareWalletFirstExitTransfer(
      accessToken,
      orderId,
    );
    if (!nextPrepared?.transaction?.from || !nextPrepared?.transaction?.data) {
      throw new Error(
        'A Nexa não conseguiu preparar a confirmação final do resgate.',
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
        'Não foi possível preparar as taxas da confirmação final para sua carteira.',
      );
    }

    setPrepared(nextPrepared);
    setTransferSponsorship(sponsorship);
    setPhase('ready_to_sign');
    setStatusText(
      'Tudo pronto. Falta sua confirmação final; a Nexa cuida das taxas da operação.',
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

      setStatusText('Confirmando sua primeira autorização…');
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
        'Autorização enviada. Aguarde a confirmação e não repita a operação.',
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
          : 'Não foi possível concluir a primeira autorização do resgate.',
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
          : 'Não foi possível atualizar a primeira autorização do resgate.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function advanceExit(orderId: string, hash: string) {
    const accessToken = await sessionToken();

    setStatusText('Registrando sua confirmação…');
    const onchain = await verifyWalletFirstExitTransfer(
      accessToken,
      orderId,
      hash,
    );
    if (requiresManualReview(onchain)) {
      throw new Error(
        'Sua solicitação precisa de uma conferência da Nexa antes de continuar.',
      );
    }

    setFinalResult(onchain);
    setPhase('requested');
    setStatusText(
      'Resgate solicitado. Você pode fechar a Nexa; o processamento continuará automaticamente. Pagamento em até 1 dia útil.',
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
      setStatusText('Confirmando seu resgate com segurança…');
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
        'Confirmação enviada. Aguarde alguns instantes e não repita a operação.',
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
    if (!intent?.order?.id) return;
    setError('');
    setLoading(true);
    try {
      const accessToken = await sessionToken();
      const state = await reconcileWalletFirstExitPix(
        accessToken,
        intent.order.id,
      );
      setFinalResult(state);
      const paid =
        state?.confirmed === true ||
        String(state?.batch?.status || '').toLowerCase() === 'paid';
      if (paid) {
        setPhase('completed');
        setStatusText('Pix enviado.');
        return;
      }
      setPhase('requested');
      setStatusText(
        state?.customerStatus ||
          'Resgate solicitado. Pagamento em até 1 dia útil.',
      );
    } catch {
      setPhase('requested');
      setStatusText(
        'Resgate solicitado. O processamento continua automaticamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  const completedAmountBrl =
    finalResult?.batch?.totalAmountBrl ||
    finalResult?.payout?.amountBrl ||
    finalResult?.order?.netBrl ||
    quote?.estimatedPayoutBrl ||
    0;

  return (
    <Screen>
      <Brand />
      <Eyebrow>RESGATE</Eyebrow>
      <Title>Sacar para Pix.</Title>
      <Paragraph>
        Veja quanto você recebe, autorize o resgate na sua carteira e deixe o restante com a Nexa.
      </Paragraph>

      <Card>
        <Badge>SALDO DIGITAL</Badge>
        <View style={styles.spacer} />
        <Field
          label="Valor do resgate"
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
          placeholder="Ex.: 10,00 USDC"
        />
        <ActionButton
          label={quote ? 'Atualizar cotação' : 'Ver quanto vou receber'}
          onPress={requestQuote}
          loading={loading && phase === 'idle'}
          disabled={
            resumedActive || (phase !== 'idle' && phase !== 'quoted')
          }
        />
      </Card>

      {quote ? (
        <Card style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>COTAÇÃO NEXA</Text>
          <Text style={styles.receiveLabel}>Valor estimado no seu Pix</Text>
          <Text style={styles.receiveValue}>
            {formatBrl(quote.estimatedPayoutBrl)}
          </Text>
          <Text style={styles.rate}>
            {formatUsdc(quote.amountUsdc)} · referência R$ {formatRate(quote.nexaRateBrl)}
          </Text>
          <Text style={styles.validity}>
            A estimativa já considera as condições da operação. O valor final é confirmado durante o processamento.
          </Text>
          {phase === 'quoted' ? (
            <ActionButton
              label="Continuar"
              onPress={prepareExit}
              loading={loading}
            />
          ) : null}
        </Card>
      ) : null}

      {swapPrepared && phase === 'swap_ready_to_sign' ? (
        <Card>
          <Badge tone="warning">1 DE 2 · AUTORIZAÇÃO</Badge>
          <Text style={styles.stepTitle}>Autorize a preparação do resgate</Text>
          <Text style={styles.stepText}>
            Como sua carteira é sua, esta etapa precisa da sua autorização. A Nexa cuida da infraestrutura e das taxas de rede.
          </Text>
          <ActionButton
            label="Autorizar"
            onPress={signSwap}
            loading={loading}
          />
        </Card>
      ) : null}

      {swapPrepared && (swapTxHash || swapCallId) && phase === 'swap_confirming' ? (
        <Card>
          <Badge tone="info">CONFIRMANDO AUTORIZAÇÃO</Badge>
          <Text style={styles.stepTitle}>
            {statusText || 'Confirmando sua autorização…'}
          </Text>
          <Text style={styles.stepText}>
            Não repita a operação. Se a confirmação demorar, você pode atualizar o status.
          </Text>
          <ActionButton
            label="Atualizar"
            variant="secondary"
            onPress={continueSwap}
            loading={loading}
          />
        </Card>
      ) : null}

      {prepared && phase === 'ready_to_sign' ? (
        <Card>
          <Badge tone="warning">2 DE 2 · CONFIRMAÇÃO</Badge>
          <Text style={styles.stepTitle}>Confirme o resgate</Text>
          <Text style={styles.stepText}>
            Valor solicitado: {formatUsdc(amountUsdc)}
          </Text>
          <Text style={styles.stepText}>
            Destino: sua chave Pix {prepared?.beneficiary?.pixKeyType || 'verificada'}.
          </Text>
          <Text style={styles.stepText}>
            Depois desta confirmação, a Nexa continua o processamento automaticamente.
          </Text>
          <ActionButton
            label="Confirmar resgate"
            onPress={signAndWithdraw}
            loading={loading}
          />
        </Card>
      ) : null}

      {phase === 'requested' ? (
        <Card style={styles.requestedCard}>
          <Badge tone="success">RESGATE SOLICITADO</Badge>
          <Text style={styles.completedAmount}>
            {formatBrl(completedAmountBrl)}
          </Text>
          <Text style={styles.successText}>
            {statusText || 'Pagamento em até 1 dia útil.'}
          </Text>
          <Text style={styles.stepText}>
            Você pode fechar o app. A Nexa continuará o processamento e enviará o Pix para sua chave verificada.
          </Text>
          <ActionButton
            label="Atualizar status"
            variant="secondary"
            onPress={continueProcessing}
            loading={loading}
          />
        </Card>
      ) : null}

      {phase === 'completed' ? (
        <Card style={styles.completedCard}>
          <Badge tone="success">PIX ENVIADO</Badge>
          <Text style={styles.completedAmount}>{formatBrl(completedAmountBrl)}</Text>
          <Text style={styles.successText}>
            Resgate concluído e Pix enviado para sua chave verificada.
          </Text>
          {finalResult?.endToEndId || finalResult?.batch?.endToEndId ? (
            <Text selectable style={styles.receipt}>
              Comprovante: {finalResult?.endToEndId || finalResult?.batch?.endToEndId}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {phase !== 'requested' && phase !== 'completed' && statusText ? (
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
  quoteCard: { backgroundColor: '#10151D', borderColor: '#5F5133' },
  requestedCard: { backgroundColor: '#101A18', borderColor: '#315E50' },
  completedCard: { backgroundColor: '#0E1D19', borderColor: '#2F6B58' },
  quoteLabel: {
    color: '#C8A968',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  rate: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  receiveLabel: {
    color: colors.muted,
    marginTop: spacing.lg,
    fontSize: 13,
  },
  receiveValue: {
    color: colors.text,
    fontSize: 36,
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
    fontSize: 18,
    marginTop: spacing.md,
  },
  stepText: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  receipt: {
    color: '#B6C1CE',
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.md,
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