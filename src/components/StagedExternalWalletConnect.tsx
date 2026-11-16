import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import { AppKit, AppKitProvider, useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import { CoreHelperUtil, RouterController, WcController } from '@reown/appkit-core-react-native';

import { ExternalWalletProofPanel } from './ExternalWalletProofPanel';
import { validateReownExternalConnection, type ReownExternalConnection } from '../lib/reownConnectedWalletBridge';
import { initializeExternalWalletAppKit } from '../lib/reownExternalWalletAppKit';
import { readConnectedExternalUsdc } from '../lib/externalWalletUsdcBalance';
import { ExternalUsdcReceiveReviewPanel } from './ExternalUsdcReceiveReviewPanel';

/**
 * Isolated Reown staging UI. ONLY mount from a gated, authenticated testing
 * route after registering a legitimate Reown project. No token transfers.
 */
type ReownInstance = ReturnType<typeof initializeExternalWalletAppKit>;
export function StagedExternalWalletConnect(props: { accessToken: string; instance: ReownInstance; market?: 'BR' | 'GLOBAL'; mode?: 'proof' | 'view-only' }) {
  return (
    <AppKitProvider instance={props.instance}>
      <ExternalWalletConnectionScreen accessToken={props.accessToken} instance={props.instance} market={props.market ?? 'BR'} mode={props.mode ?? 'view-only'} />
      <View style={{ position: 'absolute', width: '100%', height: '100%' }} pointerEvents="box-none">
        <AppKit />
      </View>
    </AppKitProvider>
  );
}

function ExternalWalletConnectionScreen({ accessToken, instance, market, mode }: { accessToken: string; instance: ReownInstance; market: 'BR' | 'GLOBAL'; mode: 'proof' | 'view-only' }) {
  const { open, disconnect } = useAppKit();
  const { address, chainId, namespace, isConnected } = useAccount();
  const { provider, providerType } = useProvider();
  const [validated, setValidated] = useState<ReownExternalConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<{address:string;balanceUsdc:string}|null>(null);
  const requestEpoch = useRef(0);
  const [showManualOpen, setShowManualOpen] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const launchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (launchTimeout.current) clearTimeout(launchTimeout.current); }, []);
  useEffect(() => {
    if (isConnected) {
      setShowManualOpen(false);
      if (launchTimeout.current) clearTimeout(launchTimeout.current);
    }
  }, [isConnected]);

  function startWalletConnect() {
    requestEpoch.current++;
    setBusy(false);
    setValidated(null);
    setBalance(null);
    setError('');
    setManualError('');
    setManualBusy(false);
    setShowManualOpen(false);
    if (launchTimeout.current) clearTimeout(launchTimeout.current);
    // Automatic deep linking is performed by AppKit. Only show a fallback if
    // Android never left the Nexa foreground to open the wallet.
    launchTimeout.current = setTimeout(() => {
      if (AppState.currentState === 'active') setShowManualOpen(true);
    }, 12000);
    void open({view:'Connect'});
  }

  async function openPendingMetaMaskPairing() {
    if (manualBusy) return;
    setManualError('');
    setManualBusy(true);
    try {
      // Only recover the wallet explicitly selected in the Reown modal.
      // Never open an unrelated installed wallet using a secret pairing URI.
      const wallet = RouterController.state.data?.wallet;
      if (!wallet || !/metamask/i.test(wallet.name || '')) {
        throw new Error('Selecione MetaMask no Reown antes de tentar novamente.');
      }

      let uri = WcController.state.wcUri;
      const isUsable = (value: string | undefined): value is string =>
        typeof value === 'string' &&
        (/^wc:[^\s]{8,2048}@2\?/.test(value) ||
          (value.startsWith('https://') && value.includes('wc_ev')));
      const expired = CoreHelperUtil.isPairingExpired(WcController.state.wcPairingExpiry);

      if (!isUsable(uri) || expired) {
        // The previous "no valid pairing" message came from this situation.
        // Subscribe BEFORE asking the Reown connector to create a fresh URI.
        WcController.clearUri();
        let stopListening: (() => void) | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const freshUri = new Promise<string>((resolve, reject) => {
          stopListening = WcController.subscribeKey('wcUri', value => {
            if (typeof value === 'string' && value) {
              if (timeoutId) clearTimeout(timeoutId);
              stopListening?.();
              resolve(value);
            }
          });
          timeoutId = setTimeout(() => {
            stopListening?.();
            reject(new Error('O Reown não gerou um novo pedido de conexão em 15 segundos. Verifique a rede ou o projeto WalletConnect.'));
          }, 15000);
        });
        // Reown's connect() waits for wallet approval; don't await that promise
        // before retrieving display_uri or the UI will deadlock.
        const connection = instance.connect({ wallet });
        WcController.setWcPromise(connection);
        void connection.catch(() => {
          // The SDK owns the session error UI. Never log or expose the URI.
        });
        uri = await freshUri;
        // The SDK also attempts an automatic wallet launch upon display_uri.
        // Only use our fallback if the Android app stays in the foreground.
        await new Promise(resolve => setTimeout(resolve, 1800));
        if (AppState.currentState !== 'active') {
          setShowManualOpen(false);
          return;
        }
      }

      if (!isUsable(uri) || CoreHelperUtil.isPairingExpired(WcController.state.wcPairingExpiry)) {
        throw new Error('O pedido de conexão está inválido ou expirou. Tente novamente pela lista de carteiras.');
      }

      // Use Reown's own formatter, which also supports WalletConnect Link Mode
      // (HTTPS wc_ev links). A hardcoded wc: URI validator rejected that mode.
      const { redirect } = CoreHelperUtil.formatNativeUrl(wallet.mobile_link || 'metamask://', uri);
      if (!redirect.startsWith('metamask://') && !redirect.startsWith('https://')) {
        throw new Error('Endereço de abertura da MetaMask não reconhecido.');
      }
      await Linking.openURL(redirect);
      setShowManualOpen(false);
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Falha ao abrir a MetaMask.');
    } finally {
      setManualBusy(false);
    }
  }

  // Disconnects, account switches and network switches invalidate prior
  // read-only confirmations, even if the provider object is reused.
  useEffect(() => {
    requestEpoch.current++;
    setBusy(false);
    setValidated(null);
    setBalance(null);
  }, [address, chainId, provider, providerType, namespace, isConnected]);

  const active = Boolean(
    isConnected && validated && typeof address === 'string' &&
    address.toLowerCase() === validated.address.toLowerCase() &&
    provider === validated.provider &&
    providerType === 'eip155' && namespace === 'eip155' &&
    String(chainId) === '137'
  );

  async function checkConnectedWallet() {
    const epoch = ++requestEpoch.current;
    setError('');
    setValidated(null);
    setBalance(null);
    if (!isConnected || providerType !== 'eip155' || namespace !== 'eip155' || String(chainId) !== '137') {
      setError('Conecte uma carteira EVM na rede Polygon (137).');
      return;
    }
    setBusy(true);
    try {
      const checked = await validateReownExternalConnection({ address, provider });
      if (requestEpoch.current === epoch) setValidated(checked);
    } catch (e) {
      if (requestEpoch.current === epoch) setError(e instanceof Error ? e.message : 'Não foi possível validar a carteira.');
    } finally {
      if (requestEpoch.current === epoch) setBusy(false);
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
      if (epoch === requestEpoch.current && value.address.toLowerCase() === validated.address.toLowerCase()) {
        setBalance(value);
      }
    } catch {
      if (epoch === requestEpoch.current) setError('Não foi possível consultar o saldo USDC na carteira externa.');
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  }

  async function reviewNexaExternalWithdrawalDestination() {
    if (!active || !validated || busy || mode !== 'view-only') return;
    const epoch = ++requestEpoch.current;
    setError('');
    setBusy(true);
    try {
      const current = await validateReownExternalConnection({
        address:validated.address,provider:validated.provider,
      });
      if (requestEpoch.current !== epoch ||
          current.address.toLowerCase() !== validated.address.toLowerCase()) return;
      // No transfer; route data can only prefill the existing Privy custody
      // screen in isolated QA. The existing send still requires user review
      // and remains disabled while financialExecutionEnabled=false.
      router.push({
        pathname:'/legacy',
        params:{open:'custody',externalRecipient:current.address},
      } as any);
    } catch {
      if (requestEpoch.current === epoch) {
        setError('A carteira mudou. Reconecte e confira o endereço antes de continuar.');
      }
    } finally {
      if (requestEpoch.current === epoch) setBusy(false);
    }
  }

  async function disconnectWallet() {
    requestEpoch.current++;
    setBusy(false);
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
        onPress={startWalletConnect}
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
          {mode === 'view-only' && validated ? (
            <ExternalUsdcReceiveReviewPanel
              key={validated.address.toLowerCase() + ':' + String(chainId) + ':' + market}
              accessToken={accessToken}
              address={validated.address}
              provider={validated.provider}
              market={market}
            />
          ) : null}
          {mode === 'view-only' ? (
            <Pressable accessibilityRole="button" disabled={busy}
              onPress={()=>{void reviewNexaExternalWithdrawalDestination();}}
              style={{padding:14,borderRadius:8,backgroundColor:'#274d65'}}>
              <Text style={{color:'#fff',fontWeight:'700'}}>
                Preparar envio da Nexa para esta carteira (somente prévia QA)
              </Text>
            </Pressable>
          ) : null}
          {mode === 'proof' ? <ExternalWalletProofPanel
            accessToken={accessToken}
            market={market}
            address={validated.address}
            provider={validated.provider}
            onDisconnect={() => { void disconnectWallet(); }}
          /> : <Text>Revisão de recebimento disponível somente em QA; nenhuma transferência, crédito ou assinatura é executada nesta tela.</Text>}
        </>
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {Platform.OS === 'android' && !isConnected ? (
        <Modal visible={showManualOpen} transparent animationType="fade"
          onRequestClose={() => setShowManualOpen(false)}>
          <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.60)',padding:18}}>
            <View style={{backgroundColor:'#182338',padding:20,borderRadius:16,gap:14}}>
              <Text style={{color:'white',fontSize:19,fontWeight:'700'}}>MetaMask não abriu?</Text>
              <Text style={{color:'white'}}>
                O Android continuou na Nexa. Vamos tentar abrir a MetaMask
                com o pedido de conexão atual do Reown, sem realizar transferências.
              </Text>
              <Pressable accessibilityRole="button" disabled={manualBusy}
                onPress={() => {void openPendingMetaMaskPairing();}}
                style={{padding:14,borderRadius:9,backgroundColor:'#295e48',opacity:manualBusy?0.6:1}}>
                <Text style={{color:'white',textAlign:'center',fontWeight:'700'}}>
                  {manualBusy ? 'Preparando conexão Reown…' : 'Abrir MetaMask com pedido de conexão'}
                </Text>
              </Pressable>
              {manualError ? <Text accessibilityRole="alert" style={{color:'#ffb5b5'}}>{manualError}</Text> : null}
              <Pressable accessibilityRole="button"
                onPress={() => setShowManualOpen(false)} style={{padding:10}}>
                <Text style={{color:'white',textAlign:'center'}}>Voltar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

    </View>
  );
}
