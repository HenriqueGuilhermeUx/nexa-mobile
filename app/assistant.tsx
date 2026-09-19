import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import NexaAssistant from '@/components/NexaAssistant';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, spacing } from '@/theme';

export default function AssistantScreen() {
  const [token, setToken] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const session = await loadNexaSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }

        const profile = await nexaApi.me(session.accessToken);
        const user = profile?.user || profile || {};

        if (mounted) {
          setToken(session.accessToken);
          setFirstName(String(user?.fullName || '').split(' ')[0]);
        }
      } catch (caught: any) {
        if (mounted) {
          setError(caught?.message || 'Não foi possível abrir o Assistente Nexa.');
        }
      }
    }

    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  if (!token) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.text}>{error || 'Abrindo Assistente Nexa...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <NexaAssistant token={token} firstName={firstName} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  text: {
    color: colors.muted,
    textAlign: 'center',
  },
});
