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
        O Nexa Rewards é opcional. Se estiver habilitado para sua conta, você poderá autorizar a participação em uma estratégia de rendimento variável via Privy Earn, com protocolo externo identificado antes da operação.
      </Paragraph>

      <Card>
        <Text style={styles.title}>Saldo separado da carteira</Text>
        <Text style={styles.text}>
          O valor enviado para um vault de terceiro deixa de estar disponível como saldo livre da sua carteira. Uma posição no vault não é um saldo bancário nem uma aplicação feita automaticamente pela Nexa.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Protocolo e custos</Text>
        <Text style={styles.text}>
          Antes de confirmar, confira o protocolo e o vault, a rede de destino, eventuais custos de passagem entre redes, taxas da estratégia e remuneração aplicável à Nexa. Essas informações devem corresponder ao serviço efetivamente configurado.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Rendimento variável</Text>
        <Text style={styles.text}>
          O rendimento não é fixo nem garantido. Há riscos de stablecoin, smart contracts, pontes entre redes, liquidez e perda parcial ou total dos fundos. Não é poupança, CDI nem possui garantia do FGC.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Resgate</Text>
        <Text style={styles.text}>
          A retirada depende da liquidez e do processamento do protocolo. Se houver passagem entre redes, o retorno à sua carteira também precisa ser concluído. Acompanhe a ação pendente antes de repetir qualquer pedido.
        </Text>
      </Card>

      <Card>
        <Text style={styles.title}>Sua carteira continua sendo sua</Text>
        <Text style={styles.text}>
          Cada depósito ou retirada requer sua autorização individual pela carteira Privy. O Rewards não deve movimentar recursos por ordem automática da Maya.
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
