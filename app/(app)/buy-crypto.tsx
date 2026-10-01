import {
  alchemyWalletTransport,
  createSmartWalletClient,
} from '@alchemy/wallet-apis';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  ClientSponsorshipCredentials,
  confirmClientSponsoredWalletFirstSwap,
  getClientSwapSponsorshipCredentials,
  getWalletFirstSwapQuote,
  prepareWalletFirstSwap,
  PreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import { colors, radius, spacing } from '@/theme';

type Asset = 'BTC' | 'ETH';

type SponsoredCall = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseUsdc(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAsset(value: unknown, asset: Asset) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} ${asset}`;
}

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} USDC`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSponsoredCall(transaction: PreparedWalletTransaction): SponsoredCall {
  return {
    to: transaction.to as `0x${string}`,
    data: transaction.data as `0x${string}`,
    value: BigInt(String(transaction.value || '0x0')),
  };
}

function isPolygonChainId(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '0x89' || normalized === '137' || normalized === 'eip155:137';
}

async function confirmOnBackend(
  accessToken: string,
  intentToken: string,
  hash: string,
) {
  let lastResult: any = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    lastResult = await confirmClientSponsoredWalletFirstSwap(
      accessToken,
      intentToken,
      hash,
    );
    if (lastResult?.completed === true) return lastResult;
    if (attempt < 7) await delay(4_000);
  }
  return lastResult;
}

