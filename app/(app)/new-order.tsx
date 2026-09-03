import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
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
import {
  nexaApi,
  WalletV15EntryReadiness,
  WooviPixCharge,
} from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

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

function stringCandidate(...values: any[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function extractPixCode(response: WooviPixCharge | null) {
  const charge: any = response?.charge || {};
  return stringCandidate(
    charge?.brCode,
    charge?.pix?.brCode,
    charge?.paymentMethods?.pix?.brCode,
    charge?.paymentMethods?.pix?.qrCode?.brCode,
    charge?.pixQrCode?.brCode,
    charge?.qrCode?.brCode,
    typeof charge?.qrCode === 'string' ? charge.qrCode : '',
  );
}

function extractPaymentLink(response: WooviPixCharge | null) {
  const charge: any = response?.charge || {};
  return stringCandidate(
    charge?.paymentLinkUrl,
    charge?.paymentLink,
    charge?.link,
    charge?.pix?.paymentLinkUrl,
  );
}

function blockerText(code: string) {
  const map: Record<string, string> = {
    PILOT_USER_NOT_ALLOWED: 'Esta conta ainda não foi liberada na janela do piloto.',
    PILOT_ALLOWLIST_EMPTY: 'A janela do piloto ainda não possui usuário autorizado.',
    WALLET_V15_PROFILE_NOT_ACTIVE: 'O perfil ainda aguarda ativação controlada.',
    WALLET_V15_DISABLED: 'A janela Wallet V1.5 está fechada.',
    WOOVI_V15_ROUTING_DISABLED: 'A entrada Pix ainda está fechada.',
    ORCHESTRATOR_DISABLED: 'O processamento automático ainda está fechado.',
    ORCHESTRATOR_EXTERNAL_EXECUTION_DISABLED:
      'A compra automática via Foxbit ainda está fechada.',
    FOXBIT_EXCHANGE_EXECUTION_DISABLED: 'A execução Foxbit ainda está fechada.',
    DESTINATION_WALLET_CRYPTOGRAPHIC_PROOF_REQUIRED:
      'A wallet ainda não tem prova criptográfica válida.',
  };
  return map[code] || code;
}

export default function NewOrderScreen() {
  const [amount, setAmount] = useState('');
  const [readiness, setReadiness] = useState<WalletV15EntryReadiness | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [charge, setCharge] = useState<WooviPixCharge | null>(null);

  async function refreshReadiness() {
    setChecking(true);
    setError('');
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }
      const next = await nexaApi.walletV15EntryReadiness(session.accessToken);
      setReadiness(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível validar a janela de entrada.',
      );
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void refreshReadiness();
  }, []);

  async function createPix() {
    setError('');
    const amountBrl = parseAmount(amount);
    if (!Number.isFinite(amountBrl) || amountBrl <= 0) {
      setError('Informe um valor em reais maior que zero.');
      return;
    }

    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }

      const current = await nexaApi.walletV15EntryReadiness(session.accessToken);
      setReadiness(current);
      if (!current.ready) {
        throw new Error(
          'A janela Pix → Foxbit → Saldo Nexa ainda não está liberada para esta conta.',
        );
      }

      const response = await nexaApi.createWalletV15WooviCharge(
        session.accessToken,
        amountBrl,
      );
      if (response.success !== true) {
        throw new Error('A Woovi não criou a cobrança Pix.');
      }
      setCharge(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível criar o Pix.',
      );
    } finally {
      setLoading(false);
    }
  }

  const pixCode = useMemo(() => extractPixCode(charge), [charge]);
  const paymentLink = useMemo(() => extractPaymentLink(charge), [charge]);
  const qrValue = pixCode || paymentLink;

  if (charge) {
    return (
      <Screen>
        <Badge tone="success">PIX CRIADO</Badge>
        <View style={styles.topSpace} />
        <Title>Pague o Pix.</Title>
        <Paragraph>
          Depois da confirmação da Woovi, o fluxo controlado processa a compra
          de USDC na Foxbit e o resultado aparece no seu Saldo Nexa.
        </Paragraph>

        <Card>
          <Text style={styles.resultLabel}>Valor</Text>
          <Text style={styles.resultValue}>{formatBrl(charge.amountBrl)}</Text>
          <Text style={styles.resultLabel}>Referência</Text>
          <Text selectable style={styles.reference}>
            {charge.correlationID || '—'}
          </Text>
        </Card>

        {qrValue ? (
          <Card>
            <View style={styles.qrWrap}>
              <View style={styles.qrBackground}>
                <QRCode value={qrValue} size={220} />
              </View>
            </View>
            {pixCode ? (
              <>
                <Text style={styles.resultLabel}>Pix copia e cola</Text>
                <Text selectable style={styles.pixCode}>
                  {pixCode}
                </Text>
                <Text style={styles.helper}>
                  Toque e segure o código acima para selecionar e copiar.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.resultLabel}>Link de pagamento</Text>
                <Text selectable style={styles.pixCode}>
                  {paymentLink}
                </Text>
              </>
            )}
          </Card>
        ) : (
          <Card>
            <Text style={styles.warningTitle}>Cobrança criada na Woovi</Text>
            <Text style={styles.helper}>
              A cobrança foi criada, mas o payload não trouxe um BR Code ou link
              reconhecido pelo app. Não pague por outro caminho; volte e atualize
              antes de continuar o teste.
            </Text>
          </Card>
        )}

        <ActionButton
          label="Já paguei — acompanhar Saldo Nexa"
          onPress={() => router.replace('/(app)')}
        />
        <ActionButton
          label="Cancelar e voltar"
          variant="secondary"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Entrada Wallet V1.5</Eyebrow>
      <Title>Pix → USDC → Saldo Nexa</Title>
      <Paragraph>
        O app só permite gerar a cobrança quando sua conta, a Woovi, a Foxbit e
        os controles do piloto estiverem prontos para processar a entrada.
      </Paragraph>

      <Card>
        <Badge tone={readiness?.ready ? 'success' : 'warning'}>
          {checking
            ? 'VALIDANDO JANELA'
            : readiness?.ready
              ? 'PRONTO PARA PIX'
              : 'PIX BLOQUEADO COM SEGURANÇA'}
        </Badge>
        {!checking && !readiness?.ready ? (
          <View style={styles.blockers}>
            {(readiness?.blockers || []).slice(0, 5).map((code) => (
              <Text key={code} style={styles.blocker}>
                • {blockerText(code)}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <Field
        label="Valor em reais"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="Ex.: 100,00"
      />

      <Card>
        <Text style={styles.ruleTitle}>O que acontece depois do pagamento</Text>
        <Text style={styles.ruleText}>1. A Woovi confirma o Pix assinado.</Text>
        <Text style={styles.ruleText}>2. A Nexa registra uma única entrada V1.5.</Text>
        <Text style={styles.ruleText}>3. A Foxbit executa a compra controlada de USDC.</Text>
        <Text style={styles.ruleText}>4. O USDC líquido vira Saldo Nexa operacional.</Text>
        <Text style={styles.ruleText}>
          Saque para blockchain permanece separado e não é executado por esta
          operação.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton
        label="Gerar Pix"
        loading={loading || checking}
        disabled={!readiness?.ready || checking}
        onPress={createPix}
      />
      <ActionButton
        label="Atualizar liberação"
        variant="secondary"
        disabled={loading}
        onPress={refreshReadiness}
      />
      <ActionButton
        label="Voltar"
        variant="secondary"
        disabled={loading}
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  resultLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  resultValue: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 4,
  },
  reference: { color: colors.cyan, marginTop: 5, fontSize: 12 },
  qrWrap: { alignItems: 'center', marginBottom: spacing.md },
  qrBackground: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14 },
  pixCode: {
    color: colors.text,
    backgroundColor: colors.panelSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    fontSize: 11,
    lineHeight: 17,
  },
  helper: { color: colors.muted, marginTop: spacing.sm, lineHeight: 20 },
  warningTitle: { color: colors.warning, fontWeight: '900', fontSize: 17 },
  blockers: { marginTop: spacing.md },
  blocker: { color: colors.warning, marginTop: 6, lineHeight: 20 },
  ruleTitle: { color: colors.text, fontWeight: '900', fontSize: 17 },
  ruleText: { color: colors.muted, lineHeight: 21, marginTop: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
