import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ActionButton,
  Brand,
  Paragraph,
  Screen,
  Title,
} from '@/components/ui';
import { ApiError, nexaApi } from '@/lib/api';
import { resolveAuthenticatedRoute } from '@/lib/onboarding';
import {
  clearNexaTokens,
  loadNexaSession,
  migrateLegacySession,
  saveNexaSession,
} from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

const INTRO = [
  {
    kicker: 'NEXA GLOBAL',
    title: 'USDC. Across borders.',
    text: 'A wallet-first way to move value globally and keep Brazil within reach.',
    symbol: 'N',
    caption: 'USDC-first global experience',
  },
  {
    kicker: 'SEND SIMPLY',
    title: 'Start with @username.',
    text: 'Send USDC to another Nexa user without turning blockchain details into the main experience.',
    symbol: '@',
    caption: 'Nexa User is the primary global route',
  },
  {
    kicker: 'BRAZIL WITHIN REACH',
    title: 'More than a transfer.',
    text: 'Use supported Brazil utilities, including Pix settlement and Brazilian bill payment.',
    symbol: 'PIX',
    caption: 'Nexa Global → Nexa User → Brazil',
  },
];

export default function WelcomeScreen() {
  const [checking, setChecking] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [introStep, setIntroStep] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function resolveSession() {
      setStartupError('');
      await migrateLegacySession();
      let session = await loadNexaSession();
      if (!mounted) return;

      if (session) {
        try {
          const profile = await nexaApi.me(session.accessToken);
          if (!mounted) return;
          const target = await resolveAuthenticatedRoute(
            profile,
            session.accessToken,
          );
          router.replace(target as any);
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
              const target = await resolveAuthenticatedRoute(
                profile,
                tokens.accessToken,
              );
              router.replace(target as any);
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

          if (mounted) {
            setStartupError(
              'We could not confirm your account right now. Your session was preserved and no transaction was started.',
            );
            setChecking(false);
          }
          return;
        }
      }
      setChecking(false);
    }

    void resolveSession();
    return () => {
      mounted = false;
    };
  }, [retryKey]);

  if (checking) {
    return (
      <View style={styles.loader}>
        <View style={styles.loaderBrand}>
          <Brand />
        </View>
        <View style={styles.loaderMark}>
          <Text style={styles.loaderMarkText}>N</Text>
        </View>
        <ActivityIndicator color={colors.cyan} size="small" />
        <Text style={styles.loaderTitle}>Opening Nexa Global</Text>
        <Text style={styles.loaderText}>
          Confirming your session and preparing your Global wallet.
        </Text>
      </View>
    );
  }

  const current = INTRO[introStep];
  const last = introStep === INTRO.length - 1;

  return (
    <Screen>
      <View style={styles.content}>
        <Brand />

        <View style={styles.progressRow}>
          {INTRO.map((_, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Ir para apresentação ${index + 1}`}
              onPress={() => setIntroStep(index)}
              style={[
                styles.progressDot,
                index === introStep ? styles.progressDotActive : null,
              ]}
            />
          ))}
        </View>

        <View style={styles.visual}>
          <View style={styles.visualHalo} />
          <View style={styles.visualCard}>
            <Text style={styles.visualSymbol}>{current.symbol}</Text>
            <Text style={styles.visualCaption}>{current.caption}</Text>
          </View>
        </View>

        <Text style={styles.kicker}>{current.kicker}</Text>
        <Title>{current.title}</Title>
        <Paragraph>{current.text}</Paragraph>

        {startupError ? (
          <>
            <Text style={styles.startupError}>{startupError}</Text>
            <ActionButton
              label="Try again"
              variant="secondary"
              onPress={() => {
                setChecking(true);
                setRetryKey((value) => value + 1);
              }}
            />
          </>
        ) : null}

        {last ? (
          <>
            <ActionButton
              label="Start Nexa Global"
              onPress={() => router.push('/sign-up-country' as any)}
            />
            <ActionButton
              label="I already have an account"
              variant="secondary"
              onPress={() => router.push('/sign-in')}
            />
          </>
        ) : (
          <>
            <ActionButton
              label="Continuar"
              onPress={() =>
                setIntroStep((value) => Math.min(value + 1, INTRO.length - 1))
              }
            />
            <ActionButton
              label="Já tenho uma conta"
              variant="secondary"
              onPress={() => router.push('/sign-in')}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loaderBrand: {
    position: 'absolute',
    top: 72,
    left: spacing.lg,
  },
  loaderMark: {
    width: 78,
    height: 78,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  loaderMarkText: {
    color: colors.cyan,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -2,
  },
  loaderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  loaderText: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    width: 42,
    backgroundColor: colors.cyan,
  },
  visual: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  visualHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primarySoft,
    opacity: 0.52,
  },
  visualCard: {
    width: 164,
    minHeight: 142,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  visualSymbol: {
    color: colors.cyan,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  visualCaption: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  kicker: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: spacing.sm,
  },
  startupError: {
    color: colors.text,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
