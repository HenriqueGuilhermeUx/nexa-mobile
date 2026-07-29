import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

type Operation = 'entry' | 'exit';
type Result =
  | { kind: 'redemption'; payload: any }
  | { kind: 'direct-order'; payload: any };

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

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function NewOrderScreen() {
  const [operation, setOperation] = useState<Operation>('entry');
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) throw new Error('Sua sessão Nexa expirou.');
        const response = await nexaApi.directProfile(session.accessToken);
        setProfile(profileFrom(response));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível identificar o perfil da conta.',
        );
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  const legacy = isLegacyProfile(profile);

  async function submit() {
    setError('');
    const parsed = parseAmount(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (legacy && !pixKey.trim()) {
      setError('Informe a chave Pix que receberá o valor final.');
      return;
    }

    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');

      if (legacy) {
        const response = await nexaApi.requestPixRedemption(
          session.accessToken,
          {
            amountUsdc: parsed,
            pixKey: pixKey.trim(),
          },
        );
        setResult({ kind: 'redemption', payload: response });
        return;
      }

      const clientRequestId = Crypto.randomUUID();
      const response =
        operation === 'entry'
          ? await nexaApi.createEntryOrder(session.accessToken, {
              grossBrl: parsed,
              clientRequestId,
            })
          : await nexaApi.createExitOrder(session.accessToken, {
              amountUsdc: parsed,
              clientRequestId,
            });
      setResult({ kind: 'direct-order', payload: response });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível registrar a operação.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (result?.kind === 'redemption') {
    const redemption = result.payload || {};
    const fees = redemption.estimatedFees || {};
    return (
      <Screen>
        <Badge tone="success">RESGATE SOLICITADO</Badge>
        <View style={styles.topSpace} />
        <Title>Seu USDC foi reservado.</Title>
        <Paragraph>
          A estimativa em reais ainda não é uma promessa de pagamento. A Nexa
          venderá exatamente o USDC reservado e confirmará o valor final após a
          entrada real do BRL, em até 1 dia útil.
        </Paragraph>

        <Card>
          <Text style={styles.resultLabel}>USDC reservado</Text>
          <Text style={styles.resultValue}>
            {formatUsdc(redemption.reservedUsdc)}
          </Text>
          <Text style={styles.resultLabel}>Estimativa líquida em BRL</Text>
          <Text style={styles.resultValue}>
            {formatBrl(redemption.estimatedPayoutBrl)}
          </Text>
          <Text style={styles.estimateNotice}>ESTIMATIVA — NÃO GARANTIDA</Text>
          <Text style={styles.resultLabel}>Fee Nexa estimada</Text>
          <Text style={styles.resultValue}>
            {formatBrl(fees.nexaFeeBrl)} ({Number(fees.nexaFeePercent || 1.5)}%)
          </Text>
          <Text style={styles.resultLabel}>Pix Out estimado</Text>
          <Text style={styles.resultValue}>
            {formatBrl(fees.pixOutFeeBrl)}
          </Text>
          <Text style={styles.resultLabel}>Identificador</Text>
          <Text selectable style={styles.reference}>
            {redemption.paymentId || '—'}
          </Text>
        </Card>

        <Card>
          <Text style={styles.ruleTitle}>Como o valor final será definido</Text>
          <Text style={styles.ruleText}>
            BRL líquido realmente recebido na venda − fee Nexa de 1,5% − custo
            real do Pix Out.
          </Text>
          <Text style={styles.ruleText}>
            A Nexa não usa caixa próprio para cobrir diferença entre estimativa e
            venda real. Isso protege a continuidade da operação e mantém as
            contas corretas.
          </Text>
        </Card>

        <ActionButton
          label="Acompanhar na atividade"
          onPress={() => router.replace('/(app)/activity')}
        />
        <ActionButton
          label="Voltar"
          variant="secondary"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  if (result?.kind === 'direct-order') {
    const response = result.payload || {};
    const order = response.order || response;
    const fundsMoved = response.fundsMoved === true;
    const executionEnabled = response.executionEnabled === true;
    return (
      <Screen>
        <Badge tone={fundsMoved ? 'danger' : 'success'}>
          {fundsMoved ? 'REVISÃO NECESSÁRIA' : 'SOLICITAÇÃO REGISTRADA'}
        </Badge>
        <View style={styles.topSpace} />
        <Title>Nenhum dinheiro foi movimentado.</Title>
        <Paragraph>
          A solicitação foi registrada para acompanhamento. Enquanto a execução
          direta estiver em homologação, ela não representa compra, venda, Pix ou
          crédito final.
        </Paragraph>
        <Card>
          <Text style={styles.resultLabel}>Identificador</Text>
          <Text selectable style={styles.reference}>
            {order.id || order.orderId || '—'}
          </Text>
          <Text style={styles.resultLabel}>Status</Text>
          <Text style={styles.resultValue}>{order.status || 'created'}</Text>
          <Text style={styles.resultLabel}>Plano aplicado pelo backend</Text>
          <Text style={styles.resultValue}>{order.plan || 'FREE'}</Text>
          <Text style={styles.resultLabel}>Execução habilitada</Text>
          <Text style={styles.resultValue}>
            {executionEnabled ? 'Sim' : 'Não'}
          </Text>
          <Text style={styles.resultLabel}>Fundos movimentados</Text>
          <Text style={styles.resultValue}>{fundsMoved ? 'Sim' : 'Não'}</Text>
        </Card>
        <ActionButton
          label="Registrar outra solicitação"
          variant="secondary"
          onPress={() => {
            setResult(null);
            setAmount('');
          }}
        />
      </Screen>
    );
  }

  if (profileLoading) {
    return (
      <Screen>
        <Eyebrow>Preparando sua operação</Eyebrow>
        <Title>Validando as regras da sua conta.</Title>
        <Paragraph>
          A Nexa escolhe automaticamente o fluxo compatível com seu perfil, sem
          alterar sua carteira ou seu histórico.
        </Paragraph>
      </Screen>
    );
  }

  if (legacy) {
    return (
      <Screen>
        <Eyebrow>Resgate Pix</Eyebrow>
        <Title>Quanto USDC deseja converter?</Title>
        <Paragraph>
          Primeiro você escolhe o USDC. O valor em reais exibido após a
          solicitação será apenas uma estimativa. O valor final aparecerá quando
          a venda real for conciliada.
        </Paragraph>

        <Field
          label="Quantidade em USDC"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Ex.: 45,60"
        />
        <Field
          label="Chave Pix"
          value={pixKey}
          onChangeText={setPixKey}
          autoCapitalize="none"
          placeholder="CPF, e-mail, telefone ou chave aleatória"
        />

        <Card>
          <Text style={styles.ruleTitle}>Regra do resgate</Text>
          <Text style={styles.ruleText}>
            Prazo de processamento: até 1 dia útil. Fee Nexa: 1,5% sobre o BRL
            líquido realmente recebido na venda. Pix Out: custo efetivo do
            provedor.
          </Text>
          <Text style={styles.ruleText}>
            Antes da venda, qualquer valor em reais é somente estimativo. Depois
            da venda, o app mostra BRL recebido, fee, Pix Out e valor final.
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton
          label="Solicitar resgate"
          loading={loading}
          onPress={submit}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Operação em homologação</Eyebrow>
      <Title>Registre sua solicitação.</Title>
      <Paragraph>
        Sua conta usa carteira individual. A Nexa registra a solicitação e as
        regras aplicáveis, mas não movimenta fundos até a liquidação direta estar
        homologada.
      </Paragraph>

      <Text style={styles.sectionLabel}>Operação</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Choice
            label="Entrar: Pix → USDC"
            selected={operation === 'entry'}
            onPress={() => {
              setOperation('entry');
              setAmount('');
            }}
          />
        </View>
        <View style={styles.flex}>
          <Choice
            label="Sair: USDC → Pix"
            selected={operation === 'exit'}
            onPress={() => {
              setOperation('exit');
              setAmount('');
            }}
          />
        </View>
      </View>

      <Field
        label={operation === 'entry' ? 'Valor em reais' : 'Quantidade em USDC'}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={operation === 'entry' ? 'Ex.: 500,00' : 'Ex.: 100,00'}
      />

      <Card>
        <Text style={styles.ruleTitle}>Regras atuais</Text>
        <Text style={styles.ruleText}>
          Entrada Free: 8%. Entrada Pro: 2%, mínimo de R$ 9,90 e teto de
          R$ 750,00. Saída Free: 1,5%. Saída Pro: 1%.
        </Text>
        <Text style={styles.ruleText}>
          A cotação é informativa. O valor final nasce da operação real e da
          conciliação do provedor.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton
        label="Registrar solicitação"
        loading={loading}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  sectionLabel: {
    color: colors.text,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  flex: { flex: 1 },
  choice: {
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    justifyContent: 'center',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: { color: colors.muted, fontWeight: '800', textAlign: 'center' },
  choiceTextSelected: { color: colors.text },
  ruleTitle: { color: colors.text, fontWeight: '900', fontSize: 17 },
  ruleText: { color: colors.muted, lineHeight: 21, marginTop: spacing.sm },
  estimateNotice: {
    color: colors.warning,
    fontWeight: '900',
    fontSize: 11,
    marginTop: 6,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  resultValue: { color: colors.text, fontWeight: '900', marginTop: 4 },
  reference: { color: colors.text, fontWeight: '800', marginTop: 4, fontSize: 12 },
});
