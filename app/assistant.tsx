import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import NexaAssistantOpenFinance from '@/components/NexaAssistantOpenFinance';
import { nexaApi } from '@/lib/api';
import {
  ensureNexaNotificationPermission,
  showNexaNotification,
} from '@/lib/nexaNotifications';
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

        try {
          const permission = await ensureNexaNotificationPermission();
          if (permission.newlyGranted) {
            await showNexaNotification(
              'Notificações da Nexa ativadas',
              'Seus avisos, lembretes e compromissos poderão aparecer aqui no celular.',
              { source: 'nexa_assistant', type: 'notifications_enabled' },
            );
          }
        } catch (notificationError) {
          console.warn('Nexa notification permission setup failed', notificationError);
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
      <View style={{marginBottom: 12}}>
        <Text style={{color: colors.text, fontSize: 24, fontWeight: '800'}}>Maya</Text>
        <Text style={{color: colors.muted, marginTop: 3}}>Sua assistente inteligente</Text>
      </View>
      {process.env.EXPO_PUBLIC_NEXA_MAYA_PREMIUM_ENABLED === 'true' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir consultoria financeira da Maya" onPress={() => router.push('/maya-premium' as any)} style={{padding: 14, marginBottom: 12, borderRadius: 10, backgroundColor: '#2777CC'}}>
          <Text style={{color: '#FFFFFF', fontWeight: '700', textAlign: 'center'}}>Maya · Consultoria financeira Premium</Text>
        </Pressable>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{flexGrow: 0, marginBottom: 10}}
        contentContainerStyle={{gap: 8, paddingRight: 16}}>
        {([
          {title: 'Meu dia', path: '/maya-hoje'},
          {title: 'Tarefas', path: '/maya-actions'},
          {title: 'Metas', path: '/maya-planning'},
          {title: 'Pesquisar', path: '/maya-shopping'},
          {title: 'Mensagens', path: '/maya-comunicacao'},
        ] as const).map(item => (
          <Pressable key={item.path} accessibilityRole="button"
            accessibilityLabel={`Maya: abrir ${item.title}`}
            onPress={() => router.push(item.path)}
            style={{borderWidth: 1, borderColor: '#35506B',
              backgroundColor: '#102438', borderRadius: 18,
              paddingHorizontal: 13, paddingVertical: 10, minHeight: 42,
              justifyContent: 'center'}}>
            <Text style={{color: colors.text, fontWeight: '700', fontSize: 13}}>{item.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <NexaAssistantOpenFinance token={token} firstName={firstName} />
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
