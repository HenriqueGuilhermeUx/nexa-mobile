import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { assertGlobalCapability } from '@/lib/globalCapabilities';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

export default function ReceiveUsdcScreen() {
  const [walletAddress, setWalletAddress] = useState('');
  const [network, setNetwork] = useState('Polygon');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) throw new Error('Sua sessão Nexa expirou.');

        await assertGlobalCapability(session.accessToken, 'receiveUsdc');
        const response = await nexaApi.me(session.accessToken);
        const profile = response?.user || response || {};
        const address = String(
          profile?.wallet?.address || profile?.walletAddress || '',
        ).trim();

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new Error(
            'Sua wallet Nexa ainda não está pronta para receber USDC.',
          );
        }

        if (!mounted) return;
        setWalletAddress(address);
        setNetwork(
          String(
            profile?.wallet?.network || profile?.walletNetwork || 'Polygon',
          ).trim() || 'Polygon',
        );
      } catch (caught) {
        if (!mounted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível carregar sua wallet agora.',
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen>
      <Brand />
      <Eyebrow>NEXA GLOBAL · RECEBER</Eyebrow>
      <Title>Receber USDC.</Title>
      <Paragraph>
        Use sua wallet Nexa para receber USDC de uma wallet ou exchange externa
        compatível. Confira a rede antes de enviar.
      </Paragraph>

      <Card>
        <Badge tone={walletAddress ? 'success' : 'warning'}>
          {loading
            ? 'CONFIRMANDO WALLET'
            : walletAddress
              ? 'WALLET PRONTA'
              : 'WALLET INDISPONÍVEL'}
        </Badge>
        <Text style={styles.label}>Rede</Text>
        <Text style={styles.value}>{network}</Text>
        <Text style={styles.label}>Endereço da wallet</Text>
        <Text selectable style={styles.address}>
          {walletAddress || '—'}
        </Text>
      </Card>

      <Card>
        <Text style={styles.noteTitle}>Antes de enviar</Text>
        <Text style={styles.note}>
          Envie somente USDC pela rede indicada acima. Ativos ou redes
          incompatíveis podem não ser recuperáveis. A Nexa considera o saldo
          recebido somente após a confirmação on-chain na sua própria wallet.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!walletAddress && !loading ? (
        <ActionButton
          label="Verificar minha wallet"
          onPress={() => router.push('/wallet-recovery' as any)}
        />
      ) : null}
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.mutedStrong,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 5,
  },
  address: {
    color: colors.cyan,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
