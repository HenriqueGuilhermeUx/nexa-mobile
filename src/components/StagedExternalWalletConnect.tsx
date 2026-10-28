import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AppKit, AppKitProvider, useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';

import { ExternalWalletProofPanel } from './ExternalWalletProofPanel';
import { validateReownExternalConnection, type ReownExternalConnection } from '../lib/reownConnectedWalletBridge';
import { initializeExternalWalletAppKit } from '../lib/reownExternalWalletAppKit';
import { readConnectedExternalUsdc } from '../lib/externalWalletUsdcBalance';

/**
 * Isolated Reown staging UI. ONLY mount from a gated, authenticated testing
 * route after registering a legitimate Reown project. No token transfers.
 */
type ReownInstance = ReturnType<typeof initializeExternalWalletAppKit>;
export function StagedExternalWalletConnect(props: { accessToken: string; instance: ReownInstance; market?: 'BR' | 'GLOBAL'; mode?: 'proof' | 'view-only' }) {
  return (
    <AppKitProvider instance={props.instance}>
      <ExternalWalletConnectionScreen accessToken={props.accessToken} market={props.market ?? 'BR'} mode={props.mode ?? 'view-only'} />
      <View style={{ position: 'absolute', width: '100%', height: '100%' }} pointerEvents="box-none">
        <AppKit />
      </View>
    </AppKitProvider>
  );
}

function ExternalWalletConnectionScreen({ accessToken, market, mode }: { accessToken: string; market: 'BR' | 'GLOBAL'; mode: 'proof' | 'view-only' }) {
  const { open, disconnect } = useAppKit();
  const { address, chainId, namespace, isConnected } = useAccount();
  const { provider, providerType } = useProvider();
  const [validated, setValidated] = useState<ReownExternalConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<{address:string;balanceUsdc:string}|null>(null);
  const requestEpoch = useRef(0);

  const active = Boolean(
    isConnected && validated && typeof address === 'string' &&
    address.toLowerCase() === validated.address.toLowerCase() &&
    provider === validated.provider &&
    providerType === 'eip155' && namespace === 'eip155' &&
    String(chainId) === '137'
  );

  async function checkConnectedWallet() {
    setError('');
    setValidated(null);
    setBalance(null);
    requestEpoch.current++;
    if (!isConnected || providerType !== 'eip155' || namespace !== 'eip155' || String(chainId) !== '137') {
      setError('Conecte uma carteira EVM na rede Polygon (137).');
      return;
    }
    setBusy(true);
    try {
      const checked = await validateReownExternalConnection({ address, provider });
      setValidated(checked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível validar a carteira.');
    } finally {
      setBusy(false);
    }
  }

  async function checkBalance() {
    if (!active || !validated || busy) return;
    const epoch = ++requestEpoch.current;
    setBalance(null);
    setError('');
    setBusy(true);
    try {
      const value = await readConnectedExternalUsdc(validated);
      if (epoch === requestEpoch.current) setBalance(value);
    } catch {
      if (epoch === requestEpoch.current) setError('Não foi possível consultar o saldo USDC na carteira externa.');
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  }

  async function disconnectWallet() {
    requestEpoch.current++;
    setBalance(null);
    setValidated(null);
    setError('');
    try {
      await disconnect();
    } catch {
      setError('Falha ao desconectar. Abra sua carteira e tente novamente.');
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Carteira externa — Nexa {market === 'GLOBAL' ? 'Global' : 'Brasil'} (homologação)</Text>
      <Text>{mode === 'view-only' ? 'Conecte MetaMask ou outra carteira WalletConnect para consultar seu endereço e saldo externo. Nenhuma assinatura, transferência, Pix ou vínculo permanente é solicitado neste piloto.' : 'Conecte MetaMask ou outra carteira WalletConnect. Apenas a assinatura de titularidade será solicitada; nenhuma transferência é executada.'}</Text>
      <Text>{isConnected ? `Endereço: ${address ?? 'indisponível'}` : 'Carteira não conectada'}</Text>
      {isConnected ? <Text>Rede: {String(chainId)} ({String(namespace)})</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy}
        onPress={() => { requestEpoch.current++; setValidated(null); setBalance(null); setError(''); void open({ view: 'Connect' }); }}
        style={{ backgroundColor: '#263b63', padding: 14, borderRadius: 8 }}>
        <Text style={{ color: 'white' }}>Conectar carteira</Text>
      </Pressable>
      {isConnected ? (
        <Pressable accessibilityRole="button" disabled={busy}
          onPress={() => { void checkConnectedWallet(); }}
          style={{ backgroundColor: '#295e48', padding: 14, borderRadius: 8 }}>
          <Text style={{ color: 'white' }}>Conferir conta e rede</Text>
        </Pressable>
      ) : null}
      {busy ? <ActivityIndicator accessibilityLabel="Conferindo carteira" /> : null}
      {active && validated ? (
        <>
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => { void checkBalance(); }}
            style={{ backgroundColor: '#274d65', padding: 14, borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Consultar saldo USDC externo (somente leitura)</Text>
          </Pressable>
          {balance?.address.toLowerCase() === validated.address.toLowerCase() ?
            <Text>Na carteira externa: {balance.balanceUsdc} USDC — não é saldo Nexa.</Text> : null}
          {mode === 'proof' ? <ExternalWalletProofPanel
            accessToken={accessToken}
            market={market}
            address={validated.address}
            provider={validated.provider}
            onDisconnect={() => { void disconnectWallet(); }}
          /> : <Text>Piloto de visualização: a Nexa não vincula, movimenta ou recebe USDC por esta tela.</Text>}
        </>
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
