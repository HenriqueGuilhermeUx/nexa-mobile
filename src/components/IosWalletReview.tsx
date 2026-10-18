import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

export default function IosWalletReview({ user, onLogout }: { user: any; onLogout: () => void }) {
  const address = String(user?.wallet?.address || user?.walletAddress || '').trim();
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20, backgroundColor: '#06111F', flexGrow: 1 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>Nexa Wallet</Text>
      <Text style={{ color: '#B5C8D8', fontSize: 16 }}>Sua carteira digital, sob seu controle.</Text>
      <View style={{ padding: 20, borderRadius: 16, backgroundColor: '#10243A', gap: 12 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>Receber USDC na Polygon</Text>
        <Text selectable style={{ color: '#D5E7F8', fontSize: 14 }}>{address || 'Carteira ainda não vinculada à sua conta.'}</Text>
        {address ? <TouchableOpacity onPress={() => Clipboard.setStringAsync(address)} accessibilityRole="button"><Text style={{ color: '#6AB6FF', fontSize: 16 }}>Copiar endereço</Text></TouchableOpacity> : null}
        <Text style={{ color: '#B5C8D8', fontSize: 13 }}>Confirme a rede Polygon e o token USDC antes de enviar. Transferências para rede incorreta podem causar perda de fundos.</Text>
      </View>
      <TouchableOpacity onPress={() => router.push('/(app)/activity' as any)} accessibilityRole="button" style={{ padding: 18, borderRadius: 12, backgroundColor: '#10243A' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Ver histórico</Text>
      </TouchableOpacity>
      <Text style={{ color: '#B5C8D8', fontSize: 14 }}>Operações Pix, câmbio, compras de cripto e transferências externas estão indisponíveis nesta versão de testes iOS. Não transfira valores reais até a validação da carteira.</Text>
      <TouchableOpacity onPress={onLogout} accessibilityRole="button" style={{ padding: 18 }}>
        <Text style={{ color: '#B5C8D8', textAlign: 'center' }}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
