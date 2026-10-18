import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { previewExternalUsdcInbound, type InboundMarket, type ExternalInboundPreview } from '../lib/externalUsdcInboundPreview';

type Props = { accessToken: string; market: InboundMarket };

/**
 * Isolated read-only demo. Intentionally no Connect/Send button:
 * a real provider session + signed ownership challenge is required first.
 */
export function ExternalUsdcInboundPreviewPanel({ accessToken, market }: Props) {
  const [from, setFrom] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<ExternalInboundPreview | null>(null);
  const [error, setError] = useState('');
  async function loadPreview() {
    setPending(true);
    setError('');
    setPreview(null);
    try {
      setPreview(await previewExternalUsdcInbound({ accessToken, from: from.trim(), amount: amount.trim(), market }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao consultar prévia');
    } finally {
      setPending(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Receber USDC de outra carteira</Text>
      <Text>Polygon • USDC nativo • Tarifa Nexa 0%. O envio exige POL para gas na carteira de origem.</Text>
      <Text style={{ fontWeight: '600' }}>Carteira de origem</Text>
      <TextInput accessibilityLabel="Endereço da carteira externa" autoCapitalize="none"
        autoCorrect={false} placeholder="0x..." value={from} onChangeText={setFrom}
        style={{ padding: 12, borderWidth: 1, borderColor: '#888', borderRadius: 8 }} />
      <Text style={{ fontWeight: '600' }}>Valor em USDC</Text>
      <TextInput accessibilityLabel="Valor em USDC" placeholder="10.00" keyboardType="decimal-pad"
        value={amount} onChangeText={setAmount}
        style={{ padding: 12, borderWidth: 1, borderColor: '#888', borderRadius: 8 }} />
      <Pressable disabled={pending} onPress={loadPreview}
        accessibilityRole="button"
        style={{ padding: 15, backgroundColor: '#333', borderRadius: 8, opacity: pending ? 0.6 : 1 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Consultar prévia</Text>
      </Pressable>
      {pending ? <ActivityIndicator accessibilityLabel="Consultando prévia" /> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {preview ? (
        <View style={{ gap: 8 }}>
          <Text>Destino Nexa: {preview.recipient}</Text>
          <Text>Valor: {preview.amount} USDC</Text>
          <Text>Tarifa Nexa: {preview.pricing.feeUsdc} USDC</Text>
          <Text>Valor previsto: {preview.pricing.netUsdc} USDC</Text>
          <Text>Gas da rede pago pelo remetente (não incluído).</Text>
          <Text>Somente prévia. Não autoriza nem executa transferência.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
