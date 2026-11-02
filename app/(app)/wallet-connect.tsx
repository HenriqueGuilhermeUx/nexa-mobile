import React from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { walletConnectProductPreviewEnabled } from '@/lib/walletConnectProductGate';

/**
 * Embedded WalletConnect hub for the existing Nexa Wallet.
 * UI-only pilot, never creates a transfer, approval, tx hash, ledger credit,
 * destination instruction or onchain call.
 */
export default function WalletConnectHub() {
  if (!walletConnectProductPreviewEnabled) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>WalletConnect Nexa</Text>
        <Text style={styles.muted}>Esta funcionalidade ainda não foi habilitada na sua versão.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>NEXA WALLET · LABORATÓRIO</Text>
      <Text style={styles.title}>Suas carteiras, em um só lugar.</Text>
      <Text style={styles.muted}>
        Conecte MetaMask, Coinbase Wallet, Trust Wallet, Rabby e outras carteiras compatíveis.
        O acesso atual é somente leitura na rede Polygon.
      </Text>

      <View style={styles.card}>
        <Text style={styles.section}>1. Conectar carteira externa</Text>
        <Text style={styles.muted}>
          Verifique o endereço ativo e consulte o USDC nativo da Polygon na carteira externa.
          Nenhuma chave privada ou frase de recuperação é solicitada.
        </Text>
        <Pressable accessibilityRole="button" style={styles.primary}
          onPress={() => router.push('/(app)/external-wallet-connect?market=BR' as any)}>
          <Text style={styles.buttonText}>Conectar carteira · Nexa Brasil</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={() => router.push('/(app)/external-wallet-connect?market=GLOBAL' as any)}>
          <Text style={styles.buttonText}>Conectar carteira · Nexa Global</Text>
        </Pressable>
        <Text style={styles.warning}>
          A conexão ainda depende da liberação do Reown e da homologação do app nativo.
          Se estiver desativada, você verá uma mensagem explicativa.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>2. Receber USDC de outra carteira</Text>
        <Text style={styles.muted}>
          A Wallet Nexa já tem a opção de receber USDC no endereço Privy existente.
          A transferência a partir da carteira externa exigirá sua confirmação nela,
          gás da rede e confirmação on-chain. Conectar não transfere nem credita.
        </Text>
        <Text style={styles.unavailable}>Transferência guiada e conciliação WalletConnect: em homologação</Text>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={() => router.push('/legacy?open=wallet' as any)}>
          <Text style={styles.buttonText}>Ver endereço da minha Wallet Nexa</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>3. Enviar ou sacar para outra carteira</Text>
        <Text style={styles.muted}>
          Saída cripto é diferente de saque Pix. O envio de USDC deve partir da Wallet Nexa,
          com destino, rede, valor, taxa e autorização verificados antes da assinatura.
        </Text>
        <Text style={styles.unavailable}>Envio para carteira externa conectada: indisponível neste piloto</Text>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={() => router.push('/legacy?open=wallet' as any)}>
          <Text style={styles.buttonText}>Ver opções existentes da Wallet</Text>
        </Pressable>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Sua segurança vem primeiro</Text>
        <Text style={styles.muted}>
          Nunca compartilhe frase-semente. Não envie fundos como teste deste conector.
          O saldo da carteira externa não é saldo Nexa e não gera crédito no ledger.
          Tarifa Nexa de entrada entre carteiras: 0%; custos de rede podem existir.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, paddingBottom: spacing.xxxl},
  kicker: {color: colors.cyan, fontSize: 11, fontWeight: '800', letterSpacing: 1.1},
  title: {color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 12, marginBottom: 8},
  section: {color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 9},
  muted: {color: colors.muted, fontSize: 14, lineHeight: 21},
  card: {borderColor: colors.border, borderWidth: 1, backgroundColor: colors.panel,
    borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, gap: 10},
  primary: {backgroundColor: colors.primary, borderRadius: radius.sm, padding: 13, marginTop: 10},
  secondary: {backgroundColor: colors.elevated, borderRadius: radius.sm, padding: 13, marginTop: 8},
  buttonText: {color: colors.text, textAlign: 'center', fontSize: 14, fontWeight: '800'},
  warning: {color: colors.warning, fontSize: 12, lineHeight: 18, marginTop: 7},
  unavailable: {color: colors.warning, fontWeight: '700', fontSize: 12, marginTop: 6},
  notice: {marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md,
    borderColor: colors.borderStrong, borderWidth: 1},
  noticeTitle: {color: colors.text, fontWeight: '800', marginBottom: 8},
});
