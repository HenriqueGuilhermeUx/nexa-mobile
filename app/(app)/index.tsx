import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { config } from '@/config';
import {
  globalCapabilityEnabled,
  loadGlobalCapabilityContext,
} from '@/lib/globalCapabilities';
import { NEXA_GLOBAL_PRODUCT } from '@/lib/globalProduct';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function FeatureCard(props: {
  title: string;
  text: string;
  action: string;
  onPress: () => void;
  primary?: boolean;
  enabled?: boolean;
}) {
  return (
    <Pressable
      disabled={props.enabled === false}
      onPress={props.onPress}
      style={[
        styles.featureCard,
        props.primary ? styles.featureCardPrimary : null,
        props.enabled === false ? styles.featureCardDisabled : null,
      ]}
    >
      <Text style={styles.featureTitle}>{props.title}</Text>
      <Text style={styles.featureText}>{props.text}</Text>
      <Text style={styles.featureAction}>
        {props.enabled === false ? 'Indisponível no momento' : `${props.action} →`}
      </Text>
    </Pressable>
  );
}

export default function NexaGlobalHome() {
  const [capabilities, setCapabilities] = useState<any>(null);
  const [countryCode, setCountryCode] = useState('');
  const [capabilityMessage, setCapabilityMessage] = useState(
    'Confirmando disponibilidade no seu país…',
  );

  useEffect(() => {
    let mounted = true;

    if (!config.globalProduct) {
      setCapabilityMessage('');
      return () => {
        mounted = false;
      };
    }

    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!session) throw new Error('Sua sessão Nexa expirou.');
        const context = await loadGlobalCapabilityContext(session.accessToken);
        if (!mounted || !context) return;
        setCapabilities(context.capabilities);
        setCountryCode(context.countryCode);
        setCapabilityMessage(
          'Recursos em prévia permanecem bloqueados até a liberação do backend.',
        );
      } catch (caught) {
        if (!mounted) return;
        setCapabilities(null);
        setCapabilityMessage(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível confirmar a disponibilidade agora.',
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!config.globalProduct) {
    return <Redirect href={'/legacy' as any} />;
  }

  const canSendNexa = globalCapabilityEnabled(capabilities, 'nexaUserTransfer');
  const canFund = globalCapabilityEnabled(capabilities, 'fundUsdc');
  const canReceive = globalCapabilityEnabled(capabilities, 'receiveUsdc');
  const canBrazilPix = globalCapabilityEnabled(capabilities, 'brazilPix');
  const canBrazilBillPay = globalCapabilityEnabled(capabilities, 'brazilBillPay');
  const canBuyAssets = globalCapabilityEnabled(capabilities, 'buyAssets');

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
        <Badge tone={canSendNexa ? 'info' : 'warning'}>
          {canSendNexa ? 'PRINCIPAL' : 'AGUARDANDO LIBERAÇÃO'}
        </Badge>
        <Text style={styles.heroTitle}>Enviar para @Nexa User</Text>
        <Text style={styles.heroText}>
          A forma mais simples de mandar valor para alguém no ecossistema Nexa.
          Você informa o @username, revisa o USDC e autoriza na sua própria
          wallet.
        </Text>
        <ActionButton
          label="Enviar para @username"
          disabled={!canSendNexa}
          onPress={() => router.push('/(app)/send-nexa' as any)}
        />
      </Card>

      <View style={styles.grid}>
        <FeatureCard
          title="Adicionar USDC"
          text="Cartão, Apple Pay, Google Pay ou outro método disponível para sua região."
          action="Adicionar"
          enabled={canFund}
          onPress={() => router.push('/(app)/fund-card' as any)}
        />
        <FeatureCard
          title="Receber USDC"
          text="Use sua wallet Nexa para receber USDC de outra wallet ou exchange compatível."
          action="Ver wallet"
          enabled={canReceive}
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
          enabled={canBrazilPix}
          onPress={() => router.push('/(app)/cash-out' as any)}
        />
        <FeatureCard
          title="Pagar conta no Brasil"
          text="Agende pagamento de boleto ou QR Pix brasileiro usando a infraestrutura Nexa."
          action="Pagar conta"
          enabled={canBrazilBillPay}
          onPress={() => router.push('/(app)/pay' as any)}
        />
        <FeatureCard
          title="BTC, ETH e Ouro"
          text="Use USDC para acessar Bitcoin, Ether e ouro digital quando disponíveis."
          action="Comprar ativos"
          enabled={canBuyAssets}
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
        <Text style={styles.noteTitle}>
          {countryCode ? `Disponibilidade · ${countryCode}` : 'Disponibilidade'}
        </Text>
        <Text style={styles.note}>{capabilityMessage}</Text>
      </Card>

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
  featureCardDisabled: {
    opacity: 0.5,
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
