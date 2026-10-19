import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { proveExternalWalletOwnership, type ExternalEip1193Provider } from '../lib/externalWalletProviderProof';

/**
 * UI step for an already connected external EIP-1193 provider.
 * The parent must explicitly establish and disconnect the provider session.
 * This component never discovers injected wallets, holds keys or sends tokens.
 */
export function ExternalWalletProofPanel(props: {
  accessToken: string;
  provider: ExternalEip1193Provider | null;
  address: string | null;
  onDisconnect: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function prove() {
    setVerifiedAddress(null);
    setError('');
    if (!props.provider || !props.address) {
      setError('Conecte uma carteira externa antes de continuar.');
      return;
    }
    setBusy(true);
    try {
      const result = await proveExternalWalletOwnership({
        provider: props.provider,
        expectedAddress: props.address,
        accessToken: props.accessToken,
      });
      setVerifiedAddress(result.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível verificar sua carteira.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Verificar carteira externa</Text>
      <Text>{props.address ? `Carteira conectada: ${props.address}` : 'Nenhuma carteira conectada.'}</Text>
      <Text>A assinatura confirma o controle da carteira. Não autoriza envio de fundos.</Text>
      <Pressable accessibilityRole="button" disabled={busy || !props.provider || !props.address}
        onPress={prove} style={{ padding: 12, borderRadius: 8, backgroundColor: '#333', opacity: busy ? 0.5 : 1 }}>
        <Text style={{ color: 'white' }}>Assinar para verificar</Text>
      </Pressable>
      {busy ? <ActivityIndicator accessibilityLabel="Verificando assinatura" /> : null}
      {verifiedAddress ? <Text accessibilityRole="text">Carteira verificada: {verifiedAddress}</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => {
        setVerifiedAddress(null);
        setError('');
        props.onDisconnect();
      }}><Text>Desconectar carteira</Text></Pressable>
    </View>
  );
}
