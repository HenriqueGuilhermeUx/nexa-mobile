import { useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
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
  confirmDirectTransfer,
  normalizeWalletAddress,
  prepareDirectTransfer,
  sendPreparedWalletTransaction,
} from '@/lib/walletFirstActions';
import { colors, spacing } from '@/theme';

function parseUsdc(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsdc(value: unknown) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} USDC`;
}

function shortAddress(value: unknown) {
  const address = String(value || '');
  return address.length > 14
    ? `${address.slice(0, 8)}…${address.slice(-6)}`
    : address || '—';
}

export default function SendNexaScreen() {
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [prepared, setPrepared] = useState<any>(null);
  const [txHash, setTxHash] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function providerFor(address: string) {
    const expected = normalizeWalletAddress(address);
    const wallet = wallets.find(
      (candidate) => normalizeWalletAddress(candidate?.address) === expected,
    );
    if (!wallet) {
      throw new Error('A carteira vinculada à Nexa não está disponível neste dispositivo.');
    }
    if (typeof wallet.getProvider === 'function') return wallet.getProvider();
    if (typeof wallet.getEthereumProvider === 'function') {
      return wallet.getEthereumProvider();
    }
    throw new Error('A carteira deste dispositivo não expôs o provedor de assinatura.');
  }

  async function review() {
    setError('');
    setPrepared(null);
    setConfirmation(null);
    setTxHash('');
    const amountUsdc = parseUsdc(amount);
    const receiverUsername = username.trim().replace(/^@/, '');
    if (!receiverUsername) {
      setError('Informe o @username do destinatário.');
      return;
    }
    if (!(amountUsdc > 0)) {
      setError('Informe uma quantidade de USDC maior que zero.');
      return;
    }

    setWorking(true);
    try {
      const session = await loadNexaSession();
      if (!session) throw new Error('Sua sessão Nexa expirou.');
      const response = await prepareDirectTransfer(
        session.accessToken,
        receiverUsername,
        amountUsdc,
      );
      if (response?.route !== 'ONCHAIN_DIRECT' || !response?.transactionRequest) {
        throw new Error('A transferência direta Wallet-First não está disponível para este destinatário.');
      }
      setPrepared(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível preparar a transferência.');
    } finally {
      setWorking(false);
    }
  }

  async function verify(hash: string) {
    const session = await loadNexaSession();
    if (!session) throw new Error('Sua sessão Nexa expirou.');
    const result = await confirmDirectTransfer(
      session.accessToken,
      prepared.receiver.username,
      Number(prepared.amountUsdc),
      hash,
    );
    setConfirmation(result);
    return result;
  }

  async function signAndSend() {
    if (!prepared?.transactionRequest) return;
    setError('');
    setWorking(true);
    try {
      const provider = await providerFor(prepared.sender.walletAddress);
      const hash = await sendPreparedWalletTransaction(
        provider,
        prepared.transactionRequest,
      );
      setTxHash(hash);
      await verify(hash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a transferência.');
    } finally {
      setWorking(false);
    }
  }

  async function checkAgain() {
    if (!txHash) return;
    setError('');
    setWorking(true);
    try {
      await verify(txHash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível verificar a transferência.');
    } finally {
      setWorking(false);
    }
  }

  const completed = confirmation?.completed === true;

  return (
    <Screen>
      <Brand />
      <Eyebrow>NEXA → NEXA</Eyebrow>
      <Title>Enviar USDC.</Title>
      <Paragraph>
        Envie direto da sua carteira para a carteira de outro usuário Nexa. A
        Nexa prepara a operação; somente você pode assiná-la.
      </Paragraph>

      <Card>
        <Badge tone="success">WALLET-FIRST · POLYGON</Badge>
        <View style={styles.spacer} />
        <Field
          label="Para quem?"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setPrepared(null);
            setConfirmation(null);
          }}
          placeholder="@username"
          autoCapitalize="none"
        />
        <Field
          label="Quanto USDC?"
          value={amount}
          onChangeText={(value) => {
            setAmount(value);
            setPrepared(null);
            setConfirmation(null);
          }}
          keyboardType="decimal-pad"
          placeholder="Ex.: 0,10"
        />
        <ActionButton
          label="Revisar transferência"
          onPress={review}
          loading={working && !prepared}
        />
      </Card>

      {prepared ? (
        <Card style={styles.reviewCard}>
          <Text style={styles.kicker}>REVISÃO</Text>
          <Text style={styles.amount}>{formatUsdc(prepared.amountUsdc)}</Text>
          <Text style={styles.label}>Destinatário</Text>
          <Text style={styles.value}>@{prepared.receiver?.username}</Text>
          <Text style={styles.label}>Carteira de destino</Text>
          <Text selectable style={styles.address}>
            {shortAddress(prepared.receiver?.walletAddress)}
          </Text>
          <Text style={styles.note}>
            O USDC sai diretamente da sua carteira. Não passa pelo saldo interno da Nexa.
          </Text>
          {!txHash ? (
            <ActionButton
              label="Confirmar e assinar"
              onPress={signAndSend}
              loading={working}
            />
          ) : null}
        </Card>
      ) : null}

      {txHash ? (
        <Card>
          <Badge tone={completed ? 'success' : 'warning'}>
            {completed ? 'TRANSFERÊNCIA CONFIRMADA' : 'AGUARDANDO POLYGON'}
          </Badge>
          <Text style={styles.label}>Transação</Text>
          <Text selectable style={styles.hash}>{txHash}</Text>
          {completed ? (
            <Text style={styles.success}>
              {formatUsdc(confirmation.amountUsdc)} entregue para @{confirmation.receiver?.username}.
            </Text>
          ) : (
            <ActionButton
              label="Verificar novamente"
              variant="secondary"
              onPress={checkAgain}
              loading={working}
            />
          )}
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: { height: spacing.md },
  reviewCard: { backgroundColor: '#11143C' },
  kicker: { color: colors.cyan, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  amount: { color: colors.text, fontSize: 32, fontWeight: '900', marginTop: spacing.md },
  label: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  value: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  address: { color: colors.cyan, fontSize: 13, marginTop: 4 },
  note: { color: colors.muted, lineHeight: 20, marginVertical: spacing.lg },
  hash: { color: colors.cyan, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  success: { color: colors.success, fontWeight: '800', marginTop: spacing.md },
  error: { color: colors.danger, fontWeight: '700', marginBottom: spacing.md },
});
