import { useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useFundWallet } from '@privy-io/expo/ui';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { polygon } from 'viem/chains';

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
import { normalizeWalletAddress } from '@/lib/walletFirstActions';
import { colors, radius, spacing } from '@/theme';

function parseUsdc(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CardFundingScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const { fundWallet } = useFundWallet();
  const [amount, setAmount] = useState('25');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const amountUsdc = useMemo(() => parseUsdc(amount), [amount]);

  async function expectedWallet() {
    const session = await loadNexaSession();
    if (!session) throw new Error('Sua sessão Nexa expirou.');

    const [profileResponse, meResponse] = await Promise.all([
      nexaApi.directProfile(session.accessToken),
      nexaApi.me(session.accessToken),
    ]);
    const profile = profileResponse?.profile || profileResponse || {};
    const me = meResponse?.user || meResponse || {};
    const expected = String(
      profile?.wallet?.address || profile?.destinationWallet || me?.walletAddress || '',
    ).trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(expected)) {
      throw new Error('Sua carteira Nexa ainda não está pronta para receber.');
    }

    const recovered = wallets.some(
      (wallet) => normalizeWalletAddress(wallet?.address) === normalizeWalletAddress(expected),
    );
    if (!recovered) {
      router.push('/wallet-recovery' as any);
      throw new Error('Confirme sua identidade para continuar com a mesma carteira Nexa.');
    }
    return expected;
  }

  async function openCheckout() {
    setError('');
    setCompleted(false);
    if (!(amountUsdc > 0)) {
      setError('Informe quanto USDC deseja comprar.');
      return;
    }

    setWorking(true);
    try {
      const address = await expectedWallet();
      await fundWallet({
        address,
        chain: polygon,
        asset: 'USDC',
        amount: String(Number(amountUsdc.toFixed(6))),
        defaultPaymentMethod: 'card',
        card: { preferredProvider: 'moonpay' },
        moonpay: {
          useSandbox: false,
          uiConfig: {
            theme: 'dark',
            accentColor: '#7C5CFC',
          },
        },
      });
      setCompleted(true);
    } catch (caught: any) {
      const code = String(caught?.code || '').toLowerCase();
      if (code === 'funding_flow_cancelled' || code.includes('cancel')) return;
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível abrir o pagamento por cartão agora.',
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen>
      <Eyebrow>Adicionar dinheiro</Eyebrow>
      <Title>Comprar USDC com cartão.</Title>
      <Paragraph>
        Escolha quanto USDC deseja receber. No checkout você verá o valor na moeda
        disponível para o seu pagamento e poderá usar os métodos oferecidos pelo parceiro.
      </Paragraph>

      <Card>
        <Text style={styles.label}>Quanto quer receber?</Text>
        <Field
          label="USDC"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Ex.: 25"
        />
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Direto na sua carteira Nexa</Text>
          <Text style={styles.infoText}>
            O provedor de pagamento mostra a cotação, taxas e métodos disponíveis antes da confirmação.
          </Text>
        </View>
      </Card>

      {completed ? (
        <Card>
          <Badge tone="success">CHECKOUT CONCLUÍDO</Badge>
          <Text style={styles.successText}>
            Assim que o provedor concluir a compra, o saldo aparecerá na sua carteira.
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton
        label="Continuar com cartão"
        loading={working}
        onPress={openCheckout}
      />
      <ActionButton
        label="Voltar"
        variant="secondary"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '900', marginBottom: spacing.sm },
  infoBox: {
    borderRadius: radius.md,
    backgroundColor: colors.panelSoft,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoTitle: { color: colors.text, fontWeight: '900' },
  infoText: { color: colors.muted, lineHeight: 20, marginTop: 5 },
  successText: { color: colors.text, lineHeight: 21, marginTop: spacing.md },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
