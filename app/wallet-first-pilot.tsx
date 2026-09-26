import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Card,
  Eyebrow,
  KeyValue,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

async function authorizedRequest(
  accessToken: string,
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Nexa-App-Version': config.appVersion,
      'X-Nexa-App-Build': config.appBuild,
      'X-Nexa-Platform': Platform.OS,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const raw = payload?.message || payload?.error || payload?.code;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'object'
        ? JSON.stringify(raw)
        : String(raw || `Falha HTTP ${response.status}.`);
    throw new Error(message);
  }

  return payload;
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function messageToHex(message: string) {
  const bytes = new TextEncoder().encode(message);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function unique(values: unknown[]) {
  return [...new Set(values.map((value) => String(value || '')).filter(Boolean))];
}

export default function WalletFirstPilotScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const wallet = useMemo(
    () =>
      wallets.find((candidate) =>
        /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || '')),
      ) || null,
    [wallets],
  );

  const [readiness, setReadiness] = useState<any>(null);
  const [providerAudit, setProviderAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [proof, setProof] = useState<any>(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }
      const response = await authorizedRequest(
        session.accessToken,
        '/direct-settlement/wallet-first/usdc-pilot/readiness',
      );
      setReadiness(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar o piloto Wallet-First.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ownershipConfirmed =
    readiness?.pilotProfile?.userControlledWalletConfirmed === true;
  const allowlisted = readiness?.rollout?.allowedByCohort === true;
  const expectedWallet = String(
    readiness?.pilotProfile?.destinationWallet || readiness?.wallet?.address || '',
  );
  const localWallet = String(wallet?.address || '');
  const walletMatches = Boolean(
    expectedWallet &&
      localWallet &&
      normalizeAddress(expectedWallet) === normalizeAddress(localWallet),
  );
  const blockers = unique([
    ...(readiness?.identity?.blockers || []),
    ...(readiness?.pilotProfile?.blockers || []),
    ...(readiness?.wallet?.blockers || []),
    ...(readiness?.provider?.blockers || []),
    ...(readiness?.readiness?.blockers || []),
  ]);

  async function walletProvider(currentWallet: any) {
    if (typeof currentWallet?.getProvider === 'function') {
      return currentWallet.getProvider();
    }
    if (typeof currentWallet?.getEthereumProvider === 'function') {
      return currentWallet.getEthereumProvider();
    }
    throw new Error(
      'A carteira Privy deste aparelho não disponibilizou a assinatura. Feche e abra a Nexa e tente novamente.',
    );
  }

  async function proveOwnership() {
    setError('');
    setWorking(true);
    setProof(null);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      if (!allowlisted) {
        throw new Error('Esta conta não está liberada para o piloto Wallet-First.');
      }
      if (!wallet?.address || !walletMatches) {
        throw new Error(
          'A carteira Privy deste aparelho não corresponde à carteira registrada no piloto.',
        );
      }

      // Gate 1: provider-side evidence. This is read/audit-only and must not
      // mutate the user's legacy settlement profile.
      const audit = await authorizedRequest(
        session.accessToken,
        '/direct-settlement/wallet-first/usdc-pilot/wallet/audit',
        'POST',
        {},
      );
      setProviderAudit(audit);
      if (audit?.walletFirstReady !== true) {
        throw new Error(
          'A auditoria da Privy ainda não confirmou uma wallet individual, não custodial e sem signatários adicionais.',
        );
      }
      if (audit?.legacy?.unchanged !== true) {
        throw new Error('A proteção do perfil legado não foi confirmada.');
      }

      // Gate 2: the customer proves control of the same address locally.
      const challenge = await authorizedRequest(
        session.accessToken,
        '/wallet-v15/wallet-ownership/challenge',
        'POST',
        {},
      );

      if (challenge?.alreadyConfirmed === true) {
        setProof(challenge);
        await load();
        return;
      }

      const destination = String(challenge?.destinationWallet || '');
      const message = String(challenge?.message || '');
      if (!destination || !message) {
        throw new Error('O backend não retornou um challenge de propriedade válido.');
      }
      if (normalizeAddress(destination) !== normalizeAddress(wallet.address)) {
        throw new Error('O challenge pertence a outra carteira. Operação bloqueada.');
      }

      const provider = await walletProvider(wallet);
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('O provedor Privy não está pronto para assinar mensagens.');
      }

      const signature = await provider.request({
        method: 'personal_sign',
        params: [messageToHex(message), destination],
      });
      if (!/^0x[a-fA-F0-9]+$/.test(String(signature || ''))) {
        throw new Error('A carteira não retornou uma assinatura EIP-191 válida.');
      }

      const verified = await authorizedRequest(
        session.accessToken,
        '/wallet-v15/wallet-ownership/verify',
        'POST',
        { signature: String(signature) },
      );
      if (verified?.confirmed !== true) {
        throw new Error('O backend não confirmou o controle da carteira.');
      }

      setProof(verified);
      await load();
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

  if (loading && !readiness) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Validando o piloto Wallet-First...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Badge tone={allowlisted ? 'success' : 'warning'}>
        {allowlisted ? 'PILOTO R$ 10' : 'PILOTO BLOQUEADO'}
      </Badge>
      <View style={styles.topSpace} />
      <Eyebrow>Wallet-First · USDC Polygon</Eyebrow>
      <Title>Você controla a carteira.</Title>
      <Paragraph>
        Primeiro a Nexa confere a wallet diretamente na Privy. Depois você prova
        o controle local com uma assinatura EIP-191. Nenhuma dessas etapas cria
        transação, move USDC ou concede à Nexa acesso à sua chave privada.
      </Paragraph>

      <Card>
        <KeyValue label="Wallet registrada" value={expectedWallet || '—'} />
        <KeyValue label="Wallet neste aparelho" value={localWallet || '—'} />
        <KeyValue label="Endereços conferem" value={walletMatches ? 'Sim' : 'Não'} />
        <KeyValue
          label="Controle comprovado"
          value={ownershipConfirmed ? 'Sim' : 'Pendente'}
        />
        <KeyValue
          label="Limite real de entrada"
          value={`R$ ${Number(readiness?.rollout?.maxEntryBrl || 0).toFixed(2)}`}
        />
        <KeyValue
          label="Execução real pronta"
          value={readiness?.readiness?.realPilotReady === true ? 'Sim' : 'Ainda não'}
        />
      </Card>

      {providerAudit ? (
        <Card>
          <Text style={styles.successTitle}>Auditoria Privy</Text>
          <Text style={styles.successText}>
            Associação ao usuário: {providerAudit?.checks?.userAssociationConfirmed === true ? 'confirmada' : 'não confirmada'}
          </Text>
          <Text style={styles.successText}>
            Não custodial: {providerAudit?.checks?.nonCustodial === true ? 'sim' : 'não'}
          </Text>
          <Text style={styles.successText}>
            Signatários adicionais: {Number(providerAudit?.wallet?.additionalSignersCount || 0)}
          </Text>
          <Text style={styles.successText}>
            Perfil legado preservado: {providerAudit?.legacy?.unchanged === true ? 'sim' : 'não'}
          </Text>
        </Card>
      ) : null}

      {!ownershipConfirmed ? (
        <ActionButton
          label="Auditar e comprovar minha carteira"
          loading={working}
          disabled={!allowlisted || !walletMatches}
          onPress={proveOwnership}
        />
      ) : (
        <Card>
          <Text style={styles.successTitle}>Controle da wallet confirmado.</Text>
          <Text style={styles.successText}>
            A prova criptográfica foi aceita. As etapas financeiras continuam
            protegidas pelos gates do backend e pelo limite de R$ 10.
          </Text>
        </Card>
      )}

      {proof?.verifiedAt ? (
        <Text style={styles.audit}>Verificado em {String(proof.verifiedAt)}</Text>
      ) : null}

      {blockers.length ? (
        <Card>
          <Text style={styles.blockerTitle}>Gates ainda fechados</Text>
          {blockers.map((blocker) => (
            <Text key={blocker} style={styles.blockerText}>
              • {blocker}
            </Text>
          ))}
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ActionButton label="Atualizar validação" variant="secondary" onPress={load} />
      <ActionButton
        label="Voltar para minha conta"
        variant="secondary"
        onPress={() => router.replace('/legacy' as any)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loaderText: { color: colors.muted, textAlign: 'center' },
  topSpace: { height: spacing.lg },
  successTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  successText: { color: colors.muted, lineHeight: 21, marginTop: spacing.sm },
  audit: { color: colors.cyan, fontSize: 12, marginBottom: spacing.md },
  blockerTitle: { color: colors.warning, fontWeight: '900', marginBottom: spacing.sm },
  blockerText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
