import { useEffect, useMemo, useState } from 'react';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Badge,
  Brand,
  Card,
  Eyebrow,
  KeyValue,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

function valueFromProfile(response: any) {
  return response?.profile || response || {};
}

export default function WalletOnboardingScreen() {
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const wallet = useMemo(
    () =>
      wallets.find((candidate) =>
        /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || '')),
      ) || null,
    [wallets],
  );

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!privy.isReady) return;
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        const response = await nexaApi.directProfile(session.accessToken);
        if (!mounted) return;
        const nextProfile = valueFromProfile(response);
        setProfile(nextProfile);

        const settlementProfile = String(
          nextProfile.settlementProfile || '',
        ).toLowerCase();
        if (settlementProfile.includes('legacy')) {
          router.replace('/(app)');
          return;
        }
        if (nextProfile.wallet?.linked === true) {
          router.replace('/(app)');
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível carregar o perfil de liquidação.',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [privy.isReady]);

  async function createWallet() {
    setError('');
    setLinking(true);
    try {
      if (!embedded.create) {
        throw new Error('A criação de carteira não está disponível nesta sessão.');
      }
      await embedded.create({ createAdditional: false });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível criar a carteira individual.',
      );
    } finally {
      setLinking(false);
    }
  }

  async function linkWallet() {
    setError('');
    setLinking(true);
    try {
      const session = await loadNexaSession();
      if (!session) {
        router.replace('/sign-in');
        return;
      }
      if (!wallet?.address) {
        throw new Error('A carteira Privy ainda não está pronta.');
      }

      const getAccessToken = privy.getAccessToken;
      if (typeof getAccessToken !== 'function') {
        throw new Error('A sessão Privy não disponibilizou o token de acesso.');
      }
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) {
        throw new Error('A sessão Privy expirou. Entre novamente.');
      }

      const privyWalletId = String(
        wallet.id || wallet.walletId || wallet.address,
      );
      await nexaApi.linkWallet(session.accessToken, privyAccessToken, {
        privyWalletId,
        walletAddress: wallet.address,
      });
      await nexaApi.auditWallet(session.accessToken);
      const updated = await nexaApi.directProfile(session.accessToken);
      setProfile(valueFromProfile(updated));
      router.replace('/(app)');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível vincular a carteira.',
      );
    } finally {
      setLinking(false);
    }
  }

  if (loading || !privy.isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Verificando seu perfil e sua carteira...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Brand />
      <Badge tone="info">CARTEIRA INDIVIDUAL</Badge>
      <View style={styles.topSpace} />
      <Eyebrow>Última etapa do acesso</Eyebrow>
      <Title>Conecte sua conta à carteira correta.</Title>
      <Paragraph>
        A Nexa deriva sua identidade do token da Privy, confere o mesmo e-mail e
        valida a propriedade da carteira antes de salvar o vínculo.
      </Paragraph>

      <Card>
        <KeyValue
          label="Carteira Privy detectada"
          value={wallet?.address || 'Aguardando criação'}
        />
        <KeyValue
          label="Rede patrimonial"
          value={profile?.wallet?.network || 'Polygon'}
        />
        <KeyValue
          label="Perfil Nexa"
          value={profile?.settlementProfile || 'Direto'}
        />
      </Card>

      {!wallet ? (
        <ActionButton
          label="Criar minha carteira individual"
          loading={linking}
          onPress={createWallet}
        />
      ) : (
        <ActionButton
          label="Validar e vincular carteira"
          loading={linking}
          onPress={linkWallet}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={styles.ruleCard}>
        <Text style={styles.ruleTitle}>Proteções desta etapa</Text>
        <Text style={styles.ruleItem}>• o token Privy não entra no corpo da requisição;</Text>
        <Text style={styles.ruleItem}>• o app não envia privyUserId informado pelo cliente;</Text>
        <Text style={styles.ruleItem}>• a mesma wallet não pode pertencer a duas contas Nexa;</Text>
        <Text style={styles.ruleItem}>• usuários Beta/Legacy não são migrados automaticamente.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loaderText: { color: colors.muted, textAlign: 'center' },
  topSpace: { height: spacing.lg },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  ruleCard: { marginTop: spacing.xl },
  ruleTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  ruleItem: { color: colors.muted, lineHeight: 21, marginTop: 5 },
});
