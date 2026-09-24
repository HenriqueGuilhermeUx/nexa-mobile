import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  authenticateDevice,
  isAppLockEnabled,
} from '@/lib/appLock';
import {
  clearNexaTokens,
  hasNexaSessionMarker,
} from '@/lib/session';
import { colors, radius, spacing } from '@/theme';
import { ActionButton, Brand, Paragraph, Title } from './ui';

const BACKGROUND_RELOCK_MS = 30_000;

export function AppLockGate({ children }: PropsWithChildren) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [childrenMounted, setChildrenMounted] = useState(false);
  const [error, setError] = useState('');
  const backgroundAt = useRef<number | null>(null);
  const authenticatingRef = useRef(false);

  const unlock = useCallback(async () => {
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setAuthenticating(true);
    setError('');

    const result = await authenticateDevice('Acessar a Nexa');
    if (result.success) {
      backgroundAt.current = null;
      setLocked(false);
      setChildrenMounted(true);
    } else {
      setLocked(true);
      if (
        !['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error)
      ) {
        setError(
          'Não foi possível validar sua identidade. Tente novamente ou entre com sua senha Nexa.',
        );
      }
    }

    authenticatingRef.current = false;
    setAuthenticating(false);
  }, []);

  const lockIfRequired = useCallback(
    async (prompt = true) => {
      const [enabled, sessionPresent] = await Promise.all([
        isAppLockEnabled(),
        hasNexaSessionMarker(),
      ]);

      if (!enabled || !sessionPresent) {
        setLocked(false);
        setChildrenMounted(true);
        return false;
      }

      setLocked(true);
      if (prompt) void unlock();
      return true;
    },
    [unlock],
  );

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const [enabled, sessionPresent] = await Promise.all([
        isAppLockEnabled(),
        hasNexaSessionMarker(),
      ]);
      if (!mounted) return;

      setChecking(false);
      if (enabled && sessionPresent) {
        setLocked(true);
        void unlock();
      } else {
        setLocked(false);
        setChildrenMounted(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [unlock]);

  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = previousState === 'active';
      const isActive = nextState === 'active';
      previousState = nextState;

      if (wasActive && !isActive && !authenticatingRef.current) {
        backgroundAt.current = Date.now();
        return;
      }

      if (!wasActive && isActive && childrenMounted && backgroundAt.current) {
        const elapsed = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (elapsed >= BACKGROUND_RELOCK_MS) {
          void lockIfRequired(true);
        }
      }
    });

    return () => subscription.remove();
  }, [childrenMounted, lockIfRequired]);

  async function useNexaPassword() {
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setAuthenticating(true);
    setError('');

    // Remove only session tokens. The e-mail stays available on the sign-in screen
    // and the app-lock preference remains enabled for the next authenticated session.
    await clearNexaTokens();
    backgroundAt.current = null;
    setLocked(false);
    setChildrenMounted(true);

    authenticatingRef.current = false;
    setAuthenticating(false);
  }

  const showOverlay = checking || locked;

  return (
    <View style={styles.root}>
      {childrenMounted ? children : null}

      {showOverlay ? (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Brand />
            {checking ? (
              <>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.helper}>Verificando proteção do aparelho...</Text>
              </>
            ) : (
              <>
                <Title>Nexa protegida</Title>
                <Paragraph>
                  Confirme sua identidade com biometria ou com a credencial de desbloqueio do aparelho.
                </Paragraph>
                <ActionButton
                  label="Desbloquear Nexa"
                  loading={authenticating}
                  onPress={unlock}
                />
                <ActionButton
                  label="Entrar com senha Nexa"
                  variant="secondary"
                  disabled={authenticating}
                  onPress={useNexaPassword}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.lg,
  },
  helper: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
