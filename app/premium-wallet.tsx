import { useEffect, useMemo, useState } from 'react';
import {
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/expo';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  ActionButton,
  Brand,
  Field,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { config } from '@/config';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

const POLYGON_CHAIN_ID_HEX = '0x89';

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isEvmAddress(value: unknown) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function parseUsdcUnits(value: string) {
  const normalized = String(value || '')
    .trim()
    .replace(/s/g, '')
    .replace(',', '.');

  if (!/^d+(?:.d{0,6})?$/.test(normalized)) {
    throw new Error('Informe um valor USDC com até 6 casas decimais.');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const units =
    BigInt(whole || '0') * 1_000_000n +
    BigInt((fraction + '000000').slice(0, 6));

  if (units <= 0n) {
    throw new Error('Informe um valor USDC maior que zero.');
  }

  return units;
}

function formatUsdcUnits(units: bigint) {
  const whole = units / 1_000_000n;
  const fraction = String(units % 1_000_000n)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function encodeErc20Transfer(toAddress: string, amountUnits: bigint) {
  const selector = 'a9059cbb';
  const addressWord = toAddress
    .toLowerCase()
    .replace(/^0x/, '')
    .padStart(64, '0');
  const amountWord = amountUnits.toString(16).padStart(64, '0');
  return `0x${selector}${addressWord}${amountWord}`;
}

export default function PremiumWalletScreen() {
  const privy = usePrivy() as any;
  const { sendCode, loginWithCode } = useLoginWithEmail() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];

  const [me, setMe] = useState<any>(null);
  const [backendWallet, setBackendWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');

  const embeddedWallet = useMemo(() => {
    const expected = normalizeAddress(backendWallet?.wallet?.address);
    const matching = wallets.find(
      (candidate) =>
        isEvmAddress(candidate?.address) &&
        normalizeAddress(candidate.address) === expected,
    );
    return matching || null;
  }, [wallets, backendWallet?.wallet?.address]);

  const nexaEmail = String(me?.email || '').trim().toLowerCase();
  const onChainUsdc = Number(backendWallet?.balances?.USDC || 0);
  const walletAddress = String(backendWallet?.wallet?.address || '');

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }

      const meResponse = await nexaApi.me(session.accessToken);
      const currentUser = meResponse?.user || meResponse || {};
      setMe(currentUser);

      try {
        const walletResponse = await nexaApi.getMyPrivyWallet(
          session.accessToken,
        );
        setBackendWallet(walletResponse);
      } catch (caught: any) {
        const text = String(caught?.message || '');
        if (
          text.includes('PRIVY_WALLET_NOT_LINKED') ||
          text.toLowerCase().includes('não vinculada')
        ) {
          router.replace('/onboarding-wallet' as any);
          return;
        }
        throw caught;
      }
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar sua carteira.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function requestEmailCode() {
    if (!nexaEmail) {
      setMessage('E-mail Nexa não encontrado.');
      return;
    }

    setWorking(true);
    setMessage('');

    try {
      await sendCode({ email: nexaEmail });
      setCodeSent(true);
      setMessage('Código enviado para seu e-mail Nexa.');
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar o código.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function confirmEmailCode() {
    if (!emailCode.trim()) {
      setMessage('Digite o código recebido.');
      return;
    }

    setWorking(true);
    setMessage('');

    try {
      await loginWithCode({
        email: nexaEmail,
        code: emailCode.trim(),
      });
      setEmailCode('');
      setCodeSent(false);
      setMessage('Carteira desbloqueada com sucesso.');
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Código inválido ou expirado.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function journalWithRetry(
    txHash: string,
    destination: string,
    amountUsdc: number,
  ) {
    const session = await loadNexaSession();
    if (!session) return null;

    let last: any = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        last = await nexaApi.journalPrivyUsdcSend(
          session.accessToken,
          {
            txHash,
            toAddress: destination,
            amountUsdc,
          },
        );

        if (last?.verified === true) return last;
        if (last?.pending !== true) return last;
      } catch (caught) {
        if (attempt === 4) throw caught;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return last;
  }

  async function sendUsdc() {
    if (!embeddedWallet) {
      setMessage(
        'Confirme seu e-mail Nexa para carregar a carteira antes de enviar.',
      );
      return;
    }

    const destination = String(toAddress || '').trim();
    if (!isEvmAddress(destination)) {
      setMessage('Endereço de destino inválido.');
      return;
    }
    if (
      normalizeAddress(destination) ===
      normalizeAddress(walletAddress)
    ) {
      setMessage('Use um endereço diferente da sua própria carteira.');
      return;
    }

    let amountUnits: bigint;
    try {
      amountUnits = parseUsdcUnits(amount);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : 'Valor inválido.',
      );
      return;
    }

    const amountUsdc = Number(formatUsdcUnits(amountUnits));
    if (amountUsdc > onChainUsdc + 0.000001) {
      setMessage('Saldo USDC on-chain insuficiente.');
      return;
    }

    setWorking(true);
    setMessage('');
    setLastTxHash('');

    try {
      const provider = await embeddedWallet.getProvider();
      if (!provider?.request) {
        throw new Error('Provider da carteira indisponível.');
      }

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
        });
      } catch {
        // Algumas versões mantêm a carteira já conectada à Polygon e não
        // implementam wallet_switchEthereumChain. Validamos o chain abaixo.
      }

      const chainId = String(
        await provider.request({ method: 'eth_chainId' }),
      ).toLowerCase();

      if (chainId !== POLYGON_CHAIN_ID_HEX) {
        throw new Error(
          'Selecione a rede Polygon na carteira para enviar USDC.',
        );
      }

      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const from = String(accounts?.[0] || '');
      if (
        !isEvmAddress(from) ||
        normalizeAddress(from) !== normalizeAddress(walletAddress)
      ) {
        throw new Error(
          'A carteira Privy carregada não corresponde à carteira vinculada à Nexa.',
        );
      }

      const data = encodeErc20Transfer(destination, amountUnits);
      const txHash = String(
        await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from,
              to: config.polygonUsdcAddress,
              data,
              value: '0x0',
            },
          ],
        }),
      );

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('A rede não retornou um hash de transação válido.');
      }

      setLastTxHash(txHash);
      setMessage(
        'Transação enviada pela sua carteira. Confirmando na Polygon...',
      );

      const journal = await journalWithRetry(
        txHash,
        destination,
        amountUsdc,
      );

      if (journal?.verified === true) {
        setMessage(
          'Envio confirmado na Polygon e registrado na sua atividade Nexa.',
        );
      } else {
        setMessage(
          'Transação enviada. A confirmação on-chain ainda está em processamento.',
        );
      }

      setToAddress('');
      setAmount('');
      await load();
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível enviar o USDC.',
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading || !privy.isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.muted}>Carregando sua carteira...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Brand />
      <View style={styles.header}>
        <Title>Minha Carteira</Title>
        <Paragraph>
          Carteira individual vinculada à Nexa. O saldo abaixo vem da
          blockchain Polygon.
        </Paragraph>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.eyebrow}>SALDO ON-CHAIN</Text>
        <Text style={styles.balance}>
          {onChainUsdc.toFixed(6)} USDC
        </Text>
        <Text style={styles.muted}>Rede Polygon · USDC nativo</Text>
      </View>

      {walletAddress ? (
        <View style={styles.receiveCard}>
          <Text style={styles.sectionTitle}>Receber USDC</Text>
          <Text style={styles.muted}>
            Compartilhe este endereço para receber USDC na rede Polygon.
          </Text>
          <View style={styles.qr}>
            <QRCode value={walletAddress} size={185} />
          </View>
          <Text selectable style={styles.address}>
            {walletAddress}
          </Text>
        </View>
      ) : null}

      {!privy.user || !embeddedWallet ? (
        <View style={styles.authCard}>
          <Text style={styles.sectionTitle}>Desbloquear carteira</Text>
          <Text style={styles.muted}>
            Confirme o mesmo e-mail cadastrado na Nexa para assinar
            movimentações com sua carteira.
          </Text>

          {!codeSent ? (
            <ActionButton
              label="Enviar código para meu e-mail"
              loading={working}
              onPress={requestEmailCode}
            />
          ) : (
            <>
              <Field
                label="Código recebido"
                value={emailCode}
                onChangeText={setEmailCode}
                keyboardType="number-pad"
                placeholder="000000"
              />
              <ActionButton
                label="Confirmar e desbloquear"
                loading={working}
                onPress={confirmEmailCode}
              />
              <ActionButton
                label="Enviar novo código"
                variant="secondary"
                disabled={working}
                onPress={requestEmailCode}
              />
            </>
          )}
        </View>
      ) : (
        <View style={styles.sendCard}>
          <Text style={styles.sectionTitle}>Enviar USDC</Text>
          <Text style={styles.muted}>
            A transação é assinada pela sua carteira. Pode haver custo de
            rede Polygon.
          </Text>
          <Field
            label="Carteira de destino"
            value={toAddress}
            onChangeText={setToAddress}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="0x..."
          />
          <Field
            label="Valor em USDC"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0,00"
          />
          <ActionButton
            label="Assinar e enviar"
            loading={working}
            onPress={sendUsdc}
          />
        </View>
      )}

      {lastTxHash ? (
        <Text selectable style={styles.txHash}>
          Tx: {lastTxHash}
        </Text>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <ActionButton
        label="Atualizar saldo"
        variant="secondary"
        disabled={working}
        onPress={load}
      />
      <ActionButton
        label="Voltar para a Nexa"
        variant="secondary"
        disabled={working}
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
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { marginVertical: spacing.lg },
  balanceCard: {
    backgroundColor: '#11143C',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  balance: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    marginVertical: spacing.sm,
  },
  receiveCard: {
    backgroundColor: '#0b1220',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authCard: {
    backgroundColor: '#171225',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#5b3f88',
  },
  sendCard: {
    backgroundColor: '#0b1220',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  muted: { color: colors.muted, lineHeight: 19 },
  qr: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 14,
    marginVertical: spacing.lg,
  },
  address: {
    color: colors.cyan,
    fontSize: 11,
    textAlign: 'center',
  },
  message: {
    color: colors.text,
    backgroundColor: '#111827',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  txHash: {
    color: colors.cyan,
    fontSize: 10,
    marginBottom: spacing.md,
  },
});
