import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { walletConnectProductPreviewEnabled } from '@/lib/walletConnectProductGate';

type Props = {
  onPress: () => void;
  context?: 'home' | 'receive' | 'menu';
};

/** Pure navigation into the isolated WalletConnect hub. No transaction calls. */
export function WalletConnectEntry({onPress, context = 'home'}: Props) {
  if (!walletConnectProductPreviewEnabled) return null;
  const receive = context === 'receive';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={receive ? 'Conectar carteira externa para visualizar' : 'Abrir WalletConnect Nexa em homologação'}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>↔</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>WALLETCONNECT · TESTE</Text>
          <Text style={styles.title}>{receive ? 'Trazer de outra carteira' : 'WalletConnect'}</Text>
          <Text style={styles.caption}>
            {receive
              ? 'Conecte MetaMask e outras carteiras para visualizar. Transferir USDC estará disponível após homologação.'
              : 'Conecte carteiras externas, consulte USDC e conheça as próximas opções de entrada e saída.'}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
      <Text style={styles.note}>Somente visualização · Sem transferência ou crédito automático</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {padding: spacing.md, backgroundColor: colors.panel, borderColor: colors.borderStrong,
    borderWidth: 1, borderRadius: radius.lg, marginVertical: spacing.sm},
  row: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  icon: {backgroundColor: colors.primarySoft, borderRadius: radius.md, width: 46, height: 46,
    alignItems: 'center', justifyContent: 'center'},
  iconText: {color: colors.cyan, fontSize: 25, fontWeight: '800'},
  copy: {flex: 1},
  kicker: {color: colors.cyan, fontWeight: '800', fontSize: 10, letterSpacing: 1},
  title: {color: colors.text, fontWeight: '800', fontSize: 17, marginTop: 3},
  caption: {color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5},
  arrow: {color: colors.cyan, fontSize: 28},
  note: {color: colors.warning, fontSize: 11, marginTop: 11},
});
