import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AlignedLegacyApp from '../src/components/AlignedLegacyApp';
import { nexaApi } from '../src/lib/api';
import { clearNexaSession, loadNexaSession } from '../src/lib/session';
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

        const response = await nexaApi.me(session.accessToken);
        const currentUser = response?.user || response || null;
        if (!currentUser?.id) {
          throw new Error('Não foi possível restaurar sua conta Nexa.');
        }

        await AsyncStorage.multiSet([
          ['nexa_token', session.accessToken],
          ['nexa_user', JSON.stringify(currentUser)],
          ['nexa_last_email', currentUser.email || session.email],
          ['nexa_last_name', currentUser.fullName || ''],
        ]);

        if (mounted) {
          setUser(currentUser);
          setToken(session.accessToken);
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
    await clearNexaSession();
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
    <AlignedLegacyApp
      initialUser={user}
      token={token}
      onLogout={logout}
    />
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
  text: { color: colors.muted, textAlign: 'center' },
});
