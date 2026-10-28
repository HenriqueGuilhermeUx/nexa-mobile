import React, {useEffect, useState} from 'react';
import {router, useLocalSearchParams} from 'expo-router';
import {ActivityIndicator, Text, View} from 'react-native';

import {nexaApi} from '@/lib/api';
import {config} from '@/config';
import {assertReownExternalWalletReady} from '@/lib/externalWalletReownGate';
import {loadNexaSession} from '@/lib/session';
import {colors} from '@/theme';

// Manual, internal-development route only: nexa://wallet-connect-qa
// Do not expose it from the production navigation or start Reown on app boot.
const qaEnabled = process.env.EXPO_PUBLIC_NEXA_WALLETCONNECT_QA_ENABLED === 'true' &&
  (__DEV__ || config.releaseChannel === 'preview');
type QaRuntime = {
  Component: React.ComponentType<any>;
  instance: unknown;
  accessToken: string;
};

export default function WalletConnectQaRoute() {
  const params = useLocalSearchParams<{market?: string | string[]}>();
  const requestedMarket = Array.isArray(params.market) ? params.market[0] : params.market;
  const market: 'BR' | 'GLOBAL' = requestedMarket === 'GLOBAL' ? 'GLOBAL' : 'BR';
  const [runtime, setRuntime] = useState<QaRuntime | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!qaEnabled) {
      setError('Conexão externa em homologação. Esta versão não habilita o piloto.');
      return () => {active = false;};
    }
    void (async () => {
      try {
        // Fail closed before loading native SDK code or opening a provider.
        const ready = assertReownExternalWalletReady({
          enabled: true,
          projectId: process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID,
          licenseApproved: process.env.EXPO_PUBLIC_NEXA_REOWN_LICENSE_APPROVED === 'true',
          nativeBuildVerified: process.env.EXPO_PUBLIC_NEXA_REOWN_NATIVE_QA_VERIFIED === 'true',
          nativeQaMode: __DEV__,
          environment: __DEV__ ? 'development' : 'preview',
        });
        if (!ready.ready || ready.transferEnabled !== false) {
          throw new Error('Homologação nativa indisponível.');
        }
        const session = await loadNexaSession();
        if (!session?.accessToken || !session.email) {
          if (active) router.replace('/sign-in');
          return;
        }
        // Authentication is verified against the real Nexa session;
        // the external wallet remains strictly local and view-only.
        const profile = await nexaApi.me(session.accessToken);
        const user = profile?.user || profile;
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email || email !== session.email.trim().toLowerCase()) {
          throw new Error('A identidade Nexa não pôde ser confirmada.');
        }
        if (!active) return;
        // Load Reown only after all explicit QA, licensing and auth gates.
        const {initializeExternalWalletAppKit} = require('../src/lib/reownExternalWalletAppKit');
        const {StagedExternalWalletConnect} = require('../src/components/StagedExternalWalletConnect');
        const instance = initializeExternalWalletAppKit({
          enabled: true,
          projectId: process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID,
          licenseApproved: true,
          nativeBuildVerified: process.env.EXPO_PUBLIC_NEXA_REOWN_NATIVE_QA_VERIFIED === 'true',
          nativeQaMode: __DEV__,
          environment: __DEV__ ? 'development' : 'preview',
        });
        if (active) setRuntime({Component: StagedExternalWalletConnect, instance, accessToken: session.accessToken});
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'A conexão de teste está indisponível.');
      }
    })();
    return () => {active = false;};
  }, []);

  if (runtime) {
    const {Component, instance, accessToken} = runtime;
    return <Component instance={instance} accessToken={accessToken} market={market} mode="view-only" />;
  }
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background}}>
      {!error ? <ActivityIndicator color={colors.primary} /> : null}
      <Text style={{color: colors.text, textAlign: 'center', marginTop: 12}}>
        {error || 'Conferindo sessão Nexa e preparando conexão externa de homologação…'}
      </Text>
    </View>
  );
}
