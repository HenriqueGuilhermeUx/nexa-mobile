import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { config } from '@/config';
import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import {
  markEcosystemWelcomeSeen,
} from '@/lib/ecosystemOnboarding';
import { openNexaEcosystemProduct } from '@/lib/nexaEcosystem';
import { nexaApi } from '@/lib/api';
import { resolveAuthenticatedRoute } from '@/lib/onboarding';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

type Product = 'docwallet' | 'healthwallet';

export default function EcosystemWelcomeScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Product | ''>('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;

    void (async () => {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in' as any);
        return;
      }

      try {
        const nextProfile = await nexaApi.me(session.accessToken);
        if (!alive) return;
        setAccessToken(session.accessToken);
        setProfile(nextProfile);
      } catch {
        if (!alive) return;
        setMessage('Não conseguimos carregar sua conta agora.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function activate(product: Product) {
    if (!accessToken || busy) return;

    setBusy(product);
    setMessage('');
    try {
      await openNexaEcosystemProduct(accessToken, product);
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Não foi possível abrir este produto agora. Você pode continuar na Nexa e tentar depois.',
      );
    } finally {
      setBusy('');
    }
  }

  async function continueNexa() {
    if (!profile || !accessToken) return;

    setLoading(true);
    setMessage('');
    try {
      await markEcosystemWelcomeSeen(profile);
      const target = await resolveAuthenticatedRoute(profile, accessToken);
      router.replace(target as any);
    } catch {
      setMessage('Não conseguimos continuar o onboarding agora.');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Brand />
      <Badge tone="success">IDENTIDADE NEXA PRONTA</Badge>
      <Title>Seu controle pode ir além do dinheiro.</Title>
      <Paragraph>
        Seu Nexa ID já pode conectar você aos outros produtos do ecossistema sem
        criar outra senha ou repetir seu cadastro.
      </Paragraph>

      {config.docWalletEnabled ? (
        <Card>
          <Text style={styles.productEyebrow}>DOCUMENTOS</Text>
          <Text style={styles.productTitle}>DocWallet Docs</Text>
          <Text style={styles.productPromise}>Seus documentos. Seu controle.</Text>
          <Text style={styles.productText}>
            Organize documentos, acompanhe assinaturas e mantenha suas informações
            no produto responsável por elas.
          </Text>
          <ActionButton
            label={busy === 'docwallet' ? 'Abrindo...' : 'Ativar e conhecer'}
            loading={busy === 'docwallet'}
            disabled={loading || Boolean(busy)}
            onPress={() => activate('docwallet')}
          />
        </Card>
      ) : null}

      {config.healthWalletEnabled ? (
        <Card>
          <Text style={styles.productEyebrow}>SAÚDE</Text>
          <Text style={styles.productTitle}>Health Wallet</Text>
          <Text style={styles.productPromise}>Sua saúde. Seu controle.</Text>
          <Text style={styles.productText}>
            Acesse consultas, exames e sua organização de saúde em um produto
            separado, conectado pelo seu Nexa ID.
          </Text>
          <ActionButton
            label={busy === 'healthwallet' ? 'Abrindo...' : 'Ativar e conhecer'}
            loading={busy === 'healthwallet'}
            disabled={loading || Boolean(busy)}
            onPress={() => activate('healthwallet')}
          />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.staffTitle}>Staff dentro da Nexa</Text>
        <Text style={styles.staffText}>
          Depois que você ativar um produto, o Staff pode mostrar apenas pequenos
          avisos autorizados — como uma consulta próxima ou uma assinatura
          pendente — e levar você ao app certo. O conteúdo continua no produto de
          origem.
        </Text>
      </Card>

      <ActionButton
        label="Agora não — continuar na Nexa"
        variant="secondary"
        loading={loading}
        disabled={!profile || !accessToken || Boolean(busy)}
        onPress={continueNexa}
      />

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          A ativação é opcional. Nexa Wallet, DocWallet Docs e Health Wallet
          permanecem produtos separados, com dados e sessões próprios.
        </Text>
      </View>

      {message ? <Text style={styles.error}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  productEyebrow: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  productTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  productPromise: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  productText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  staffTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  staffText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  disclaimer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  disclaimerText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
