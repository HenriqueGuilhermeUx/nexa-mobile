import { useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { walletFirstApi } from '@/lib/walletFirst';
import { colors, radius, spacing } from '@/theme';

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function messageToHex(message: string) {
  const bytes = new TextEncoder().encode(message);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

export default function WalletOwnershipScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const localWallet = useMemo(
    () =>
      wallets.find((wallet) =>
        /^0x[a-fA-F0-9]{40}$/.test(String(wallet?.address || '')),
      ) || null,
    [wallets],
  );

  async function providerFor(wallet: any) {
    if (typeof wallet?.getProvider === 'function') {
      return wallet.getProvider();
    }
    if (typeof wallet?.getEthereumProvider === 'function') {
      return wallet.getEthereumProvider();
    }
    throw new Error('Sua carteira ainda não está pronta para a confirmação.');
  }

  async function proveControl() {
    setError('');
    setWorking(true);

    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou. Entre novamente.');

      // Segurança continua intacta nos bastidores: associação Privy,
      // não-custódia, signers e endereço são auditados no servidor.
      const audit = await nexaApi.auditWallet(session.accessToken);
      const walletAuditReady =
        audit?.walletFirstReady === true ||
        audit?.directSettlementReady === true;
      if (!walletAuditReady) {
        throw new Error(
          'A carteira ainda precisa de uma checagem de segurança. Tente novamente em alguns instantes.',
        );
      }

      const challenge = await walletFirstApi.createOwnershipChallenge(
        session.accessToken,
      );

      if (challenge?.alreadyConfirmed === true) {
        setVerified(true);
        return;
      }

      const destination = normalizeAddress(challenge?.destinationWallet);
      const message = String(challenge?.message || '');
      if (!destination || !message) {
        throw new Error('Não foi possível preparar a confirmação da carteira.');
      }

      const wallet = wallets.find(
        (candidate) =>
          normalizeAddress(candidate?.address) === destination,
      );
      if (!wallet) {
        throw new Error(
          'A carteira vinculada à sua conta não está disponível neste aparelho.',
        );
      }

      const provider = await providerFor(wallet);
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('Sua carteira ainda não está pronta para confirmar.');
      }

      const accounts = await provider
        .request({ method: 'eth_accounts' })
        .catch(() => []);
      if (
        Array.isArray(accounts) &&
        accounts.length > 0 &&
        !accounts.some(
          (account: unknown) =>
            normalizeAddress(account) === destination,
        )
      ) {
        throw new Error(
          'A carteira ativa neste aparelho não corresponde à sua conta Nexa.',
        );
      }

      // Esta assinatura prova controle da wallet; não é transação e não
      // movimenta ativos.
      const signature = await provider.request({
        method: 'personal_sign',
        params: [messageToHex(message), challenge.destinationWallet],
      });

      if (!/^0x[a-fA-F0-9]+$/.test(String(signature || ''))) {
        throw new Error('A confirmação da carteira não foi concluída.');
      }

      const verification = await walletFirstApi.verifyOwnershipSignature(
        session.accessToken,
        String(signature),
      );

      if (verification?.confirmed !== true) {
        throw new Error('A Nexa não conseguiu confirmar sua carteira.');
      }

      // Read-only final check. Provider/liquidity outages never transform this
      // proof into a financial action.
      await walletFirstApi.readiness(session.accessToken).catch(() => null);
      setVerified(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível confirmar sua carteira.',
      );
    } finally {
      setWorking(false);
    }
  }

  if (verified) {
    return (
      <Screen>
        <Brand />
        <View style={styles.topSpace} />
        <Badge tone="success">PRONTO</Badge>
        <Title>Sua Nexa está pronta. 🎉</Title>
        <Paragraph>
          Sua identidade, seu Pix de resgate e sua Cripto Wallet estão
          configurados. Agora você pode adicionar reais e receber USDC na sua
          própria carteira.
        </Paragraph>
        <Card>
          <Text style={styles.readyTitle}>Cripto sem complicação.</Text>
          <Text style={styles.item}>
            A parte técnica fica nos bastidores. Você continua no controle da
            sua carteira e autoriza suas movimentações.
          </Text>
        </Card>
        <ActionButton
          label="Começar"
          onPress={() => router.replace('/legacy' as any)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Badge tone="info">PASSO 4 DE 4</Badge>
      <Title>Proteja sua carteira.</Title>
      <Paragraph>
        Confirme que esta Cripto Wallet pertence a você. Isso não movimenta
        dinheiro, não transfere USDC e não dá à Nexa acesso aos seus ativos.
      </Paragraph>

      <Card>
        <Text style={styles.cardTitle}>Sua confirmação</Text>
        <Text style={styles.item}>
          Você verá um pedido de assinatura da carteira. Ele serve apenas para
          provar que você controla este endereço.
        </Text>
        {localWallet?.address ? (
          <Text style={styles.address}>
            {String(localWallet.address).slice(0, 10)}…
            {String(localWallet.address).slice(-8)}
          </Text>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label="Confirmar minha carteira"
        loading={working}
        onPress={proveControl}
      />
      {working ? <ActivityIndicator color={colors.primary} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.md },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  readyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  item: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  address: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
