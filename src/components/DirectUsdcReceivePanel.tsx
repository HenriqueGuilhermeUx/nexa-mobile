import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { loadDirectUsdcReceivingDetails, type DirectUsdcReceivingDetails } from '../lib/directUsdcReceive';

/**
 * Direct wallet-to-wallet Polygon USDC receive: no Reown, no Privy signing.
 * The QR shows a complete account address only after fresh verification
 * against Nexa's authenticated server and the Privy provider.
 */
export function DirectUsdcReceivePanel({ accessToken }: { accessToken: string }) {
  const [details, setDetails] = useState<DirectUsdcReceivingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setCopied(false);
    setDetails(null);
    setError('');
    try {
      const result = await loadDirectUsdcReceivingDetails(accessToken);
      if (version === requestVersion.current) setDetails(result);
    } catch {
      // Never suggest a saved, cached or manually pasted fallback address.
      if (version === requestVersion.current) setError('Não foi possível confirmar sua carteira Privy com segurança. Tente novamente mais tarde.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
    return () => { requestVersion.current++; };
  }, [refresh]);

  async function copyAddress() {
    if (!details) return;
    try {
      await Clipboard.setStringAsync(details.walletAddress);
      setCopied(true);
    } catch {
      setCopied(false);
      setError('Não foi possível copiar o endereço.');
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, alignItems: 'center' }}>
      <Text style={{ fontWeight: '700', fontSize: 23, textAlign: 'center' }}>Receber USDC</Text>
      <Text style={{ textAlign: 'center' }}>Transferência direta para sua carteira Privy, sem conectar a carteira de origem à Nexa.</Text>
      <View style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#52627a', width: '100%', gap: 7 }}>
        <Text style={{ fontWeight: '700' }}>Rede: Polygon (chain ID 137)</Text>
        <Text>Ativo: USDC nativo — não enviar USDC.e nem outros tokens.</Text>
        <Text>Contrato: 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359</Text>
        <Text>Tarifa Nexa: 0%. Taxa da rede paga por quem envia.</Text>
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Validando carteira Privy" /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: '#ff7777', textAlign: 'center' }}>{error}</Text> : null}
      {details && !loading ? (
        <View style={{ alignItems: 'center', gap: 14, width: '100%' }}>
          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12 }}>
            <QRCode value={details.walletAddress} size={210} />
          </View>
          <Text selectable style={{ fontSize: 14, textAlign: 'center' }}>{details.walletAddress}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Copiar endereço da carteira Privy"
            onPress={() => { void copyAddress(); }}
            style={{ padding: 14, borderRadius: 10, backgroundColor: '#225eaa', width: '100%' }}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
              {copied ? 'Endereço copiado' : 'Copiar endereço'}
            </Text>
          </Pressable>
          <Text style={{ textAlign: 'center' }}>Na sua carteira de origem, selecione USDC nativo e a rede Polygon. Confira o endereço completo antes de confirmar.</Text>
          <Text style={{ textAlign: 'center' }}>O QR Code representa somente seu endereço. Não é uma cobrança Pix, não assina transações e não confirma saldo recebido.</Text>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" disabled={loading} onPress={() => { void refresh(); }}
        style={{ padding: 12, opacity: loading ? 0.5 : 1 }}>
        <Text style={{ textDecorationLine: 'underline' }}>Verificar endereço novamente</Text>
      </Pressable>
    </ScrollView>
  );
}
