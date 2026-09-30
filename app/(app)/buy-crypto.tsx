import { useAlchemySendTransaction } from '@account-kit/privy-integration/react-native';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import {
  assertPolygonProvider,
  confirmClientSponsoredWalletFirstSwap,
  getWalletFirstSwapQuote,
  normalizeWalletAddress,
  prepareWalletFirstSwap,
  PreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import { colors, radius, spacing } from '@/theme';

type Asset = 'BTC' | 'ETH';

type SponsoredCall = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
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
    value: String(transaction.value || '0x0'),
  };
}

async function providerFor(wallet: any) {
  if (typeof wallet?.getProvider === 'function') return wallet.getProvider();
  if (typeof wallet?.getEthereumProvider === 'function') {
    return wallet.getEthereumProvider();
  }
  throw new Error('A carteira Privy não expôs o provedor de assinatura.');
}

function SponsorshipUnavailableScreen() {
  return (
    <Screen>
      <Brand />
      <Eyebrow>ATIVOS DIGITAIS</Eyebrow>
      <Title>Comprar com USDC.</Title>
      <Card>
        <Badge tone="warning">CONFIGURAÇÃO EM ANDAMENTO</Badge>
        <Text style={styles.explain}>
          A execução patrocinada ainda não está habilitada neste build. Nenhuma
          transação será enviada sem a política de gas da Nexa configurada.
        </Text>
      </Card>
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

export default function BuyCryptoScreen() {
  if (!config.clientGasSponsorshipConfigured) {
    return <SponsorshipUnavailableScreen />;
  }
  return <SponsoredBuyCryptoScreen />;
}

function SponsoredBuyCryptoScreen() {
  const params = useLocalSearchParams<{
    asset?: string | string[];
    amount?: string | string[];
  }>();
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const { sendTransaction } = useAlchemySendTransaction();

  const initialAsset: Asset = firstParam(params.asset) === 'ETH' ? 'ETH' : 'BTC';
  const initialAmount = firstParam(params.amount) || '';

  const [asset, setAsset] = useState<Asset>(initialAsset);
  const [amount, setAmount] = useState(initialAmount);
  const [quote, setQuote] = useState<any>(null);
  const [prepared, setPrepared] = useState<any>(null);
  const [txHash, setTxHash] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function requestQuote() {
    setError('');
    setQuote(null);
    setPrepared(null);
    setConfirmation(null);
    setTxHash('');
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
      setPrepared(response);
      setQuote(response.quote || quote);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'A compra ainda não está disponível.',
      );
    } finally {
      setWorking(false);
    }
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

  async function confirmPurchase() {
    if (!prepared) return;
    setError('');
    setWorking(true);

    let submittedHash = '';
    try {
      const expectedWallet = normalizeWalletAddress(prepared.wallet);
      const wallet = wallets.find(
        (candidate) => normalizeWalletAddress(candidate?.address) === expectedWallet,
      );
      if (!wallet) {
        throw new Error(
          'A carteira vinculada à Nexa não está disponível neste dispositivo.',
        );
      }

      const provider = await providerFor(wallet);
      await assertPolygonProvider(provider);

      const calls: SponsoredCall[] = [];
      if (prepared.approvalRequired && prepared.approvalTransaction) {
        calls.push(toSponsoredCall(prepared.approvalTransaction));
      }
      calls.push(toSponsoredCall(prepared.swapTransaction));

      const result = await sendTransaction(calls.length === 1 ? calls[0] : calls);
      submittedHash = String(result?.txnHash || '').trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(submittedHash)) {
        throw new Error('A carteira não retornou um hash de transação válido.');
      }
      setTxHash(submittedHash);

      const session = await loadNexaSession();
      if (!session) {
        throw new Error(
          'A compra foi enviada, mas sua sessão Nexa expirou antes da confirmação.',
        );
      }

      const confirmed = await confirmOnBackend(
        session.accessToken,
        prepared.intentToken,
        submittedHash,
      );
      setConfirmation(confirmed);
    } catch (caught) {
      const prefix = submittedHash
        ? 'A transação foi enviada. A confirmação automática falhou: '
        : '';
      setError(
        `${prefix}${caught instanceof Error ? caught.message : 'Não foi possível concluir a compra.'}`,
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
                setPrepared(null);
                setConfirmation(null);
                setTxHash('');
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
            setPrepared(null);
            setConfirmation(null);
            setTxHash('');
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

      {prepared && !txHash ? (
        <Card>
          <Badge tone="warning">AUTORIZAÇÃO NA SUA CARTEIRA</Badge>
          <Text style={styles.explain}>
            Ao confirmar, sua carteira Privy assina a operação no dispositivo.
            A Nexa não recebe sua chave privada e patrocina o gas da transação.
          </Text>
          {prepared.approvalRequired ? (
            <Text style={styles.explain}>
              A aprovação de USDC e o swap serão enviados juntos em uma única
              operação patrocinada.
            </Text>
          ) : null}
          <ActionButton
            label="Confirmar compra"
            onPress={confirmPurchase}
            loading={working}
          />
        </Card>
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
