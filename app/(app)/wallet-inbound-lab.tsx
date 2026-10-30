import React, { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';

/**
 * Hidden, authenticated QA navigator for a dedicated non-production EAS
 * development client. Does not connect wallets or start payment flows.
 */
export default function WalletInboundLabRoute() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    loadNexaSession().then(s => {
      if (mounted) setAuthenticated(Boolean(s?.accessToken));
    }).catch(() => { if (mounted) setAuthenticated(false); });
    return () => { mounted = false; };
  }, []);

  if (config.releaseChannel !== 'wallet-inbound-lab') {
    return (
      <View style={{ padding: 24 }}>
        <Text>Área de homologação indisponível nesta versão.</Text>
      </View>
    );
  }
  if (authenticated === null) {
    return <ActivityIndicator accessibilityLabel="Verificando sessão Nexa" />;
  }
  if (!authenticated) return <Redirect href="/sign-in" />;

  return (
    <ScrollView contentContainerStyle={{ gap: 14, padding: 22 }}>
      <Text style={{ fontSize: 23, fontWeight: '700' }}>Nexa — laboratório de carteiras</Text>
      <Text>Ambiente interno. Nenhuma movimentação financeira da Nexa está habilitada.</Text>
      <View style={{ gap: 5, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#77818e' }}>
        <Text>Rede suportada: Polygon (137)</Text>
        <Text>Ativo: USDC nativo • tarifa de entrada Nexa 0%</Text>
        <Text>O endereço externo só aparece após confirmação local da carteira. Nenhum endereço de recebimento Nexa é gerado aqui.</Text>
      </View>
      <Text>Conexão de visualização apenas. Recebimento por USDC e Pix Pay não fazem parte deste piloto.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/external-wallet-connect?market=BR' as any)}
        style={{ backgroundColor: '#25384e', padding: 16, borderRadius: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Conectar carteira — Nexa Brasil</Text>
      </Pressable>
      <Pressable accessibilityRole="button"
        onPress={() => router.push('/(app)/external-wallet-connect?market=GLOBAL' as any)}
        style={{ backgroundColor: '#25384e', padding: 16, borderRadius: 10 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Conectar carteira — Nexa Global</Text>
      </Pressable>
      <Text>Brasil e Global usam apenas conexão local e consulta de saldo externo neste piloto. Nenhuma assinatura ou vínculo é solicitado.</Text>
      <Text>O conector Reown permanece bloqueado até revisão comercial, configuração e teste nativo. Não envie fundos a este piloto.</Text>
      <Text>Não faça depósitos reais enquanto o backend de homologação e a conciliação não estiverem aprovados.</Text>
    </ScrollView>
  );
}
