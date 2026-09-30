import { useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
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
import { loadNexaSession } from '@/lib/session';
import {
  confirmWalletFirstSwap,
  ensureWalletFirstGas,
  getWalletFirstSwapQuote,
  normalizeWalletAddress,
  prepareWalletFirstSwap,
  sendPreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import { colors, radius, spacing } from '@/theme';

type Asset = 'BTC' | 'ETH';

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

async function waitForReceipt(provider: any, txHash: string) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const receipt = await provider
      .request({ method: 'eth_getTransactionReceipt', params: [txHash] })
      .catch(() => null);
    if (receipt) {
      const status = String(receipt.status || '').toLowerCase();
      if (status === '0x0' || status === '0') {
        throw new Error('A autorização não pôde ser concluída. Tente novamente.');
      }
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('A operação ainda está sendo confirmada. Tente novamente em instantes.');
}

export default function BuyCryptoScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const [asset, setAsset] = useState<Asset>('BTC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [prepared, setPrepared] = useState<any>(null);
  const [txHash, setTxHash] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function providerFor(address: string) {
    const expected = normalizeWalletAddress(address);
    const wallet = wallets.find(
      (candidate) => normalizeWalletAddress(candidate?.address) === expected,
    );
    if (!wallet) {
      router.push('/wallet-recovery' as any);
      throw new Error('Confirme sua identidade para continuar com a mesma carteira Nexa.');
    }
    if (typeof wallet.getProvider === 'function') return wallet.getProvider();
    if (typeof wallet.getEthereumProvider === 'function') return wallet.getEthereumProvider();
    throw new Error('Sua carteira precisa ser recuperada antes de autorizar a compra.');
  }

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
      setError(caught instanceof Error ? caught.message : 'Cotação Nexa indisponível agora.');
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
      setError(caught instanceof Error ? caught.message : 'A compra ainda não está disponível.');
    } finally {
      setWorking(false);
    }
  }

  async function confirmHash(hash: string) {
    const session = await loadNexaSession();
    if (!session) throw new Error('Sua sessão Nexa expirou.');
    const result = await confirmWalletFirstSwap(
      session.accessToken,
      prepared.intentToken,
      hash,
    );
    setConfirmation(result);
    return result;
  }

  async function confirmPurchase() {
    if (!prepared) return;
    setError('');
    setWorking(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');

      // A Nexa garante previamente o custo técnico necessário. O cliente não
      // precisa conhecer gas, POL ou rede e continua sendo quem autoriza a wallet.
      await ensureWalletFirstGas(session.accessToken);
      const provider = await providerFor(prepared.wallet);

      if (prepared.approvalRequired && prepared.approvalTransaction) {
        const approvalHash = await sendPreparedWalletTransaction(
          provider,
          prepared.approvalTransaction,
        );
        await waitForReceipt(provider, approvalHash);
      }

      const hash = await sendPreparedWalletTransaction(
        provider,
        prepared.swapTransaction,
      );
      setTxHash(hash);
      await confirmHash(hash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a compra.');
    } finally {
      setWorking(false);
    }
  }

  async function checkAgain() {
    if (!txHash) return;
    setError('');
    setWorking(true);
    try {
      await confirmHash(txHash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível verificar a compra.');
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
        Escolha o ativo e veja a Cotação Nexa. A Nexa cuida automaticamente da
        parte técnica da operação.
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
        <ActionButton label="Ver Cotação Nexa" onPress={requestQuote} loading={working && !quote} />
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
          <Text style={styles.validity}>Cotação válida por aproximadamente {quote.validForSeconds || 30}s.</Text>
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
          <Badge tone="warning">AUTORIZAÇÃO SEGURA</Badge>
          <Text style={styles.explain}>
            Confirme a compra com sua carteira Nexa. A Nexa cuida automaticamente
            dos detalhes técnicos necessários para concluir a operação.
          </Text>
          <ActionButton label="Confirmar compra" onPress={confirmPurchase} loading={working} />
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
            <>
              <Text style={styles.explain}>A Nexa está concluindo a confirmação da sua compra.</Text>
              <ActionButton
                label="Verificar novamente"
                variant="secondary"
                onPress={checkAgain}
                loading={working}
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
