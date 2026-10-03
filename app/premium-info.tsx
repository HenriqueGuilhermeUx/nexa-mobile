import { router } from 'expo-router';
import { Text, StyleSheet } from 'react-native';

import {
  ActionButton,
  Card,
  Eyebrow,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { colors, spacing } from '@/theme';

export default function PremiumInfoScreen() {
  return (
    <Screen>
      <Eyebrow>NEXA PREMIUM</Eyebrow>
      <Title>Premium, sem mudar sua autonomia.</Title>
      <Paragraph>
        O Nexa Premium adiciona benefícios e condições diferenciadas à sua experiência na Nexa.
      </Paragraph>

      <Card style={styles.priceCard}>
        <Text style={styles.goldLabel}>ASSINATURA</Text>
        <Text style={styles.price}>R$ 19,90/mês</Text>
        <Text style={styles.text}>
          O valor é cobrado em USDC pela cotação aplicável no dia da cobrança, com vencimento mensal no dia 10.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Cobrança Wallet‑First</Text>
        <Text style={styles.text}>
          A assinatura recorrente precisa ser autorizada pela sua própria carteira. A Nexa não movimenta USDC sem a autorização necessária.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Benefícios</Text>
        <Text style={styles.text}>• Condições diferenciadas em recursos elegíveis</Text>
        <Text style={styles.text}>• Condições diferenciadas no Rewards</Text>
        <Text style={styles.text}>• Atendimento prioritário</Text>
        <Text style={styles.text}>• Recursos Premium identificados no próprio app</Text>
      </Card>

      <Card>
        <Text style={styles.title}>Identidade visual</Text>
        <Text style={styles.text}>
          O dourado é reservado ao Premium. Clientes Standard usam a identidade roxa da Nexa.
        </Text>
      </Card>

      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  priceCard: {
    backgroundColor: '#15130E',
    borderColor: '#8A6B2D',
  },
  goldLabel: {
    color: '#D8BC7A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  price: {
    color: '#D8BC7A',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
});
