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

      // Do not pin a single provider here. The Privy Funding configuration is
      // the source of truth and may route between MoonPay, Meld and any other
      // provider enabled for the user's region/payment method.
      await fundWallet({
        address,
        asset: 'USDC',
        chain: polygon as any,
        defaultPaymentMethod: 'card',
      } as any);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught || '');
      if (!message.toLowerCase().includes('cancel')) {
        setError(message || 'Não foi possível abrir o pagamento agora.');
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <Eyebrow>ADICIONAR DINHEIRO</Eyebrow>
      <Title>Cartão, Apple Pay ou Google Pay.</Title>
      <Paragraph>
        Escolha a forma de pagamento disponível para você. O valor é convertido e entregue em USDC diretamente na sua carteira Nexa.
      </Paragraph>

      <Card>
        <Badge tone="info">BRL DISPONÍVEL</Badge>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, marginTop: spacing.md }}>
          Funding Nexa
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 21, marginTop: spacing.sm }}>
          A Privy seleciona automaticamente entre os provedores habilitados para sua região e forma de pagamento. MoonPay continua disponível e o Meld pode ampliar cobertura e roteamento sem prender a Nexa a um único parceiro.
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 21, marginTop: spacing.sm }}>
          O provedor escolhido pode solicitar dados adicionais de pagamento ou verificação antes de concluir a compra.
        </Text>
      </Card>

      {error ? (
        <Text style={{ color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }}>
          {error}
        </Text>
      ) : null}

      <ActionButton label="Continuar" loading={working} onPress={startFunding} />
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
