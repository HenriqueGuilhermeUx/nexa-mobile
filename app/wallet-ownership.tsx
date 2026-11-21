import { useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router, useLocalSearchParams } from 'expo-router';
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
  const params = useLocalSearchParams<{ returnTo?: string | string[]; amount?: string | string[] }>();
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const savedAmount = Array.isArray(params.amount) ? params.amount[0] : params.amount || '';
  function continueAfterProof() {
    if (returnTo === 'new-order') {
      router.replace({
        pathname: '/(app)/new-order' as any,
        params: { amount: savedAmount },
      });
      return;
    }
    router.replace('/legacy' as any);
  }
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

      // Direct-settlement audit is intentionally restricted to pilots.
      // EIP-191 challenge/verify is the authoritative public Wallet-First proof,
      // and still checks the destination address and user's signature on server.
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
      // Legacy accounts are intentionally excluded from direct-settlement audit.
      // This is not a wallet-ownership failure and must not lock them out.
      if ((caught as { code?: string } | null)?.code === 'LEGACY_BETA_USER') {
        router.replace('/legacy' as any);
        return;
      }
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
        <Title>Sua Nexa está pronta.</Title>
        <Paragraph>
          Carteira confirmada. Agora você pode continuar com segurança.
          Esta assinatura não movimentou dinheiro.
        </Paragraph>
        <Card>
          <Text style={styles.readyTitle}>Sua wallet. Seus ativos.</Text>
          <Text style={styles.item}>
            A parte técnica fica nos bastidores. Autorizações sensíveis continuam sob seu controle.
          </Text>
        </Card>
        <ActionButton
          label={returnTo === 'new-order' ? 'Continuar meu Pix' : 'Começar'}
          onPress={continueAfterProof}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.topSpace} />
      <Badge tone="info">PASSO 4 DE 4</Badge>
      <Title>Uma confirmação rápida de segurança</Title>
      <Paragraph>
        Confirme uma única vez que esta carteira é sua. Você só vai assinar uma mensagem: não há Pix, taxa ou transferência nesta etapa.
      </Paragraph>

      <Card>
        <Text style={styles.cardTitle}>O que vai acontecer?</Text>
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
