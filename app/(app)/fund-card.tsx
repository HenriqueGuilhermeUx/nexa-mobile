import { useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useFundWallet } from '@privy-io/expo/ui';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { polygon } from 'viem/chains';

import { ActionButton, Badge, Brand, Card, Eyebrow, Paragraph, Screen, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export default function FundCardScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const { fundWallet } = useFundWallet();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function startFunding() {
    setError('');
    setWorking(true);
    try {
      const wallet = wallets.length === 1 ? wallets[0] : wallets.find((candidate) => Boolean(candidate?.address));
      const address = String(wallet?.address || '').trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        router.push('/wallet-recovery' as any);
        throw new Error('Confirme sua identidade para usar a mesma carteira Nexa.');
      }

      // This screen is card / digital-wallet only. Pix remains on the native
      // Nexa + Woovi flow. Do not pin MoonPay: Privy/Meld may choose the best
      // enabled card provider for the customer's region and payment method.
      await fundWallet({
        address,
        asset: 'USDC',
        chain: polygon as any,
        defaultPaymentMethod: 'card',
      } as any);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught || '');
      if (!message.toLowerCase().includes('cancel')) {
        setError(message || 'Não foi possível abrir o pagamento por cartão agora.');
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <Eyebrow>NEXA GLOBAL · FUNDING</Eyebrow>
      <Title>Add USDC.</Title>
      <Paragraph>
        Use card, Apple Pay or Google Pay when available in your country. The
        funding provider shows the conversion, fees and estimated USDC before
        you confirm.
      </Paragraph>

      <Card>
        <Badge tone="info">CARTÃO E CARTEIRAS DIGITAIS</Badge>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, marginTop: spacing.md }}>
          USDC Funding
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 21, marginTop: spacing.sm }}>
          Nexa uses the funding providers enabled for your region. The provider
          quote is the source of truth for exchange rate, transaction fee,
          network fee, partner fee and the estimated USDC to be delivered.
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 21, marginTop: spacing.sm }}>
          Nexa Global does not create a fiat balance from this purchase. The
          operation is considered credited only when the purchased USDC reaches
          your Nexa wallet.
        </Text>
      </Card>

      {error ? (
        <Text style={{ color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }}>
          {error}
        </Text>
      ) : null}

      <ActionButton label="See funding options" loading={working} onPress={startFunding} />
      <ActionButton label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
