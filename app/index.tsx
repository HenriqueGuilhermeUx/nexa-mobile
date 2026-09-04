import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Brand,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { ApiError, nexaApi } from '@/lib/api';
import {
  clearNexaTokens,
  loadNexaSession,
  migrateLegacySession,
  saveNexaSession,
} from '@/lib/session';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      await migrateLegacySession();
      let session = await loadNexaSession();
      if (!mounted) return;

      if (session) {
        try {
          const profile = await nexaApi.me(session.accessToken);
          if (!mounted) return;
          router.replace(
            profile?.kycStatus === 'approved'
              ? ('/legacy' as any)
              : ('/kyc' as any),
          );
          return;
        } catch (caught) {
          if (
            caught instanceof ApiError &&
            caught.status === 401 &&
            session?.refreshToken
          ) {
            try {
              const refreshed = await nexaApi.refresh(session.refreshToken);
              const tokens = {
                accessToken:
                  refreshed.accessToken ||
                  refreshed.access_token ||
                  refreshed.token ||
                  refreshed.tokens?.accessToken,
                refreshToken:
                  refreshed.refreshToken ||
                  refreshed.refresh_token ||
                  refreshed.tokens?.refreshToken ||
                  session.refreshToken,
              };
              if (!tokens.accessToken) throw new Error('Refresh inválido');

              await saveNexaSession({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                email: session.email,
              });

              session = {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                email: session.email,
              };

              const profile = await nexaApi.me(tokens.accessToken);
              if (!mounted) return;
              router.replace(
                profile?.kycStatus === 'approved'
                  ? ('/legacy' as any)
                  : ('/kyc' as any),
              );
              return;
            } catch {
              await clearNexaTokens();
              if (mounted) setChecking(false);
              return;
            }
          }

          if (caught instanceof ApiError && caught.status === 401) {
            await clearNexaTokens();
            if (mounted) setChecking(false);
            return;
          }

          // Uma indisponibilidade momentânea do backend não bloqueia um cliente
          // já autenticado de abrir a experiência existente.
          router.replace('/legacy' as any);
          return;
        }
      }
      setChecking(false);
    }

    void resolveSession();
    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loaderText}>Abrindo a Nexa...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Brand />
        <View style={styles.hero}>
          <Title>Cripto sem complicação.</Title>
          <Paragraph>
            Pix e USDC em uma experiência simples, segura e transparente.
          </Paragraph>
        </View>

        <ActionButton label="Entrar" onPress={() => router.push('/sign-in')} />
        <ActionButton
          label="Criar conta"
          variant="secondary"
          onPress={() => router.push('/sign-up')}
        />
      </View>
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
  content: { flex: 1, justifyContent: 'center' },
  hero: { marginVertical: spacing.xl },
});
