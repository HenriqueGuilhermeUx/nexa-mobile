import React, { useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
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

// NEXA_PAY_PILOT_APK_BUILD_MARKER: dry-run pilot build.
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

function newClientRequestId() {
  return `nexapay_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function maskDateBr(value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoDateToBr(value: unknown) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '').trim());
  if (!match) return String(value || '');
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function saoPauloDateOffsetBr(daysAhead: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      12,
    ),
  );
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

function friendlyPaymentError(error: any) {
  const raw = String(error?.message || '').trim();
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('boleto vencido') ||
    normalized.includes('after_due_date') ||
    normalized.includes('posterior ao vencimento')
  ) {
    return 'Este boleto está vencido ou a data escolhida ultrapassa o vencimento. Solicite uma via atualizada ou escolha uma data válida antes do vencimento.';
  }

  if (
    normalized.includes('não está disponível para pagamento') ||
    normalized.includes('não pode ser paga') ||
    normalized.includes('bill_not_payable')
  ) {
    return 'Não foi possível agendar este boleto. Ele pode estar vencido, já pago, cancelado, substituído pelo emissor ou temporariamente indisponível. Confira os dados e, se necessário, solicite uma nova via.';
  }

  if (
    normalized.includes('valor da cobrança mudou') ||
    normalized.includes('bill_changed')
  ) {
    return 'O valor desta cobrança foi atualizado. Por segurança, revise a nova via antes de agendar o pagamento.';
  }

  if (
    normalized.includes('código de barras') &&
    normalized.includes('inválido')
  ) {
    return 'Não reconhecemos esse código de barras. Confira os números ou fotografe novamente a cobrança.';
  }

  if (
    normalized.includes('limite') ||
    normalized.includes('excede')
  ) {
    return 'Esta cobrança está acima do limite disponível para este perfil. Ajuste o valor ou entre em contato com a Nexa.';
  }

  return raw || 'Não foi possível validar esta cobrança agora. Confira os dados e tente novamente.';
}


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
  const [clientRequestId, setClientRequestId] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [scheduled, setScheduled] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [pilotReadiness, setPilotReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!futureFinancialFeatures.nexaPayEnabled) return;
    void loadNexaSession().then(async (session) => {
      if (!session?.accessToken) return;
      setToken(session.accessToken);
      try {
        const readiness = await nexaApi.nexaPayPilotSelfReadiness(
          session.accessToken,
        );
        setPilotReadiness(readiness);
      } catch (error: any) {
        setPilotReadiness({
          authenticated: false,
          readyForPreview: false,
          error: error?.message || 'Piloto indisponível para esta sessão.',
        });
      }

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

  const scheduledForIso = useMemo(
    () => brDateToIso(scheduledFor),
    [scheduledFor],
  );

  if (!futureFinancialFeatures.nexaPayEnabled) {
    return <Redirect href={'/legacy' as any} />;
  }

  async function prepare() {
    if (!token) {
      setMessage('Sessão Nexa indisponível.');
      return;
    }
    if (!scheduledForIso) {
      setMessage('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    try {
      setLoading(true);
      setMessage('');
      const result = await nexaApi.nexaPayPremiumPreview(token, {
        instrument,
        payload: payload.trim(),
        amountBrl: instrument === 'BARCODE' ? undefined : amountBrl,
        scheduledFor: scheduledForIso,
      });
      setPreview(result);
      setClientRequestId(newClientRequestId());
      setScheduled(null);
    } catch (error: any) {
      setMessage(friendlyPaymentError(error));
    } finally {
      setLoading(false);
    }
  }

  async function readCodeFromImage(uri: string) {
    const results = await Camera.scanFromURLAsync(uri);
    const first = Array.isArray(results) ? results[0] : null;
    const data = String(first?.data || '').trim();

    if (!data) {
      throw new Error(
        'Não consegui encontrar um QR Code ou código de barras nessa foto. Aproxime o código e tente novamente.',
      );
    }

    const digits = data.replace(/\D/g, '');
    const qrType = String(first?.type || '').toLowerCase() === 'qr';
    const looksLikePix =
      data.startsWith('000201') || /br\.gov\.bcb\.pix/i.test(data);

    if (looksLikePix) {
      setInstrument('PIX_COPY_PASTE');
      setPayload(data);
      setAmount('');
      setPreview(null);
      setScheduled(null);
      setMessage('QR Pix lido pela foto ✓');
      return;
    }

    if (!qrType && digits.length >= 40 && digits.length <= 60) {
      setInstrument('BARCODE');
      setPayload(digits);
      setPreview(null);
      setScheduled(null);
      setMessage('Código de barras lido pela foto ✓');
      return;
    }

    if (qrType) {
      throw new Error(
        'O QR Code foi lido, mas não parece ser um Pix Copia e Cola válido.',
      );
    }

    setInstrument('BARCODE');
    setPayload(data);
    setPreview(null);
    setScheduled(null);
    setMessage('Código lido pela foto ✓');
  }

  async function scanFromCameraPhoto() {
    try {
      setScanningImage(true);
      setMessage('');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          'Autorize o uso da câmera para fotografar o QR Code ou código de barras.',
        );
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await readCodeFromImage(result.assets[0].uri);
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível ler o código pela câmera.');
    } finally {
      setScanningImage(false);
    }
  }

  async function scanFromGalleryPhoto() {
    try {
      setScanningImage(true);
      setMessage('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          'Autorize o acesso às fotos para selecionar a imagem da cobrança.',
        );
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await readCodeFromImage(result.assets[0].uri);
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível ler o código da foto.');
    } finally {
      setScanningImage(false);
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
    if (!futureFinancialFeatures.nexaPayWalletExecutionEnabled) {
      setMessage(
        'Execução da wallet está desligada neste APK de validação. Nenhum USDC será enviado.',
      );
      return;
    }

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

      const expiresAtMs = new Date(
        String(authorization.expiresAt || ''),
      ).getTime();
      if (
        !Number.isFinite(expiresAtMs) ||
        Date.now() >= expiresAtMs
      ) {
        const error = new Error(
          'A cotação expirou antes da autorização. Cancele este agendamento e valide novamente para receber uma nova cotação.',
        ) as Error & { code?: string };
        error.code = 'NEXA_PAY_QUOTE_EXPIRED';
        throw error;
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
          parseUnits(Number(amountUsdc).toFixed(decimals), decimals),
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
        scheduledFor: scheduledForIso,
        maximumUsdcApproved: Number(preview.quote.requiredUsdc),
        clientRequestId: clientRequestId || newClientRequestId(),
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

  async function cancelScheduled() {
    const paymentId = String(scheduled?.payment?.id || '').trim();
    if (!token || !paymentId) return;

    try {
      setLoading(true);
      setMessage('');
      await nexaApi.nexaPayPremiumCancel(token, paymentId);
      setScheduled(null);
      setPreview(null);
      setClientRequestId('');
      const rows = await nexaApi.nexaPayPremiumMine(token).catch(() => []);
      setMine(Array.isArray(rows) ? rows : []);
      setMessage(
        'Agendamento cancelado. Valide a cobrança novamente para gerar uma nova cotação.',
      );
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível cancelar o agendamento.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPayload('');
    setAmount('');
    setScheduledFor('');
    setClientRequestId('');
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
        Fotografe ou cole a cobrança, escolha uma data futura e revise o valor antes de autorizar.
        {futureFinancialFeatures.nexaPayWalletExecutionEnabled
          ? ' O USDC é autorizado na sua wallet no agendamento e o pagamento em reais é preparado antes da data escolhida.'
          : ' Este APK é um piloto de validação: consulta, cotação e agendamento de teste funcionam, mas nenhum USDC é enviado.'}
      </Text>

      {!futureFinancialFeatures.nexaPayWalletExecutionEnabled ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            PILOTO SEGURO · Nenhuma transferência USDC ou pagamento real será executado neste APK.
          </Text>
        </View>
      ) : null}

      {pilotReadiness && pilotReadiness.readyForPreview !== true ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Validando sua sessão no Nexa Pay. Você pode tentar a cobrança normalmente; o backend fará a validação final do acesso.
          </Text>
        </View>
      ) : null}

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
          {futureFinancialFeatures.nexaPayQrEnabled ? (
            <Pressable
              style={[
                styles.choice,
                instrument === 'PIX_COPY_PASTE' && styles.choiceActive,
              ]}
              onPress={() => {
                setInstrument('PIX_COPY_PASTE');
                setPreview(null);
              }}
            >
              <Text style={styles.choiceText}>QR Pix / Copia e Cola</Text>
            </Pressable>
          ) : null}
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

        <View style={styles.scanRow}>
          <Pressable
            disabled={loading || scanningImage}
            onPress={() => void scanFromCameraPhoto()}
            style={[
              styles.scanButton,
              (loading || scanningImage) && styles.disabled,
            ]}
          >
            <Text style={styles.scanText}>
              {scanningImage ? 'Lendo…' : 'Fotografar código'}
            </Text>
          </Pressable>
          <Pressable
            disabled={loading || scanningImage}
            onPress={() => void scanFromGalleryPhoto()}
            style={[
              styles.scanButton,
              (loading || scanningImage) && styles.disabled,
            ]}
          >
            <Text style={styles.scanText}>Escolher foto</Text>
          </Pressable>
        </View>
        <Text style={styles.scanHint}>
          Para código de barras, aproxime a câmera para o código ocupar boa parte da foto.
        </Text>

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

        <Text style={styles.label}>Data agendada</Text>
        <TextInput
          style={styles.input}
          value={scheduledFor}
          onChangeText={(value) => {
            setScheduledFor(maskDateBr(value));
            setPreview(null);
          }}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={colors.mutedStrong}
          keyboardType="number-pad"
          maxLength={10}
        />
        <View style={styles.dateQuickRow}>
          <Pressable
            onPress={() => {
              setScheduledFor(saoPauloDateOffsetBr(1));
              setPreview(null);
            }}
            style={styles.dateChip}
          >
            <Text style={styles.dateChipText}>Agendar para amanhã</Text>
          </Pressable>
        </View>

        <Pressable
          disabled={loading || !payload.trim() || !scheduledForIso}
          onPress={() => void prepare()}
          style={[
            styles.secondaryButton,
            (loading || !payload.trim() || !scheduledForIso) && styles.disabled,
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
          <Text style={styles.line}>Data: {isoDateToBr(preview.scheduledFor)}</Text>
          {preview.billDueDate ? (
            <Text style={styles.line}>
              Vencimento: {isoDateToBr(preview.billDueDate)}
            </Text>
          ) : null}
          <Text style={styles.line}>
            USDC: {Number(preview.quote?.requiredUsdc || 0).toFixed(6)}
          </Text>
          <Text style={styles.line}>
            Conversão: R$ {Number(
              preview.quote?.effectiveRateBrlPerUsdc || 0,
            ).toFixed(4)} por USDC
          </Text>
          <Text style={styles.expiry}>
            Cotação curta. O valor é recalculado no momento do agendamento.
          </Text>

          <Pressable
            disabled={loading}
            onPress={() => void schedule()}
            style={[styles.primaryButton, loading && styles.disabled]}
          >
            <Text style={styles.primaryText}>
              {futureFinancialFeatures.nexaPayWalletExecutionEnabled
                ? 'Agendar e reservar USDC'
                : 'Criar agendamento de teste'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {scheduled?.walletAuthorization &&
      futureFinancialFeatures.nexaPayWalletExecutionEnabled ? (
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

          {!scheduled?.walletTransfer?.verified ? (
            <Pressable
              disabled={loading}
              onPress={() => void cancelScheduled()}
              style={[styles.secondaryButton, loading && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Cancelar e recalcular</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={reset} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Novo pagamento</Text>
          </Pressable>
        </View>
      ) : null}

      {scheduled?.payment &&
      !scheduled?.walletAuthorization &&
      !futureFinancialFeatures.nexaPayWalletExecutionEnabled ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Agendamento de teste criado ✓</Text>
          <Text style={styles.line}>
            Valor: {Number(scheduled.payment.amountBrl || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </Text>
          <Text style={styles.line}>
            Data: {isoDateToBr(scheduled.payment.scheduledFor || scheduledForIso)}
          </Text>
          <Text style={styles.safety}>
            Dry-run concluído. Nenhuma autorização Privy foi gerada e nenhum USDC será movimentado.
          </Text>
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
                  {isoDateToBr(item.scheduledFor)} · {String(item.state || '').replace(/_/g, ' ')}
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
        Piloto controlado Nexa Pay: boleto e QR Pix, leitura por foto, limite de R$ 5 e autorização USDC pela sua wallet Privy.
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
  scanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  scanButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: colors.cyanSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  scanText: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },
  scanHint: {
    color: colors.mutedStrong,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.sm,
  },
  dateQuickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dateChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dateChipText: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '800',
  },
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
