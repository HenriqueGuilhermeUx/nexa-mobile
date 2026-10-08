import React, { useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { Redirect } from 'expo-router';
import { encodeFunctionData, parseUnits } from 'viem';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { futureFinancialFeatures } from '@/lib/futureFinancialFeatures';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

type Instrument = 'BARCODE' | 'PIX_COPY_PASTE';

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function validEvmAddress(value: unknown) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function NexaPayPreparedScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const wallet = useMemo(
    () => wallets.find((candidate) => validEvmAddress(candidate?.address)) || null,
    [wallets],
  );

  const [token, setToken] = useState('');
  const [instrument, setInstrument] = useState<Instrument>('BARCODE');
  const [payload, setPayload] = useState('');
  const [amount, setAmount] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [scheduled, setScheduled] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!futureFinancialFeatures.nexaPayEnabled) return;
    void loadNexaSession().then(async (session) => {
      if (!session?.accessToken) return;
      setToken(session.accessToken);
      try {
        const rows = await nexaApi.nexaPayPremiumMine(session.accessToken);
        setMine(Array.isArray(rows) ? rows : []);
      } catch {
        setMine([]);
      }
    });
  }, []);

  const amountBrl = useMemo(() => {
    const value = Number(String(amount).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(value) ? value : undefined;
  }, [amount]);

  if (!futureFinancialFeatures.nexaPayEnabled) {
    return <Redirect href={'/legacy' as any} />;
  }

  async function prepare() {
    if (!token) {
      setMessage('Sessão Nexa indisponível.');
      return;
    }
    try {
      setLoading(true);
      setMessage('');
      const result = await nexaApi.nexaPayPremiumPreview(token, {
        instrument,
        payload: payload.trim(),
        amountBrl: instrument === 'BARCODE' ? undefined : amountBrl,
        scheduledFor,
      });
      setPreview(result);
      setScheduled(null);
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível validar a conta.');
    } finally {
      setLoading(false);
    }
  }

  async function providerFor(currentWallet: any) {
    if (typeof currentWallet?.getProvider === 'function') {
      return currentWallet.getProvider();
    }
    if (typeof currentWallet?.getEthereumProvider === 'function') {
      return currentWallet.getEthereumProvider();
    }
    throw new Error('Sua wallet Privy ainda não está pronta para autorizar o pagamento.');
  }

  async function confirmTransferWithRetry(
    accessToken: string,
    paymentId: string,
    txHash: string,
  ) {
    let last: any = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      last = await nexaApi.nexaPayPremiumConfirmWalletTransfer(
        accessToken,
        paymentId,
        txHash,
      );
      if (last?.verified === true) return last;
      if (last?.pending !== true) return last;
      await sleep(5_000);
    }
    return last;
  }

  async function authorizeUsdc() {
    const authorization = scheduled?.walletAuthorization;
    const paymentId = String(scheduled?.payment?.id || '').trim();
    if (!token || !paymentId || !authorization) return;

    try {
      setLoading(true);
      setMessage('');

      if (!wallet || !validEvmAddress(wallet.address)) {
        throw new Error(
          'Sua wallet Privy vinculada não está disponível neste aparelho.',
        );
      }

      const destination = String(authorization.toAddress || '').trim();
      const tokenContract = String(authorization.tokenContract || '').trim();
      const amountUsdc = Number(authorization.amountUsdc);
      const decimals = Number(authorization.decimals ?? 6);

      if (!validEvmAddress(destination) || !validEvmAddress(tokenContract)) {
        throw new Error('A rota USDC da Foxbit não está válida.');
      }
      if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
        throw new Error('Valor USDC inválido para autorização.');
      }
      if (Number(authorization.chainId || 137) !== 137) {
        throw new Error('A rota de pagamento não está na Polygon.');
      }

      const provider = await providerFor(wallet);
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('A wallet Privy não está pronta para transacionar.');
      }

      const accounts = await provider
        .request({ method: 'eth_accounts' })
        .catch(() => []);
      if (
        Array.isArray(accounts) &&
        accounts.length > 0 &&
        !accounts.some(
          (account: unknown) =>
            normalizeAddress(account) === normalizeAddress(wallet.address),
        )
      ) {
        throw new Error('A wallet ativa não corresponde à wallet vinculada à Nexa.');
      }

      const currentChain = String(
        (await provider.request({ method: 'eth_chainId' }).catch(() => '')) || '',
      ).toLowerCase();
      if (currentChain && currentChain !== '0x89') {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      }

      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [
          destination as `0x${string}`,
          parseUnits(String(amountUsdc), decimals),
        ],
      });

      const txHash = String(
        (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: wallet.address,
              to: tokenContract,
              data,
              value: '0x0',
            },
          ],
        })) || '',
      ).trim();

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('A Privy não retornou uma transação válida.');
      }

      setMessage('USDC enviado. Confirmando a transação na Polygon…');
      const confirmation = await confirmTransferWithRetry(
        token,
        paymentId,
        txHash,
      );

      if (confirmation?.verified === true) {
        setScheduled((current: any) => ({
          ...current,
          payment: confirmation.payment,
          walletTransfer: {
            txHash,
            verified: true,
          },
        }));
        const rows = await nexaApi.nexaPayPremiumMine(token).catch(() => []);
        setMine(Array.isArray(rows) ? rows : []);
        setMessage(
          'USDC confirmado. A Nexa agora acompanha o crédito na Foxbit e prepara o BRL para o pagamento.',
        );
        return;
      }

      if (confirmation?.pending === true) {
        setScheduled((current: any) => ({
          ...current,
          walletTransfer: { txHash, verified: false, pending: true },
        }));
        setMessage(
          'USDC enviado. A confirmação on-chain ainda está em andamento; a Nexa não fará o pagamento antes de validar a transação.',
        );
        return;
      }

      throw new Error(
        'A transação foi enviada, mas ainda não pôde ser validada pela Nexa.',
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Não foi possível autorizar o USDC na wallet Privy.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function schedule() {
    if (!token || !preview?.quote?.requiredUsdc) return;
    try {
      setLoading(true);
      setMessage('');
      const result = await nexaApi.nexaPayPremiumSchedule(token, {
        instrument,
        payload: payload.trim(),
        amountBrl: instrument === 'BARCODE' ? undefined : amountBrl,
        scheduledFor,
        maximumUsdcApproved: Number(preview.quote.requiredUsdc),
      });
      setScheduled(result);
      const rows = await nexaApi.nexaPayPremiumMine(token).catch(() => []);
      setMine(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível agendar o pagamento.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPayload('');
    setAmount('');
    setScheduledFor('');
    setPreview(null);
    setScheduled(null);
    setMessage('');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>NEXA PAY · PREMIUM</Text>
      <Text style={styles.title}>Pague contas com USDC</Text>
      <Text style={styles.subtitle}>
        Agende com pelo menos 1 dia útil de antecedência. O USDC é autorizado
        na sua wallet no agendamento e o pagamento em reais é preparado antes
        da data escolhida.
      </Text>

      {message ? (
        <Pressable style={styles.notice} onPress={() => setMessage('')}>
          <Text style={styles.noticeText}>{message}</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Tipo de cobrança</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.choice, instrument === 'BARCODE' && styles.choiceActive]}
            onPress={() => {
              setInstrument('BARCODE');
              setPreview(null);
            }}
          >
            <Text style={styles.choiceText}>Código de barras</Text>
          </Pressable>
          <Pressable
            style={[styles.choice, instrument === 'PIX_COPY_PASTE' && styles.choiceActive]}
            onPress={() => {
              setInstrument('PIX_COPY_PASTE');
              setPreview(null);
            }}
          >
            <Text style={styles.choiceText}>QR Pix / Copia e Cola</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>
          {instrument === 'BARCODE' ? 'Linha digitável / código de barras' : 'Pix Copia e Cola'}
        </Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={payload}
          onChangeText={(value) => {
            setPayload(value);
            setPreview(null);
          }}
          placeholder={
            instrument === 'BARCODE'
              ? 'Cole os 44–48 dígitos'
              : 'Cole o código Pix'
          }
          placeholderTextColor={colors.mutedStrong}
          multiline
          autoCapitalize="none"
        />

        {instrument !== 'BARCODE' ? (
          <>
            <Text style={styles.label}>Valor da cobrança</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                setPreview(null);
              }}
              placeholder="R$ 189,00"
              placeholderTextColor={colors.mutedStrong}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}

        <Text style={styles.label}>Data do pagamento</Text>
        <TextInput
          style={styles.input}
          value={scheduledFor}
          onChangeText={(value) => {
            setScheduledFor(value.replace(/[^0-9-]/g, '').slice(0, 10));
            setPreview(null);
          }}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.mutedStrong}
        />

        <Pressable
          disabled={loading || !payload.trim() || !scheduledFor}
          onPress={() => void prepare()}
          style={[
            styles.secondaryButton,
            (loading || !payload.trim() || !scheduledFor) && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryText}>Validar e calcular USDC</Text>
        </Pressable>
      </View>

      {preview ? (
        <View style={styles.previewCard}>
          <Text style={styles.kicker}>REVISÃO</Text>
          <Text style={styles.previewTitle}>
            {preview.beneficiaryName || 'Pagamento programado'}
          </Text>
          <Text style={styles.line}>
            Conta: {Number(preview.amountBrl || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </Text>
          <Text style={styles.line}>Data: {preview.scheduledFor}</Text>
          <Text style={styles.line}>
            USDC: {Number(preview.quote?.requiredUsdc || 0).toFixed(6)}
          </Text>
          <Text style={styles.line}>
            Taxa/conversão Premium: {Number(preview.quote?.feePercent || 0).toFixed(2)}%
          </Text>
          <Text style={styles.expiry}>
            Cotação curta. O valor é recalculado no momento do agendamento.
          </Text>

          <Pressable
            disabled={loading}
            onPress={() => void schedule()}
            style={[styles.primaryButton, loading && styles.disabled]}
          >
            <Text style={styles.primaryText}>Agendar e reservar USDC</Text>
          </Pressable>
        </View>
      ) : null}

      {scheduled?.walletAuthorization ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Agendamento criado</Text>
          <Text style={styles.line}>
            Reserve {Number(scheduled.walletAuthorization.amountUsdc || 0).toFixed(6)} USDC
          </Text>
          <Text style={styles.line}>
            Rede: {scheduled.walletAuthorization.network}
          </Text>
          <Text style={styles.address}>
            {scheduled.walletAuthorization.toAddress}
          </Text>
          <Text style={styles.safety}>
            O destino é consultado diretamente na rota de depósito
            USDC/Polygon da Foxbit. Você autoriza esta transferência na própria
            Privy; a Nexa não recebe permissão permanente sobre sua wallet.
          </Text>

          {scheduled?.walletTransfer?.verified ? (
            <View style={styles.verifiedBox}>
              <Text style={styles.verifiedTitle}>USDC confirmado na Polygon ✓</Text>
              <Text selectable style={styles.txHash}>
                {scheduled.walletTransfer.txHash}
              </Text>
            </View>
          ) : (
            <Pressable
              disabled={loading || !wallet}
              onPress={() => void authorizeUsdc()}
              style={[
                styles.primaryButton,
                (loading || !wallet) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>
                Autorizar USDC na Privy
              </Text>
            </Pressable>
          )}

          {!wallet ? (
            <Text style={styles.warningText}>
              Abra a sessão Privy da sua wallet para autorizar.
            </Text>
          ) : null}

          <Pressable onPress={reset} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Novo pagamento</Text>
          </Pressable>
        </View>
      ) : null}

      {mine.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>SEUS AGENDAMENTOS</Text>
          {mine.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>
                  {Number(item.amountBrl || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </Text>
                <Text style={styles.line}>
                  {item.scheduledFor} · {String(item.state || '').replace(/_/g, ' ')}
                </Text>
              </View>
              {item.paidAt ? <Text style={styles.paid}>PAGO</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : null}

      <Text style={styles.footer}>
        V1 Premium: liquidação Foxbit → Efí assistida pela operação Nexa; pagamento
        Efí por API. Recurso permanece oculto até o piloto ser habilitado.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  kicker: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  notice: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  choiceActive: { borderColor: colors.cyan, backgroundColor: colors.cyanSoft },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  label: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    fontSize: 14,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  primaryText: { color: colors.white, textAlign: 'center', fontWeight: '900' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  secondaryText: { color: colors.text, textAlign: 'center', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  previewCard: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.cyan,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  line: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  expiry: { color: colors.warning, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  successCard: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  successTitle: { color: colors.success, fontSize: 19, fontWeight: '900' },
  address: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  safety: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  verifiedBox: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  verifiedTitle: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  txHash: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.sm,
  },
  warningText: {
    color: colors.warning,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  paid: { color: colors.success, fontSize: 11, fontWeight: '900' },
  footer: {
    color: colors.mutedStrong,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
