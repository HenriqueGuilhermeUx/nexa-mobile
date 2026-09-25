import { useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Badge, Card, Paragraph, Screen, Title } from '@/components/ui';
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

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export default function WalletOwnershipScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [proof, setProof] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);

  const localAddresses = useMemo(
    () => wallets.map((wallet) => normalizeAddress(wallet?.address)).filter(Boolean),
    [wallets],
  );

  async function providerFor(wallet: any) {
    if (typeof wallet?.getProvider === 'function') {
      return wallet.getProvider();
    }
    if (typeof wallet?.getEthereumProvider === 'function') {
      return wallet.getEthereumProvider();
    }
    throw new Error(
      'A carteira Privy deste dispositivo não expôs o provedor de assinatura. Atualize a sessão e tente novamente.',
    );
  }

  async function proveControl() {
    setError('');
    setWorking(true);
    setVerified(false);

    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou. Entre novamente.');

      // 1) O backend consulta a API da Privy e bloqueia qualquer wallet que não
      // esteja associada ao usuário, que seja custodial ou tenha signers extras.
      const auditResult = await nexaApi.auditWallet(session.accessToken);
      setAudit(auditResult);
      if (auditResult?.directSettlementReady !== true) {
        throw new Error(
          'A auditoria da Privy ainda não confirmou esta wallet como individual, não custodial e sem signatários adicionais.',
        );
      }

      // 2) O backend gera um challenge EIP-191 de uso único e curta duração.
      const challenge = await walletFirstApi.createOwnershipChallenge(
        session.accessToken,
      );

      if (challenge?.alreadyConfirmed === true) {
        const ready = await walletFirstApi.readiness(session.accessToken);
        setReadiness(ready);
        setProof(challenge);
        setVerified(true);
        return;
      }

      const destination = normalizeAddress(challenge?.destinationWallet);
      const message = String(challenge?.message || '');
      if (!destination || !message) {
        throw new Error('A Nexa não retornou um challenge de propriedade válido.');
      }

      const wallet = wallets.find(
        (candidate) => normalizeAddress(candidate?.address) === destination,
      );
      if (!wallet) {
        throw new Error(
          `A wallet vinculada à Nexa (${challenge.destinationWallet}) não está disponível neste dispositivo.`,
        );
      }

      // 3) Somente o dispositivo do usuário pode produzir a assinatura. Não há
      // transação, approve de token, transferência ou acesso à chave privada.
      const provider = await providerFor(wallet);
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('O provedor Privy não está pronto para assinar mensagens.');
      }

      const currentAccounts = await provider
        .request({ method: 'eth_accounts' })
        .catch(() => []);
      if (
        Array.isArray(currentAccounts) &&
        currentAccounts.length > 0 &&
        !currentAccounts.some((account: unknown) => normalizeAddress(account) === destination)
      ) {
        throw new Error('A wallet ativa no dispositivo não corresponde à wallet vinculada à Nexa.');
      }

      const signature = await provider.request({
        method: 'personal_sign',
        params: [messageToHex(message), challenge.destinationWallet],
      });
      if (!/^0x[a-fA-F0-9]+$/.test(String(signature || ''))) {
        throw new Error('A wallet não retornou uma assinatura EIP-191 válida.');
      }

      // 4) O servidor recupera o endereço da assinatura e só confirma se ele for
      // exatamente a destinationWallet registrada no perfil Wallet V1.5.
      const verification = await walletFirstApi.verifyOwnershipSignature(
        session.accessToken,
        String(signature),
      );
      if (verification?.confirmed !== true) {
        throw new Error('A prova de controle da wallet não foi confirmada.');
      }
      setProof(verification);

      // 5) Nova auditoria + readiness para que a tela nunca trate a assinatura,
      // sozinha, como autorização para movimentar dinheiro.
      const finalAudit = await nexaApi.auditWallet(session.accessToken);
      setAudit(finalAudit);
      const ready = await walletFirstApi.readiness(session.accessToken);
      setReadiness(ready);
      setVerified(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível comprovar o controle da carteira.',
      );
    } finally {
      setWorking(false);
    }
  }

  const blockers = uniqueStrings([
    ...(readiness?.identity?.blockers || []),
    ...(readiness?.pilotProfile?.blockers || []),
    ...(readiness?.wallet?.blockers || []),
    ...(readiness?.readiness?.dryRunBlockers || []),
  ]);

  return (
    <Screen>
      <Badge tone={verified ? 'success' : 'info'}>
        {verified ? 'CARTEIRA COMPROVADA' : 'PROVA DE CONTROLE'}
      </Badge>
      <View style={styles.topSpace} />
      <Title>Confirme que esta carteira é sua.</Title>
      <Paragraph>
        A Nexa pedirá uma assinatura de mensagem EIP-191. Isso não movimenta
        USDC, não cria transação e não concede à Nexa acesso à sua chave privada.
      </Paragraph>

      <Card>
        <Text style={styles.cardTitle}>Proteções desta etapa</Text>
        <Text style={styles.item}>• auditoria da wallet diretamente na Privy;</Text>
        <Text style={styles.item}>• bloqueio se houver custódia ou signer adicional;</Text>
        <Text style={styles.item}>• challenge único, vinculado ao seu usuário e endereço;</Text>
        <Text style={styles.item}>• assinatura local no seu dispositivo;</Text>
        <Text style={styles.item}>• verificação criptográfica no backend.</Text>
      </Card>

      {localAddresses.length ? (
        <Card>
          <Text style={styles.label}>Wallet disponível neste dispositivo</Text>
          <Text selectable style={styles.address}>{localAddresses[0]}</Text>
        </Card>
      ) : null}

      {audit ? (
        <Card>
          <Text style={styles.cardTitle}>Auditoria Privy</Text>
          <Text style={styles.item}>
            Não custodial: {audit?.wallet?.nonCustodial === true ? 'sim' : 'não'}
          </Text>
          <Text style={styles.item}>
            Signers adicionais: {Number(audit?.wallet?.additionalSignersCount || 0)}
          </Text>
          <Text style={styles.item}>
            Associação ao usuário: {audit?.checks?.userAssociationConfirmed === true ? 'confirmada' : 'não confirmada'}
          </Text>
        </Card>
      ) : null}

      {proof ? (
        <Card>
          <Text style={styles.cardTitle}>Prova criptográfica</Text>
          <Text style={styles.item}>Método: EIP-191 / personal_sign</Text>
          <Text style={styles.item}>Rede declarada: Polygon (137)</Text>
          <Text selectable style={styles.address}>
            {proof?.destinationWallet || proof?.recoveredAddress || '—'}
          </Text>
        </Card>
      ) : null}

      {verified ? (
        <Card>
          <Text style={styles.cardTitle}>Wallet-First</Text>
          <Text style={styles.item}>
            Controle da wallet: confirmado pelo usuário.
          </Text>
          <Text style={styles.item}>
            Execução financeira: {blockers.length === 0 ? 'pronta para o piloto' : 'ainda bloqueada por segurança'}.
          </Text>
          {blockers.length > 0 ? (
            <Text style={styles.blockers}>Bloqueios restantes: {blockers.join(', ')}</Text>
          ) : null}
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton
        label={verified ? 'Verificar novamente' : 'Comprovar minha carteira'}
        loading={working}
        onPress={proveControl}
      />
      {working ? <ActivityIndicator color={colors.primary} /> : null}
      <ActionButton
        label="Voltar para a Nexa"
        variant="secondary"
        onPress={() => router.replace('/legacy' as any)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSpace: { height: spacing.lg },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  item: { color: colors.muted, lineHeight: 22, marginTop: spacing.xs },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  address: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  blockers: {
    color: colors.warning,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
