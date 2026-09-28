import { useEffect, useState } from 'react';
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

type Result =
  | { kind: 'redemption'; payload: any }
  | { kind: 'pix-charge'; payload: any };

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

function profileFrom(response: any) {
  return response?.profile || response || {};
}

function isLegacyProfile(profile: any) {
  const value = String(profile?.settlementProfile || '').toLowerCase();
  return profile?.isLegacyBeta === true || value.includes('legacy');
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

function AssetPill({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <View style={[styles.assetPill, enabled && styles.assetPillEnabled]}>
      <Text style={[styles.assetPillText, enabled && styles.assetPillTextEnabled]}>
        {label}
      </Text>
      <Text style={styles.assetPillState}>{enabled ? 'AGORA' : 'EM BREVE'}</Text>
    </View>
  );
}

function stageRank(stage: PixStage) {
  if (stage === 'available') return 3;
  if (stage === 'sending') return 2;
  if (['pix_received', 'processing', 'review'].includes(stage)) return 1;
  return 0;
}

export default function NewOrderScreen() {
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingPix, setCheckingPix] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [pixStatus, setPixStatus] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) throw new Error('Sua sessão Nexa expirou.');
        const response = await nexaApi.directProfile(session.accessToken);
        setProfile(profileFrom(response));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível preparar sua conta.');
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  const legacy = isLegacyProfile(profile);
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

  async function submit() {
    setError('');
    setPixStatus(null);
    const parsed = parseAmount(amount);

    if (legacy) {
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Informe uma quantidade de USDC maior que zero.');
        return;
      }
      if (!pixKey.trim()) {
        setError('Informe a chave Pix que receberá o valor final.');
        return;
      }
    } else if (!Number.isFinite(parsed) || parsed < 10) {
      setError('O valor mínimo para adicionar é R$ 10,00.');
      return;
    }

    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      if (legacy) {
        const response = await nexaApi.requestPixRedemption(session.accessToken, {
          amountUsdc: parsed,
          pixKey: pixKey.trim(),
        });
        setResult({ kind: 'redemption', payload: response });
        return;
      }
      const response = await nexaApi.createWalletFirstPixCharge(
        session.accessToken,
        parsed,
      );
      setResult({ kind: 'pix-charge', payload: response });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível gerar seu Pix.');
    } finally {
      setLoading(false);
    }
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
        <Title>
          {complete
            ? `${formatUsdc(pixStatus?.quotedUsdc)} disponível.`
            : `Pague ${formatBrl(charge.amountBrl)}.`}
        </Title>
        <Paragraph>
          {complete
            ? 'Concluído. O USDC já foi confirmado na sua carteira.'
            : 'Depois do Pix, você pode fechar esta tela. A Nexa acompanha a operação e cuida da conversão e entrega automaticamente.'}
        </Paragraph>

        {!complete ? (
          <Card style={styles.pixCard}>
            {pixCode ? (
              <View style={styles.qrWrap}>
                <QRCode value={pixCode} size={210} />
              </View>
            ) : null}
            <Text style={styles.resultLabel}>Pix copia e cola</Text>
            <Text selectable style={styles.pixCode}>
              {pixCode || 'Código Pix disponível no link da cobrança.'}
            </Text>
            {charge.paymentLinkUrl ? (
              <Text selectable style={styles.reference}>{charge.paymentLinkUrl}</Text>
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
              <Text style={styles.stepTitle}>Entrega na carteira</Text>
              <Text style={styles.stepText}>
                {complete
                  ? `${formatUsdc(pixStatus?.quotedUsdc)} confirmado na blockchain.`
                  : rank >= 2
                    ? 'Enviando e confirmando.'
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
            <Text style={styles.resultLabel}>Comprovante blockchain</Text>
            <Text selectable style={styles.reference}>{pixStatus.txHash}</Text>
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

  if (result?.kind === 'redemption') {
    const redemption = result.payload || {};
    const fees = redemption.estimatedFees || {};
    return (
      <Screen>
        <Badge tone="success">RESGATE SOLICITADO</Badge>
        <View style={styles.topSpace} />
        <Title>Seu USDC foi reservado.</Title>
        <Paragraph>O valor final em reais será confirmado depois da venda e da conciliação.</Paragraph>
        <Card>
          <Text style={styles.resultLabel}>USDC reservado</Text>
          <Text style={styles.resultValue}>{formatUsdc(redemption.reservedUsdc)}</Text>
          <Text style={styles.resultLabel}>Estimativa líquida</Text>
          <Text style={styles.resultValue}>{formatBrl(redemption.estimatedPayoutBrl)}</Text>
          <Text style={styles.resultLabel}>Fee Nexa estimada</Text>
          <Text style={styles.resultValue}>
            {formatBrl(fees.nexaFeeBrl)} ({Number(fees.nexaFeePercent || 1.5)}%)
          </Text>
        </Card>
        <ActionButton label="Acompanhar" onPress={() => router.replace('/(app)/activity')} />
      </Screen>
    );
  }

  if (profileLoading) {
    return (
      <Screen>
        <Eyebrow>Nexa</Eyebrow>
        <Title>Preparando sua conta…</Title>
        <Paragraph>Só um instante.</Paragraph>
      </Screen>
    );
  }

  if (legacy) {
    return (
      <Screen>
        <Eyebrow>Resgatar</Eyebrow>
        <Title>Quanto USDC você quer sacar?</Title>
        <Paragraph>Informe o valor e a chave Pix. A Nexa cuida do restante.</Paragraph>
        <Field label="USDC" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex.: 45,60" />
        <Field label="Chave Pix" value={pixKey} onChangeText={setPixKey} autoCapitalize="none" placeholder="CPF, e-mail, telefone ou chave aleatória" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton label="Continuar" loading={loading} onPress={submit} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Adicionar dinheiro</Eyebrow>
      <Title>Quanto você quer adicionar?</Title>
      <Paragraph>Você paga em reais. A Nexa entrega USDC na sua carteira automaticamente.</Paragraph>
      <Field label="Valor em R$" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex.: 10,00" />
      <View style={styles.quickRow}>
        {[10, 50, 100].map((value) => (
          <Pressable key={value} onPress={() => setAmount(String(value))} style={styles.quickButton}>
            <Text style={styles.quickButtonText}>R$ {value}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <Text style={styles.ruleTitle}>Você recebe</Text>
        <View style={styles.assetRow}>
          <AssetPill label="USDC" enabled />
          <AssetPill label="ETH" />
          <AssetPill label="OURO" />
          <AssetPill label="BTC" />
        </View>
        <Text style={styles.ruleText}>
          Hoje o piloto entrega USDC. ETH, ouro digital e Bitcoin entrarão no mesmo fluxo simples depois da homologação completa.
        </Text>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton label="Gerar Pix" loading={loading} onPress={submit} />
      <Text style={styles.microcopy}>Mínimo R$ 10 · sua carteira já está vinculada</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  pixCard: { alignItems: 'stretch' },
  qrWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  pixCode: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 6 },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickButton: { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, alignItems: 'center' },
  quickButtonText: { color: colors.text, fontWeight: '900' },
  assetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  assetPill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft, paddingHorizontal: 12, paddingVertical: 9 },
  assetPillEnabled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  assetPillText: { color: colors.muted, fontWeight: '900' },
  assetPillTextEnabled: { color: colors.text },
  assetPillState: { color: colors.muted, fontSize: 8, fontWeight: '900', marginTop: 2 },
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
  reference: { color: colors.text, fontWeight: '800', marginTop: 4, fontSize: 12 },
});
