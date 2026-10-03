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

export default function RewardsInfoScreen() {
  return (
    <Screen>
      <Eyebrow>REWARDS</Eyebrow>
      <Title>Como funciona o Rewards.</Title>
      <Paragraph>
        O Rewards permite separar uma parte do seu USDC para participar de produtos elegíveis da Nexa.
      </Paragraph>

      <Card>
        <Text style={styles.title}>Saldo bloqueado</Text>
        <Text style={styles.text}>
          O USDC escolhido fica bloqueado enquanto participa do Rewards e deixa de fazer parte do saldo livre para movimentação.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Alocação e spread</Text>
        <Text style={styles.text}>
          A Nexa aloca o saldo em produtos elegíveis e repassa ao cliente o rendimento apurado com spread aplicado pela Nexa.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Rendimento variável</Text>
        <Text style={styles.text}>
          O rendimento não é fixo nem garantido. Ele varia conforme os produtos utilizados, condições de mercado e custos aplicáveis.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Resgate</Text>
        <Text style={styles.text}>
          O resgate segue a liquidez e o processamento do produto. A Nexa mostra o status da solicitação no app e evita repetir uma ação financeira sem confirmação.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Sua carteira continua sendo sua</Text>
        <Text style={styles.text}>
          Quando uma autorização da carteira for necessária, você confirma a operação. A Nexa não assina movimentações da sua carteira por você.
        </Text>
      </Card>

      <ActionButton label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  },
});
