import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

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
  getWalletFirstExitQuote,
  type WalletFirstExitQuote,
} from '@/lib/walletFirstExit';
import { colors, spacing } from '@/theme';

function parseUsdc(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBrl(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatRate(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export default function CashOutScreen() {
  const [amountUsdc, setAmountUsdc] = useState('');
  const [quote, setQuote] = useState<WalletFirstExitQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function requestQuote() {
    setError('');
    setQuote(null);
    const amount = parseUsdc(amountUsdc);
    if (!(amount > 0)) {
      setError('Informe uma quantidade de USDC maior que zero.');
      return;
    }

    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const nextQuote = await getWalletFirstExitQuote(
        session.accessToken,
        amount,
      );
      setQuote(nextQuote);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cotação Nexa indisponível no momento.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <Eyebrow>USDC → PIX</Eyebrow>
      <Title>Sacar para Pix.</Title>
      <Paragraph>
        Informe quanto USDC deseja converter. A Nexa mostra uma única cotação
        final para você decidir.
      </Paragraph>

      <Card>
        <Badge>USDC · POLYGON</Badge>
        <View style={styles.spacer} />
        <Field
          label="Quanto USDC?"
          value={amountUsdc}
          onChangeText={(value) => {
            setAmountUsdc(value);
            setQuote(null);
            setError('');
          }}
          keyboardType="decimal-pad"
          placeholder="Ex.: 2,5"
        />
        <ActionButton
          label={quote ? 'Atualizar cotação' : 'Ver cotação'}
          onPress={requestQuote}
          loading={loading}
        />
      </Card>

      {quote ? (
        <Card style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>{quote.label || 'Cotação Nexa'}</Text>
          <Text style={styles.rate}>
            1 USDC = R$ {formatRate(quote.nexaRateBrl)}
          </Text>
          <Text style={styles.receiveLabel}>Você recebe aproximadamente</Text>
          <Text style={styles.receiveValue}>
            {formatBrl(quote.estimatedPayoutBrl)}
          </Text>
          <Text style={styles.validity}>
            Cotação indicativa válida por {quote.validForSeconds || 30}s. Atualize
            antes de confirmar uma saída.
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label="Voltar"
        variant="secondary"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: { height: spacing.md },
  quoteCard: { backgroundColor: '#11143C' },
  quoteLabel: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  rate: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  receiveLabel: {
    color: colors.muted,
    marginTop: spacing.lg,
    fontSize: 13,
  },
  receiveValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  validity: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
});
