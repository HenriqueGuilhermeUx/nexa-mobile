import { useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
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
import { consumePurchaseIdentityToken } from '@/lib/privyPurchaseAuthorization';
import { loadNexaSession } from '@/lib/session';
import {
  executeSponsoredWalletFirstSwap,
  getWalletFirstSwapQuote,
  prepareWalletFirstSwap,
} from '@/lib/walletFirstActions';
import { colors, radius, spacing } from '@/theme';

type Asset = 'BTC' | 'ETH';

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

function looksLikeJwt(value: unknown) {
  const token = String(value || '').trim();
  return token.length > 40 && token.split('.').length === 3;
}

export default function BuyCryptoScreen() {
  const params = useLocalSearchParams<{
    asset?: string | string[];
    amount?: string | string[];
    identityRecovered?: string | string[];
  }>();
  const privy = usePrivy() as any;

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

  function requestPrivyAuthorization() {
    router.push('/purchase-authorization' as any);
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

  async function getPrivyAccessTokenForPurchase() {
    const authorizedToken = consumePurchaseIdentityToken();
    if (looksLikeJwt(authorizedToken)) return authorizedToken;

    if (!privy?.user || typeof privy?.getAccessToken !== 'function') return '';
    try {
      const token = String((await privy.getAccessToken()) || '').trim();
      return looksLikeJwt(token) ? token : '';
    } catch {
      return '';
    }
  }

  async function confirmPurchase() {
    if (!prepared) return;
    setError('');
    setWorking(true);
    try {
      // Privy's wallet authorization context expects the authenticated app access
      // token. Identity tokens are profile-data tokens and are not used here.
      const privyAccessToken = await getPrivyAccessTokenForPurchase();
      if (!privyAccessToken) {
        requestPrivyAuthorization();
        return;
      }

      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const result = await executeSponsoredWalletFirstSwap(
        session.accessToken,
        prepared.intentToken,
        prepared.swapTransaction,
        privyAccessToken,
      );
      const hash = String(result?.txHash || '').trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error('A compra foi enviada, mas ainda está sendo confirmada.');
      }
      setTxHash(hash);
      setConfirmation(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a compra.');
    } finally {
      setWorking(false);
    }
  }

  const completed = confirmation?.completed === true;
  const identityRecovered = firstParam(params.identityRecovered) === '1';

  return (
    <Screen>
      <Brand />
      <Eyebrow>ATIVOS DIGITAIS</Eyebrow>
      <Title>Comprar com USDC.</Title>
      <Paragraph>
        Escolha o ativo e veja a Cotação Nexa. A Nexa cuida automaticamente da
        parte técnica da operação.
      </Paragraph>

      {identityRecovered ? (
        <Card>
          <Badge tone="success">IDENTIDADE CONFIRMADA</Badge>
          <Text style={styles.explain}>
            Sua sessão Privy foi confirmada. Você pode refazer a cotação e concluir a compra.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Qual ativo?</Text>
        <View style={styles.assetRow}>
          {(['BTC', 'ETH'] as Asset).map ? null : null}
          {(['BTC', 'ETH'] as Asset[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setAsset(item);
                setQuote(null);
                setPrepared(null);
                setConfirmation(null);
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
            Confirme a compra com sua sessão Privy. A wallet de destino é
            validada pela Nexa e pela Privy antes da execução.
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
            <Text style={styles.explain}>A Nexa está concluindo a confirmação da sua compra.</Text>
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