async function buildPrivySigner(wallet: any) {
  const provider = await wallet?.getProvider?.();
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
        throw new Error('A autorização EIP-7702 não informou o contrato de delegação.');
      }

      const authorization = {
        chainId: Number(request.chainId),
        address: implementationAddress,
        nonce: Number(request.nonce),
      };
      const authorizationHash = hashAuthorization(authorization);
      const signature = (await provider.request({
        method: 'secp256k1_sign',
        params: [authorizationHash],
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

function SponsoredConfirmation(props: {
  prepared: any;
  credentials: ClientSponsorshipCredentials;
  onTxHash: (hash: string) => void;
  onConfirmation: (result: any) => void;
  onError: (message: string) => void;
}) {
  const { wallets } = useEmbeddedEthereumWallet();
  const [isLoading, setIsLoading] = useState(false);

  async function execute() {
    props.onError('');
    let submittedHash = '';
    setIsLoading(true);
    try {
      const wallet = wallets?.find(
        (candidate) =>
          String(candidate.address || '').toLowerCase() ===
          String(props.credentials.wallet || '').toLowerCase(),
      );
      if (!wallet) {
        throw new Error('A carteira Privy desta compra não está disponível neste dispositivo.');
      }

      const signer = await buildPrivySigner(wallet);
      const client = createSmartWalletClient({
        signer,
        chain: polygon,
        transport: alchemyWalletTransport({ jwt: props.credentials.jwt }),
        paymaster: { policyId: props.credentials.policyId },
      });

      const calls: SponsoredCall[] = [];
      if (props.prepared.approvalRequired && props.prepared.approvalTransaction) {
        calls.push(toSponsoredCall(props.prepared.approvalTransaction));
      }
      calls.push(toSponsoredCall(props.prepared.swapTransaction));

      const result = await client.sendCalls({ calls });
      const status = await client.waitForCallsStatus({
        id: result.id,
        timeout: 120_000,
      });
      if (status.status !== 'success') {
        throw new Error('A operação patrocinada não foi confirmada pela rede.');
      }

      const receipt = status.receipts?.[status.receipts.length - 1];
      submittedHash = String(receipt?.transactionHash || '').trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(submittedHash)) {
        throw new Error('A carteira não retornou um hash de transação válido.');
      }
      props.onTxHash(submittedHash);

      const session = await loadNexaSession();
      if (!session) {
        throw new Error(
          'A compra foi enviada, mas sua sessão Nexa expirou antes da confirmação.',
        );
      }
      const confirmed = await confirmOnBackend(
        session.accessToken,
        props.prepared.intentToken,
        submittedHash,
      );
      props.onConfirmation(confirmed);
    } catch (caught) {
      const detail =
        caught instanceof Error ? caught.message : 'Não foi possível concluir a compra.';
      props.onError(
        submittedHash
          ? `A transação foi enviada. A confirmação automática falhou: ${detail}`
          : detail,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <Badge tone="warning">AUTORIZAÇÃO NA SUA CARTEIRA</Badge>
      <Text style={styles.explain}>
        Ao confirmar, sua carteira Privy assina a operação no dispositivo. A Nexa
        não recebe sua chave privada e patrocina o gas da transação.
      </Text>
      {props.prepared.approvalRequired ? (
        <Text style={styles.explain}>
          A aprovação de USDC e o swap serão executados juntos no fluxo patrocinado.
        </Text>
      ) : null}
      <ActionButton label="Confirmar compra" onPress={execute} loading={isLoading} />
    </Card>
  );
}

export default function BuyCryptoScreen() {
  const params = useLocalSearchParams<{
    asset?: string | string[];
    amount?: string | string[];
  }>();
  const initialAsset: Asset = firstParam(params.asset) === 'ETH' ? 'ETH' : 'BTC';
  const initialAmount = firstParam(params.amount) || '';

  const [asset, setAsset] = useState<Asset>(initialAsset);
  const [amount, setAmount] = useState(initialAmount);
  const [quote, setQuote] = useState<any>(null);
  const [prepared, setPrepared] = useState<any>(null);
  const [credentials, setCredentials] = useState<ClientSponsorshipCredentials | null>(null);
  const [txHash, setTxHash] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  function resetExecution() {
    setPrepared(null);
    setCredentials(null);
    setTxHash('');
    setConfirmation(null);
  }

  async function requestQuote() {
    setError('');
    setQuote(null);
    resetExecution();
    const amountUsdc = parseUsdc(amount);
    if (!(amountUsdc > 0)) {
      setError('Informe uma quantidade de USDC maior que zero.');
      return;
    }

    setWorking(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const response = await getWalletFirstSwapQuote(
        session.accessToken,
        asset,
        amountUsdc,
      );
      setQuote(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cotação Nexa indisponível agora.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function preparePurchase() {
    const amountUsdc = parseUsdc(amount);
    setError('');
    setWorking(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');

      const response = await prepareWalletFirstSwap(
        session.accessToken,
        asset,
        amountUsdc,
      );
      if (!response?.intentToken || !response?.swapTransaction || !response?.wallet) {
        throw new Error('A Nexa não retornou uma operação válida.');
      }

      const sponsorship = await getClientSwapSponsorshipCredentials(
        session.accessToken,
        response.intentToken,
      );
      if (
        sponsorship?.chainId !== 137 ||
        !sponsorship?.jwt ||
        !sponsorship?.policyId ||
        String(sponsorship.wallet || '').toLowerCase() !==
          String(response.wallet || '').toLowerCase()
      ) {
        throw new Error('A autorização de gas não corresponde à carteira preparada.');
      }

      setPrepared(response);
      setCredentials(sponsorship);
      setQuote(response.quote || quote);
    } catch (caught) {
      setPrepared(null);
      setCredentials(null);
      setError(
        caught instanceof Error
          ? caught.message
          : 'A compra ainda não está disponível.',
      );
    } finally {
      setWorking(false);
    }
  }

  const completed = confirmation?.completed === true;

  return (
    <Screen>
      <Brand />
      <Eyebrow>ATIVOS DIGITAIS</Eyebrow>
      <Title>Comprar com USDC.</Title>
      <Paragraph>
        Escolha o ativo e veja a Cotação Nexa. A transação é autorizada pela sua
        carteira Privy no dispositivo e a Nexa patrocina a taxa da rede.
      </Paragraph>

      <Card>
        <Text style={styles.label}>Qual ativo?</Text>
        <View style={styles.assetRow}>
          {(['BTC', 'ETH'] as Asset[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setAsset(item);
                setQuote(null);
                resetExecution();
              }}
              style={[styles.assetButton, asset === item && styles.assetButtonActive]}
            >
              <Text style={[styles.assetText, asset === item && styles.assetTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Quanto USDC deseja usar?"
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setQuote(null);
            resetExecution();
          }}
          keyboardType="decimal-pad"
          placeholder="Ex.: 0,50"
        />
        <ActionButton
          label="Ver Cotação Nexa"
          onPress={requestQuote}
          loading={working && !quote}
        />
      </Card>

      {quote ? (
        <Card style={styles.quoteCard}>
          <Text style={styles.kicker}>{quote.label || 'Cotação Nexa'}</Text>
          <Text style={styles.from}>{formatUsdc(quote.from?.amount)}</Text>
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.receive}>
            {formatAsset(quote.to?.estimatedAmount, asset)}
          </Text>
          <Text style={styles.network}>Valor estimado da compra</Text>
          <Text style={styles.validity}>
            Cotação válida por aproximadamente {quote.validForSeconds || 30}s.
          </Text>
          {!prepared && !txHash ? (
            <ActionButton
              label="Continuar compra"
              onPress={preparePurchase}
              loading={working}
            />
          ) : null}
        </Card>
      ) : null}

      {prepared && credentials && !txHash ? (
        <SponsoredConfirmation
          prepared={prepared}
          credentials={credentials}
          onTxHash={setTxHash}
          onConfirmation={setConfirmation}
          onError={setError}
        />
      ) : null}

      {txHash ? (
        <Card>
          <Badge tone={completed ? 'success' : 'warning'}>
            {completed ? 'ATIVO NA SUA CARTEIRA' : 'CONFIRMANDO COMPRA'}
          </Badge>
          <Text selectable style={styles.hash}>{txHash}</Text>
          {completed ? (
            <Text style={styles.success}>
              {formatAsset(confirmation.receivedAmount, asset)} confirmado na sua carteira.
            </Text>
          ) : (
            <Text style={styles.explain}>
              A operação já foi enviada. A Nexa está validando as confirmações e
              os movimentos on-chain.
            </Text>
          )}
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  assetRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  assetButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  assetButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  assetText: { color: colors.muted, fontWeight: '900' },
  assetTextActive: { color: colors.text },
  quoteCard: { backgroundColor: '#11143C' },
  kicker: { color: colors.cyan, fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  from: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.md },
  arrow: { color: colors.cyan, fontSize: 24, marginVertical: spacing.sm },
  receive: { color: colors.text, fontSize: 32, fontWeight: '900' },
  network: { color: colors.muted, marginTop: spacing.sm },
  validity: { color: colors.muted, fontSize: 12, marginVertical: spacing.lg },
  explain: { color: colors.muted, lineHeight: 21, marginVertical: spacing.lg },
  hash: { color: colors.cyan, fontSize: 11, lineHeight: 17, marginTop: spacing.md },
  success: { color: colors.success, fontWeight: '800', marginTop: spacing.md },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md },
});
