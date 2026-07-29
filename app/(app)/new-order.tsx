import { useState } from 'react';
import * as Crypto from 'expo-crypto';
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

function parseAmount(value: string) {
  const trimmed = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  return Number(
    trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed,
  );
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  async function submit() {
    setError('');
    const parsed = parseAmount(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }

    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
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
      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível registrar a intenção.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const order = result.order || result;
    const fundsMoved = result.fundsMoved === true;
    const executionEnabled = result.executionEnabled === true;
    return (
      <Screen>
        <Badge tone={fundsMoved ? 'danger' : 'success'}>
          {fundsMoved ? 'REVISÃO NECESSÁRIA' : 'INTENÇÃO REGISTRADA'}
        </Badge>
        <View style={styles.topSpace} />
        <Title>Nenhum dinheiro foi movimentado.</Title>
        <Paragraph>
          A ordem foi registrada para cotação, reconciliação e acompanhamento.
          Ela não representa compra, venda, Pix ou crédito final.
        </Paragraph>
        <Card>
          <Text style={styles.resultLabel}>Identificador</Text>
          <Text selectable style={styles.resultValue}>
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
          label="Registrar outra intenção"
          variant="secondary"
          onPress={() => {
            setResult(null);
            setAmount('');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Ordem em modo seguro</Eyebrow>
      <Title>Registre sua intenção.</Title>
      <Paragraph>
        A Nexa mostra as regras e cria uma ordem auditável. O plano Free ou Pro
        é resolvido pelo backend a partir da situação real da sua conta.
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
          conciliação.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton
        label="Registrar intenção"
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
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  resultValue: { color: colors.text, fontWeight: '900', marginTop: 4 },
});
