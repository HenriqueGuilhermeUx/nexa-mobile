import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  ActionButton,
  Badge,
  Card,
  Eyebrow,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

type Result = { kind: 'pix-charge'; payload: any };

type PixStage =
  | 'awaiting_pix'
  | 'pix_received'
  | 'processing'
  | 'sending'
  | 'available'
  | 'review';

function parseAmount(value: string) {
  const text = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!text) return 0;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let normalized = text;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = text.split(thousandsSeparator).join('');
    if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
  } else if (lastComma >= 0) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const dotCount = (text.match(/\./g) || []).length;
    normalized = dotCount === 1 ? text : text.replace(/\.(?=.*\.)/g, '');
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatBrl(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })} USDC`;
}

function stageRank(stage: PixStage) {
  if (stage === 'available') return 3;
  if (stage === 'sending') return 2;
  if (['pix_received', 'processing', 'review'].includes(stage)) return 1;
  return 0;
}

export default function NewOrderScreen() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingPix, setCheckingPix] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [pixStatus, setPixStatus] = useState<any>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const correlationID =
    result?.kind === 'pix-charge' ? String(result.payload?.correlationID || '').trim() : '';

  async function refreshStatus(silent = false) {
    if (!correlationID) return null;
    if (!silent) setCheckingPix(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const status = await nexaApi.getWalletFirstPixStatus(
        session.accessToken,
        correlationID,
      );
      setPixStatus(status);
      return status;
    } catch (caught) {
      if (!silent) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar agora.');
      }
      return null;
    } finally {
      if (!silent) setCheckingPix(false);
    }
  }

  useEffect(() => {
    if (!correlationID) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (!active) return;
      const session = await loadNexaSession();
      if (!session || !active) return;
      try {
        const status = await nexaApi.getWalletFirstPixStatus(
          session.accessToken,
          correlationID,
        );
        if (!active) return;
        setPixStatus(status);
        if (status?.stage === 'available' || status?.stage === 'review') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      } catch {
        // Polling is best-effort. Manual refresh remains available.
      }
    };

    void tick();
    timer = setInterval(() => void tick(), 5000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [correlationID]);

  function reviewAmount() {
    setError('');
    const parsed = parseAmount(amount);
    if (!Number.isFinite(parsed) || parsed < 10) {
      setError('O valor mínimo para adicionar é R$ 10,00.');
      return;
    }
    setReviewing(true);
  }

  async function submit() {
    setError('');
    setPixStatus(null);
    const parsed = parseAmount(amount);

    if (!Number.isFinite(parsed) || parsed < 10) {
      setError('O valor mínimo para adicionar é R$ 10,00.');
      return;
    }

    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const response = await nexaApi.createWalletFirstPixCharge(
        session.accessToken,
        parsed,
      );
      setResult({ kind: 'pix-charge', payload: response });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível gerar seu Pix agora.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyPixCode(code: string) {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopyFeedback('Código Pix copiado.');
    setTimeout(() => setCopyFeedback(''), 1800);
  }

  async function confirmPaidManually() {
    if (!correlationID) return;
    setCheckingPix(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      await nexaApi.reconcileWalletFirstPixCharge(session.accessToken, correlationID);
      const status = await nexaApi.getWalletFirstPixStatus(
        session.accessToken,
        correlationID,
      );
      setPixStatus(status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o Pix agora.');
    } finally {
      setCheckingPix(false);
    }
  }

  if (result?.kind === 'pix-charge') {
    const charge = result.payload || {};
    const pixCode = String(
      charge.copyPasteCode || charge?.charge?.brCode || charge?.charge?.paymentMethods?.pix?.brCode || '',
    ).trim();
    const stage = String(pixStatus?.stage || 'awaiting_pix') as PixStage;
    const rank = stageRank(stage);
    const complete = stage === 'available';
    const review = stage === 'review';

    return (
      <Screen>
        <Badge tone={complete ? 'success' : review ? 'warning' : 'info'}>
          {complete ? 'PRONTO' : pixStatus?.label || 'AGUARDANDO PIX'}
        </Badge>
        <View style={styles.topSpace} />
        <Title>{complete ? 'Seu saldo foi atualizado.' : 'Pix gerado'}</Title>
        <Paragraph>
          {complete
            ? `${formatUsdc(pixStatus?.quotedUsdc)} já está disponível na sua wallet.`
            : `Pague ${formatBrl(charge.amountBrl)} com o app do seu banco. A Nexa acompanha o restante automaticamente.`}
        </Paragraph>

        {!complete ? (
          <Card style={styles.pixCard}>
            {pixCode ? (
              <View style={styles.qrWrap}>
                <QRCode value={pixCode} size={210} />
              </View>
            ) : null}
            <Text style={styles.pixAmount}>{formatBrl(charge.amountBrl)}</Text>
            <Text style={styles.resultLabel}>Pix copia e cola</Text>
            <Text selectable numberOfLines={3} style={styles.pixCode}>
              {pixCode || 'Código Pix disponível no link da cobrança.'}
            </Text>
            {pixCode ? (
              <ActionButton
                label={copyFeedback || 'Copiar código Pix'}
                variant="secondary"
                onPress={() => copyPixCode(pixCode)}
              />
            ) : null}
          </Card>
        ) : null}

        <Card>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDone]} />
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Pix criado</Text>
              <Text style={styles.stepText}>Código pronto para pagamento.</Text>
            </View>
          </View>
          <View style={styles.stepConnector} />
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, rank >= 1 && styles.stepDone]} />
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Pix recebido</Text>
              <Text style={styles.stepText}>
                {rank >= 1 ? 'Pagamento confirmado.' : 'Aguardando confirmação.'}
              </Text>
            </View>
          </View>
          <View style={styles.stepConnector} />
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, rank >= 2 && styles.stepDone]} />
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Atualização da wallet</Text>
              <Text style={styles.stepText}>
                {complete
                  ? `${formatUsdc(pixStatus?.quotedUsdc)} confirmado na sua wallet.`
                  : rank >= 2
                    ? 'Atualizando sua wallet.'
                    : 'A Nexa fará isso automaticamente.'}
              </Text>
            </View>
          </View>
        </Card>

        {review ? (
          <Card>
            <Text style={styles.statusText}>
              A operação está protegida e será revisada antes de qualquer nova tentativa.
            </Text>
          </Card>
        ) : null}

        {complete && pixStatus?.txHash ? (
          <Card>
            <Pressable onPress={() => setShowTechnical((value) => !value)}>
              <Text style={styles.technicalToggle}>
                {showTechnical ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
              </Text>
            </Pressable>
            {showTechnical ? (
              <>
                <Text style={styles.resultLabel}>Identificador da operação</Text>
                <Text selectable style={styles.reference}>{pixStatus.txHash}</Text>
              </>
            ) : null}
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!complete ? (
          <ActionButton
            label="Já paguei · atualizar agora"
            loading={checkingPix}
            onPress={confirmPaidManually}
          />
        ) : null}
        <ActionButton
          label={complete ? 'Ver atividade' : 'Acompanhar depois'}
          variant="secondary"
          onPress={() => router.replace('/(app)/activity')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>ADICIONAR</Eyebrow>
      <Title>Adicionar com Pix</Title>
      <Paragraph>
        Adicione reais à sua experiência Nexa usando Pix. O valor confirmado entra em USDC na sua wallet.
      </Paragraph>

      <Card>
        <Text style={styles.ruleTitle}>Comece pelo que você já conhece</Text>
        <Text style={styles.ruleText}>
          Você faz um Pix. A Nexa acompanha o pagamento, a conversão e a entrega na sua wallet.
        </Text>
      </Card>

      <Field
        label="Quanto você quer adicionar?"
        value={amount}
        style={styles.amountField}
        onChangeText={(value) => {
          setAmount(value);
          setReviewing(false);
        }}
        keyboardType="decimal-pad"
        placeholder="R$ 0,00"
      />
      <View style={styles.quickRow}>
        {[100, 250, 500, 1000].map((value) => (
          <Pressable
            key={value}
            onPress={() => {
              setAmount(String(value));
              setReviewing(false);
            }}
            style={styles.quickButton}
          >
            <Text style={styles.quickButtonText}>R$ {value}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!reviewing ? (
        <ActionButton
          label="Continuar"
          disabled={loading}
          onPress={reviewAmount}
        />
      ) : (
        <Card style={styles.reviewCard}>
          <Text style={styles.reviewLabel}>VOCÊ ADICIONA</Text>
          <Text style={styles.reviewAmount}>{formatBrl(parseAmount(amount))}</Text>
          <Text style={styles.reviewText}>
            Depois do pagamento, a Nexa acompanha a confirmação e atualiza sua wallet em USDC. As condições aplicáveis aparecem no fluxo da operação.
          </Text>
          <ActionButton
            label="Gerar Pix"
            loading={loading}
            onPress={submit}
          />
          <ActionButton
            label="Editar valor"
            variant="secondary"
            disabled={loading}
            onPress={() => setReviewing(false)}
          />
        </Card>
      )}
      <ActionButton
        label="Trazer dinheiro via Open Finance"
        variant="secondary"
        onPress={() => router.push('/open-finance')}
      />
      <ActionButton
        label="Cartão · Apple Pay · Google Pay"
        variant="secondary"
        onPress={() => router.push('/(app)/fund-card' as any)}
      />

      <Text style={styles.microcopy}>
        Antes de pagar, você vê o valor e acompanha cada etapa. Nenhuma cobrança é repetida automaticamente.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  pixCard: { alignItems: 'stretch' },
  qrWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  pixAmount: { color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginVertical: spacing.sm },
  pixCode: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  amountField: { fontSize: 28, fontWeight: '800', textAlign: 'center', minHeight: 68 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  quickButton: { minWidth: '47%', flexGrow: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, alignItems: 'center' },
  quickButtonText: { color: colors.text, fontWeight: '900' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, marginTop: 4 },
  stepDone: { backgroundColor: colors.primary },
  stepBody: { flex: 1, marginLeft: spacing.sm },
  stepTitle: { color: colors.text, fontWeight: '900' },
  stepText: { color: colors.muted, marginTop: 3, lineHeight: 18 },
  stepConnector: { width: 2, height: 18, backgroundColor: colors.border, marginLeft: 5, marginVertical: 3 },
  ruleTitle: { color: colors.text, fontWeight: '900', fontSize: 17 },
  ruleText: { color: colors.muted, lineHeight: 21, marginTop: spacing.sm },
  microcopy: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
  statusText: { color: colors.text, fontWeight: '800', lineHeight: 20 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  resultLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  resultValue: { color: colors.text, fontWeight: '900', marginTop: 4 },
  reference: { color: colors.muted, fontWeight: '700', marginTop: 4, fontSize: 11, lineHeight: 16 },
  technicalToggle: { color: colors.cyan, fontSize: 12, fontWeight: '800' },
  reviewCard: { backgroundColor: colors.panel, borderColor: colors.borderStrong },
  reviewLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  reviewAmount: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: spacing.sm },
  reviewText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
});
