import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AlignedLegacyApp from '../src/components/AlignedLegacyApp';
import { config } from '../src/config';
import { nexaApi } from '../src/lib/api';
import {
  clearNexaSession,
  loadNexaSession,
  saveNexaSession,
} from '../src/lib/session';
import { colors, spacing } from '../src/theme';

export default function LegacyExperience() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }

        let activeSession = session;
        let response;
        try {
          response = await nexaApi.me(activeSession.accessToken);
        } catch (caught) {
          if (caught?.status === 401 && activeSession.refreshToken) {
            const refreshed = await nexaApi.refresh(activeSession.refreshToken);
            const accessToken =
              refreshed.accessToken ||
              refreshed.access_token ||
              refreshed.token ||
              refreshed.tokens?.accessToken;
            const refreshToken =
              refreshed.refreshToken ||
              refreshed.refresh_token ||
              refreshed.tokens?.refreshToken ||
              activeSession.refreshToken;
            if (!accessToken) throw caught;

            activeSession = {
              accessToken,
              refreshToken,
              email: activeSession.email,
            };
            await saveNexaSession(activeSession);
            response = await nexaApi.me(accessToken);
          } else {
            throw caught;
          }
        }

        const currentUser = response?.user || response || null;
        if (!currentUser?.id) {
          throw new Error('Não foi possível restaurar sua conta Nexa.');
        }

        await AsyncStorage.multiSet([
          ['nexa_user', JSON.stringify(currentUser)],
          ['nexa_last_email', currentUser.email || activeSession.email],
          ['nexa_last_name', currentUser.fullName || ''],
        ]);

        if (mounted) {
          setUser(currentUser);
          setToken(activeSession.accessToken);
          setReady(true);
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível abrir sua conta.',
          );
        }
      }
    }

    void restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await AsyncStorage.multiRemove(['nexa_token', 'nexa_user']);
    await clearNexaSession({ preserveEmail: true });
    router.replace('/');
  }

  if (!ready || !user || !token) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.text}>{error || 'Abrindo sua conta Nexa...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <AlignedLegacyApp
        initialUser={user}
        token={token}
        onLogout={logout}
      />

      {config.efiOpenFinanceEnabled ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Trazer dinheiro de outro banco"
          activeOpacity={0.86}
          style={[
            styles.openFinanceButton,
            { bottom: config.assistantEnabled ? 154 : 96 },
          ]}
          onPress={() => router.push('/open-finance')}
        >
          <Text style={styles.openFinanceIcon}>🏦</Text>
          <Text style={styles.openFinanceLabel}>Trazer dinheiro</Text>
        </TouchableOpacity>
      ) : null}

      {config.assistantEnabled ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Abrir Assistente Nexa"
          activeOpacity={0.86}
          style={styles.assistantButton}
          onPress={() => router.push('/assistant')}
        >
          <Text style={styles.assistantIcon}>✦</Text>
          <Text style={styles.assistantLabel}>Assistente</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  text: { color: colors.muted, textAlign: 'center' },
  openFinanceButton: {
    position: 'absolute',
    right: 16,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#0d3b66',
    borderWidth: 1,
    borderColor: '#2563eb',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  openFinanceIcon: {
    fontSize: 17,
  },
  openFinanceLabel: {
    color: '#ffffff',
    fontWeight: '800',
  },
  assistantButton: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#6d28d9',
    borderWidth: 1,
    borderColor: '#8b5cf6',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  assistantIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  assistantLabel: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
