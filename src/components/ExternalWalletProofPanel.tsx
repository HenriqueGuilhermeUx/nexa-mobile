import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { proveExternalWalletOwnership, type ExternalEip1193Provider } from '../lib/externalWalletProviderProof';
import { revokeLinkedExternalWallet } from '../lib/externalWalletOwnership';

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
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinked, setUnlinked] = useState(false);
  async function prove() {
    setVerifiedAddress(null);
    setConfirmUnlink(false);
    setUnlinked(false);
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
  async function unlinkFromNexa() {
    if (!verifiedAddress || !confirmUnlink || busy) return;
    setBusy(true);
    setError('');
    try {
      await revokeLinkedExternalWallet({
        accessToken: props.accessToken,
        walletAddress: verifiedAddress,
      });
      setVerifiedAddress(null);
      setConfirmUnlink(false);
      setUnlinked(true);
    } catch {
      setError('Não foi possível desvincular a carteira da sua conta Nexa. Tente novamente.');
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
      {verifiedAddress ? (
        <View style={{gap:9}}>
          <Text accessibilityRole="text">Vínculo Nexa registrado: {verifiedAddress}</Text>
          <Text>Este vínculo apenas comprova titularidade. Não autoriza movimentar fundos.</Text>
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={() => setConfirmUnlink(v => !v)}>
            <Text style={{textDecorationLine:'underline'}}>Remover vínculo da carteira na Nexa</Text>
          </Pressable>
          {confirmUnlink ? (
            <>
              <Text>Confirma a remoção do vínculo? Seus fundos e sua carteira externa não serão alterados.</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void unlinkFromNexa();}}
                style={{padding:12,backgroundColor:'#763b38',borderRadius:8}}>
                <Text style={{color:'white'}}>Confirmar desvinculação</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
      {unlinked ? <Text>Vínculo removido na Nexa. A carteira externa continua sob seu controle.</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => {
        setVerifiedAddress(null);
        setError('');
        setConfirmUnlink(false);
        props.onDisconnect();
      }}><Text>Desconectar sessão Reown (não remove vínculo Nexa)</Text></Pressable>
    </View>
  );
}
