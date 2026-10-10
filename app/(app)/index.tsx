import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { NEXA_GLOBAL_PRODUCT } from '@/lib/globalProduct';
import { colors, radius, spacing } from '@/theme';

function FeatureCard(props: {
  title: string;
  text: string;
  action: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.featureCard,
        props.primary ? styles.featureCardPrimary : null,
      ]}
    >
      <Text style={styles.featureTitle}>{props.title}</Text>
      <Text style={styles.featureText}>{props.text}</Text>
      <Text style={styles.featureAction}>{props.action} →</Text>
    </Pressable>
  );
}

export default function NexaGlobalHome() {
  return (
    <Screen>
      <Brand />
      <Eyebrow>NEXA GLOBAL</Eyebrow>
      <Title>USDC que vira utilidade no Brasil.</Title>
      <Paragraph>
        Envie para outro usuário Nexa, adicione USDC com os métodos disponíveis
        no seu país, compre ativos digitais e use serviços no Brasil.
      </Paragraph>

      <Card style={styles.hero}>
        <Badge tone="info">PRINCIPAL</Badge>
        <Text style={styles.heroTitle}>Enviar para @Nexa User</Text>
        <Text style={styles.heroText}>
          A forma mais simples de mandar valor para alguém no ecossistema Nexa.
          Você informa o @username, revisa o USDC e autoriza na sua própria
          wallet.
        </Text>
        <ActionButton
          label="Enviar para @username"
          onPress={() => router.push('/(app)/send-nexa' as any)}
        />
      </Card>

      <View style={styles.grid}>
        <FeatureCard
          title="Adicionar USDC"
          text="Cartão, Apple Pay, Google Pay ou outro método disponível para sua região."
          action="Adicionar"
          onPress={() => router.push('/(app)/fund-card' as any)}
        />
        <FeatureCard
          title="Receber USDC"
          text="Use sua wallet Nexa para receber USDC de outra wallet ou exchange compatível."
          action="Ver wallet"
          onPress={() =>
            router.push({
              pathname: '/legacy' as any,
              params: { open: 'custody' },
            } as any)
          }
        />
        <FeatureCard
          title="Pix para o Brasil"
          text="Converta USDC e use a infraestrutura Nexa para receber em reais no Brasil."
          action="Abrir Pix"
          onPress={() => router.push('/(app)/cash-out' as any)}
        />
        <FeatureCard
          title="Pagar conta no Brasil"
          text="Agende pagamento de boleto ou QR Pix brasileiro usando a infraestrutura Nexa."
          action="Pagar conta"
          onPress={() => router.push('/(app)/pay' as any)}
        />
        <FeatureCard
          title="BTC, ETH e Ouro"
          text="Use USDC para acessar Bitcoin, Ether e ouro digital quando disponíveis."
          action="Comprar ativos"
          onPress={() => router.push('/(app)/buy-crypto' as any)}
        />
        <FeatureCard
          title="Histórico"
          text="Acompanhe suas movimentações e confirmações em um só lugar."
          action="Ver histórico"
          onPress={() => router.push('/(app)/activity' as any)}
        />
      </View>

      <Card>
        <Text style={styles.noteTitle}>Como o Global funciona</Text>
        <Text style={styles.note}>
          O saldo-base do produto é {NEXA_GLOBAL_PRODUCT.coreAsset}. Cartão e
          carteiras digitais servem para adquirir USDC por provedores
          habilitados; a Nexa não cria saldo fiat local nessa etapa.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.panel,
    borderColor: colors.cyan,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginVertical: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  featureCard: {
    width: '48%',
    minHeight: 158,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  featureCardPrimary: {
    borderColor: colors.cyan,
    backgroundColor: colors.primarySoft,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  featureText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
    flex: 1,
  },
  featureAction: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
