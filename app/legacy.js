import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import LegacyApp from '../nexa-mobile/nexa-mobile/App';
import { nexaApi } from '../src/lib/api';
import { installLegacyFinancialFetchBridge } from '../src/lib/legacy-financial-fetch-bridge';
import { clearNexaSession, loadNexaSession } from '../src/lib/session';
import { colors, spacing } from '../src/theme';

export default function LegacyExperience() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    let restoreFinancialBridge = null;

    async function bridgeSession() {
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }

        const response = await nexaApi.me(session.accessToken);
        const user = response?.user || response || null;
        if (!user?.id) throw new Error('Não foi possível restaurar sua conta Nexa.');

        await AsyncStorage.multiSet([
          ['nexa_token', session.accessToken],
          ['nexa_user', JSON.stringify(user)],
          ['nexa_last_email', user.email || session.email],
          ['nexa_last_name', user.fullName || ''],
        ]);

        restoreFinancialBridge = installLegacyFinancialFetchBridge(
          session.accessToken,
        );

        if (mounted) setReady(true);
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

    void bridgeSession();
    return () => {
      mounted = false;
      restoreFinancialBridge?.();
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;

    const timer = setInterval(() => {
      void (async () => {
        const legacyToken = await AsyncStorage.getItem('nexa_token');
        if (legacyToken) return;
        await clearNexaSession();
        router.replace('/');
      })();
    }, 800);

    return () => clearInterval(timer);
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.text}>{error || 'Abrindo sua conta Nexa...'}</Text>
      </View>
    );
  }

  return <LegacyApp />;
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
