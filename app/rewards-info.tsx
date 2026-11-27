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
        O Nexa Rewards é opcional. Quando sua conta estiver habilitada, você poderá autorizar participação em estratégia de rendimento variável por meio do Privy Earn. O vault e seus riscos são identificados antes da operação.
      </Paragraph>

      <Card>
        <Text style={styles.title}>USDC separado do saldo disponível</Text>
        <Text style={styles.text}>
          O USDC autorizado para um vault de terceiro deixa de fazer parte do saldo livre da Wallet. A posição não representa depósito bancário e nenhuma aplicação é automática.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Protocolo e custos</Text>
        <Text style={styles.text}>
          O Nexa Rewards está sendo homologado com Privy Earn e vaults Steakhouse Prime USDC, powered by Morpho. Antes de confirmar, verifique o vault efetivo, a rede, os custos de movimentação e a parcela de rendimento destinada à Nexa.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Rendimento variável</Text>
        <Text style={styles.text}>
          O rendimento é variável e não garantido. Existem riscos de contratos inteligentes, stablecoin, liquidez, ponte entre redes e perda parcial ou total de recursos. Não é poupança, CDI ou produto garantido pelo FGC.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Resgate</Text>
        <Text style={styles.text}>
          A retirada depende de liquidez e processamento do vault, e pode exigir retorno entre redes. Acompanhe o status antes de repetir uma operação e confira as taxas apresentadas.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Sua carteira continua sendo sua</Text>
        <Text style={styles.text}>
          A movimentação exige a autorização individual do titular pela Privy. A Maya não pode aplicar ou retirar USDC automaticamente.
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
