import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useEmbeddedEthereumWallet,
  useSignMessage,
} from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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

type Readiness = any;

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
      'X-Nexa-Platform': 'android',
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
    const message =
      payload?.message || payload?.error || payload?.code || `Falha HTTP ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }

  return payload;
}

function unique(values: unknown[]) {
  return [...new Set(values.map((value) => String(value || '')).filter(Boolean))];
}

export default function WalletFirstPilotScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const { signMessage } = useSignMessage() as any;
  const wallets = (embedded.wallets || []) as any[];
  const wallet = useMemo(
    () =>
      wallets.find((candidate) =>
        /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || '')),
      ) || null,
    [wallets],
  );

  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);

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

  const blockers = unique([
    ...(readiness?.identity?.blockers || []),
    ...(readiness?.pilotProfile?.blockers || []),
    ...(readiness?.wallet?.blockers || []),
    ...(readiness?.provider?.blockers || []),
    ...(readiness?.readiness?.blockers || []),
  ]);

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
      expectedWallet.toLowerCase() === localWallet.toLowerCase(),
  );

  async function proveOwnership() {
    setError('');
    setWorking(true);
    setLastResult(null);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      if (!wallet?.address) {
        throw new Error('A carteira Privy deste aparelho ainda não está disponível.');
      }
      if (!allowlisted) {
        throw new Error('Esta conta não está liberada para o piloto Wallet-First.');
      }

      const challenge = await authorizedRequest(
        session.accessToken,
        '/wallet-v15/wallet-ownership/challenge',
        'POST',
        {},
      );

      const destination = String(challenge?.destinationWallet || expectedWallet || '');
      if (
        !destination ||
        destination.toLowerCase() !== String(wallet.address).toLowerCase()
      ) {
        throw new Error(
          'A wallet Privy deste aparelho não corresponde à wallet registrada no piloto.',
        );
      }
      if (!challenge?.message) {
        if (challenge?.alreadyConfirmed === true) {
          setLastResult(challenge);
          await load();
          return;
        }
        throw new Error('O backend não retornou um challenge de propriedade válido.');
      }

      const signed = await signMessage({
        message: String(challenge.message),
        appearance: {
          title: 'Confirmar minha carteira Nexa',
          description:
            'Esta assinatura comprova controle da carteira. Ela não movimenta USDC e não autoriza pagamento.',
          buttonText: 'Assinar confirmação',
        },
      });
      const signature = String(signed?.signature || signed || '');
      if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
        throw new Error('A Privy não retornou uma assinatura EIP-191 válida.');
      }

      const verified = await authorizedRequest(
        session.accessToken,
        '/wallet-v15/wallet-ownership/verify',
        'POST',
        { signature },
      );
      if (verified?.confirmed !== true) {
        throw new Error('O backend não confirmou a propriedade da carteira.');
      }

      setLastResult(verified);
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
        Antes de qualquer compra real, a Nexa exige uma prova EIP-191 assinada
        pela sua própria carteira Privy. Esta etapa não cria transação, não move
        fundos e não dá à Nexa acesso à sua chave privada.
      </Paragraph>

      <Card>
        <KeyValue label="Wallet registrada" value={expectedWallet || '—'} />
        <KeyValue label="Wallet neste aparelho" value={localWallet || '—'} />
        <KeyValue
          label="Endereços conferem"
          value={walletMatches ? 'Sim' : 'Não'}
        />
        <KeyValue
          label="Controle comprovado"
          value={ownershipConfirmed ? 'Sim' : 'Pendente'}
        />
        <KeyValue
          label="Limite de entrada"
          value={`R$ ${Number(readiness?.rollout?.maxEntryBrl || 0).toFixed(2)}`}
        />
        <KeyValue
          label="Piloto real pronto"
          value={readiness?.readiness?.realPilotReady === true ? 'Sim' : 'Ainda não'}
        />
      </Card>

      {!ownershipConfirmed ? (
        <ActionButton
          label="Comprovar controle da minha carteira"
          loading={working}
          disabled={!allowlisted || !walletMatches}
          onPress={proveOwnership}
        />
      ) : (
        <Card>
          <Text style={styles.successTitle}>Controle da wallet confirmado.</Text>
          <Text style={styles.successText}>
            A próxima etapa será liberar, de forma controlada, o depósito real de
            R$ 10 → compra USDC → entrega Polygon nesta carteira.
          </Text>
        </Card>
      )}

      {lastResult?.verifiedAt ? (
        <Text style={styles.audit}>Verificado em {String(lastResult.verifiedAt)}</Text>
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
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
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
