import {
  alchemyWalletTransport,
  createSmartWalletClient,
} from '@alchemy/wallet-apis';
import {
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/expo';
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
  confirmPremiumGoldPurchase,
  getClientSwapSponsorshipCredentials,
  getPremiumGoldQuote,
  getPremiumGoldSponsorshipCredentials,
  getWalletFirstSwapQuote,
  preparePremiumGoldPurchase,
  prepareWalletFirstSwap,
  PreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import { colors, radius, spacing } from '@/theme';

type Asset = 'BTC' | 'ETH' | 'PAXG';

type SponsoredCall = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
};

const ASSET_OPTIONS: Array<{ value: Asset; label: string }> = [
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
  { value: 'PAXG', label: 'OURO' },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseUsdc(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function assetName(asset: Asset) {
  return asset === 'PAXG' ? 'Ouro' : asset;
}

function formatAsset(value: unknown, asset: Asset) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} ${asset === 'PAXG' ? 'PAXG' : asset}`;
}

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} USDC`;
}

function maskEmail(value: string) {
  const [name, domain] = String(value || '').split('@');
  if (!name || !domain) return value;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 2))}@${domain}`;
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
  asset: Asset,
) {
  let lastResult: any = null;
  const maxAttempts = asset === 'PAXG' ? 18 : 8;
  const delayMs = asset === 'PAXG' ? 5_000 : 4_000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastResult =
      asset === 'PAXG'
        ? await confirmPremiumGoldPurchase(accessToken, intentToken, hash)
        : await confirmClientSponsoredWalletFirstSwap(
            accessToken,
            intentToken,
            hash,
          );
    if (lastResult?.completed === true) return lastResult;
    if (attempt < maxAttempts - 1) await delay(delayMs);
  }
  return lastResult;
}

async function buildPrivySigner(wallet: any) {
  const provider = await wallet?.getProvider?.();
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
  asset: Asset;
  prepared: any;
  credentials: ClientSponsorshipCredentials;
  onTxHash: (hash: string) => void;
  onConfirmation: (result: any) => void;
  onError: (message: string) => void;
  onWalletReconnected: () => void;
}) {
  const { wallets } = useEmbeddedEthereumWallet();
  const privy = usePrivy() as any;
  const emailLogin = useLoginWithEmail() as any;
  const [isLoading, setIsLoading] = useState(false);
  const [reconnectLoading, setReconnectLoading] = useState(false);
  const [reconnectEmail, setReconnectEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState('');

  const wallet = wallets?.find(
    (candidate) =>
      String(candidate.address || '').toLowerCase() ===
      String(props.credentials.wallet || '').toLowerCase(),
  );

  async function sendReconnectCode() {
    props.onError('');
    setReconnectLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const email = String(session.email || '').trim().toLowerCase();
      if (!email) throw new Error('O e-mail da sua conta Nexa não está disponível.');

      if (privy?.user && !wallet && typeof privy?.logout === 'function') {
        await privy.logout();
        await delay(300);
      }

      if (typeof emailLogin?.sendCode !== 'function') {
        throw new Error('A reconexão da sua carteira não está disponível nesta instalação.');
      }

      await emailLogin.sendCode({ email, disableSignup: true });
      setReconnectEmail(email);
      setCode('');
      setCodeSent(true);
      setReconnectStatus(`Código enviado para ${maskEmail(email)}.`);
    } catch (caught) {
      props.onError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível iniciar a reconexão da carteira.',
      );
    } finally {
      setReconnectLoading(false);
    }
  }

  async function validateReconnectCode() {
    const normalizedCode = code.replace(/\D/g, '').trim();
    props.onError('');
    if (normalizedCode.length < 4) {
      props.onError('Informe o código recebido no e-mail.');
      return;
    }

    setReconnectLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const email = reconnectEmail || String(session.email || '').trim().toLowerCase();
      if (!email) throw new Error('O e-mail da sua conta Nexa não está disponível.');

      if (privy?.user && !wallet && typeof privy?.logout === 'function') {
        await privy.logout();
        await delay(300);
      }

      if (typeof emailLogin?.loginWithCode !== 'function') {
        throw new Error('A validação da sua carteira não está disponível nesta instalação.');
      }

      await emailLogin.loginWithCode({ email, code: normalizedCode });
      if (typeof privy?.getAccessToken === 'function') {
        await privy.getAccessToken();
      }
      setCodeSent(false);
      setReconnected(true);
      setReconnectStatus('Sessão confirmada. Carregando sua carteira existente...');
    } catch (caught) {
      props.onError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível validar a reconexão da carteira.',
      );
    } finally {
      setReconnectLoading(false);
    }
  }

  async function execute() {
    props.onError('');
    let submittedHash = '';
    setIsLoading(true);
    try {
      if (!wallet) {
        throw new Error('Reconecte sua carteira antes de confirmar a compra.');
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
        throw new Error('A compra não foi confirmada. Atualize o status antes de tentar novamente.');
      }

      const receipt = status.receipts?.[status.receipts.length - 1];
      submittedHash = String(receipt?.transactionHash || '').trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(submittedHash)) {
        throw new Error('Não foi possível confirmar o identificador da compra.');
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
        props.asset,
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

  if (!wallet) {
    return (
      <Card>
        <Badge tone="warning">RECONECTAR CARTEIRA</Badge>
        <Text style={styles.explain}>
          Sua conta Nexa está ativa, mas a sessão da carteira usada nesta compra
          não está carregada neste aparelho. Confirme o mesmo e-mail para recuperar
          a carteira já existente. A Nexa não criará outra carteira nem trocará seu vínculo.
        </Text>
        {reconnectStatus ? <Text style={styles.reconnectStatus}>{reconnectStatus}</Text> : null}
        {!codeSent ? (
          <ActionButton
            label={reconnected ? 'Tentar carregar carteira novamente' : 'Reconectar carteira'}
            onPress={sendReconnectCode}
            loading={reconnectLoading}
          />
        ) : (
          <>
            <Field
              label="Código recebido por e-mail"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder="Digite o código"
            />
            <ActionButton
              label="Validar carteira"
              onPress={validateReconnectCode}
              loading={reconnectLoading}
            />
            <ActionButton
              label="Enviar novo código"
              variant="secondary"
              disabled={reconnectLoading}
              onPress={sendReconnectCode}
            />
          </>
        )}
      </Card>
    );
  }

  if (reconnected) {
    return (
      <Card>
        <Badge tone="success">CARTEIRA RECONECTADA</Badge>
        <Text style={styles.explain}>
          A carteira correta voltou a ficar disponível neste aparelho. Atualize a
          autorização para continuar a compra com segurança.
        </Text>
        <ActionButton
          label="Atualizar autorização da compra"
          onPress={props.onWalletReconnected}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Badge tone="warning">AUTORIZAÇÃO NA SUA CARTEIRA</Badge>
      <Text style={styles.explain}>
        Ao confirmar, sua própria carteira autoriza a operação. A Nexa não recebe
        sua chave privada e cuida da infraestrutura necessária.
      </Text>
      {props.prepared.approvalRequired ? (
        <Text style={styles.explain}>
          A autorização do USDC e a compra serão concluídas no mesmo fluxo.
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
  const requestedAsset = firstParam(params.asset);
  const initialAsset: Asset =
    requestedAsset === 'PAXG' ? 'PAXG' : requestedAsset === 'ETH' ? 'ETH' : 'BTC';
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
      const response =
        asset === 'PAXG'
          ? await getPremiumGoldQuote(session.accessToken, amountUsdc)
          : await getWalletFirstSwapQuote(
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

      const response =
        asset === 'PAXG'
          ? await preparePremiumGoldPurchase(session.accessToken, amountUsdc)
          : await prepareWalletFirstSwap(
              session.accessToken,
              asset,
              amountUsdc,
            );
      if (!response?.intentToken || !response?.swapTransaction || !response?.wallet) {
        throw new Error('A Nexa não retornou uma operação válida.');
      }

      const sponsorship =
        asset === 'PAXG'
          ? await getPremiumGoldSponsorshipCredentials(
              session.accessToken,
              response.intentToken,
            )
          : await getClientSwapSponsorshipCredentials(
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
        throw new Error('Não foi possível preparar as taxas desta operação para sua carteira.');
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

  function refreshAfterWalletReconnect() {
    setPrepared(null);
    setCredentials(null);
    setTxHash('');
    setConfirmation(null);
    setError('Carteira reconectada. Toque em “Continuar compra” para gerar uma autorização nova.');
  }

  async function refreshConfirmation() {
    if (!txHash || !prepared?.intentToken) return;
    setWorking(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const result = await confirmOnBackend(
        session.accessToken,
        prepared.intentToken,
        txHash,
        asset,
      );
      setConfirmation(result);
      if (result?.completed !== true) {
        setError(
          asset === 'PAXG'
            ? 'O Ouro ainda está atravessando a liquidação entre redes. Não repita a compra; atualize a confirmação em instantes.'
            : 'A compra ainda está sendo confirmada. Não repita a operação; atualize em instantes.',
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível atualizar a confirmação agora.',
      );
    } finally {
      setWorking(false);
    }
  }

  const completed = confirmation?.completed === true;

  return (
    <Screen>
      <Brand />
      <Eyebrow>ATIVOS CRIPTO</Eyebrow>
      <Title>Comprar com USDC.</Title>
      <Paragraph>
        Escolha Bitcoin, Ethereum ou Ouro Digital e veja a Cotação Nexa. Você autoriza
        a compra na sua própria carteira e a Nexa cuida da parte técnica.
      </Paragraph>

      <Card>
        <Text style={styles.label}>Qual ativo?</Text>
        <View style={styles.assetRow}>
          {ASSET_OPTIONS.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                setAsset(item.value);
                setQuote(null);
                resetExecution();
              }}
              style={[styles.assetButton, asset === item.value && styles.assetButtonActive]}
            >
              <Text style={[styles.assetText, asset === item.value && styles.assetTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {asset === 'PAXG' ? (
          <Text style={styles.goldNote}>
            Ouro Digital é comprado com seu USDC e aparece na sua carteira após a confirmação.
          </Text>
        ) : null}
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
          <Text style={styles.network}>
            {asset === 'PAXG' ? 'Valor estimado de Ouro Digital' : `Valor estimado da compra de ${assetName(asset)}`}
          </Text>
          {quote.validForSeconds ? (
            <Text style={styles.validity}>
              Cotação válida por aproximadamente {quote.validForSeconds}s.
            </Text>
          ) : (
            <Text style={styles.validity}>
              Cotação sujeita à atualização até a confirmação da compra.
            </Text>
          )}
          {!prepared && !txHash ? (
            <ActionButton
              label={asset === 'PAXG' ? 'Continuar compra de Ouro' : 'Continuar compra'}
              onPress={preparePurchase}
              loading={working}
            />
          ) : null}
        </Card>
      ) : null}

      {prepared && credentials && !txHash ? (
        <SponsoredConfirmation
          asset={asset}
          prepared={prepared}
          credentials={credentials}
          onTxHash={setTxHash}
          onConfirmation={setConfirmation}
          onError={setError}
          onWalletReconnected={refreshAfterWalletReconnect}
        />
      ) : null}

      {txHash ? (
        <Card>
          <Badge tone={completed ? 'success' : 'warning'}>
            {completed
              ? asset === 'PAXG'
                ? 'OURO NA SUA CARTEIRA'
                : 'ATIVO NA SUA CARTEIRA'
              : asset === 'PAXG'
                ? 'LIQUIDANDO OURO'
                : 'CONFIRMANDO COMPRA'}
          </Badge>
          {completed ? (
            <Text style={styles.success}>
              {formatAsset(confirmation.receivedAmount, asset)} confirmado na sua carteira.
            </Text>
          ) : (
            <>
              <Text style={styles.explain}>
                {asset === 'PAXG'
                  ? 'A compra já foi enviada. A Nexa está aguardando a confirmação final do Ouro Digital na sua carteira.'
                  : 'A compra já foi enviada. A Nexa está confirmando o resultado com segurança.'}
              </Text>
              <ActionButton
                label="Atualizar confirmação"
                variant="secondary"
                loading={working}
                onPress={refreshConfirmation}
              />
            </>
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
  assetRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  goldNote: { color: colors.warning, lineHeight: 19, marginBottom: spacing.md, fontSize: 12 },
  quoteCard: { backgroundColor: '#11143C' },
  kicker: { color: colors.cyan, fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  from: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.md },
  arrow: { color: colors.cyan, fontSize: 24, marginVertical: spacing.sm },
  receive: { color: colors.text, fontSize: 32, fontWeight: '900' },
  network: { color: colors.muted, marginTop: spacing.sm },
  validity: { color: colors.muted, fontSize: 12, marginVertical: spacing.lg },
  explain: { color: colors.muted, lineHeight: 21, marginVertical: spacing.lg },
  reconnectStatus: { color: colors.cyan, lineHeight: 20, marginBottom: spacing.md },
  hash: { color: colors.cyan, fontSize: 11, lineHeight: 17, marginTop: spacing.md },
  success: { color: colors.success, fontWeight: '800', marginTop: spacing.md },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md },
});