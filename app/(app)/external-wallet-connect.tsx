import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { StagedExternalWalletConnect } from '@/components/StagedExternalWalletConnect';
import { nexaApi } from '@/lib/api';
import { config } from '@/config';
import { initializeExternalWalletAppKit } from '@/lib/reownExternalWalletAppKit';
import { loadNexaSession } from '@/lib/session';

/**
 * Staging-only Expo Router page, deliberately NOT linked from the home menu.
 * A release build remains blocked by default and no transfer is possible.
 * EXPO_PUBLIC flags are UX controls, never financial authorization.
 */
export default function ExternalWalletConnectStagingRoute() {
  const params = useLocalSearchParams<{market?: string}>();
  const market: 'BR' | 'GLOBAL' = params.market === 'GLOBAL' ? 'GLOBAL' : 'BR';
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [authError, setAuthError] = useState('');
  const qaChannel = config.releaseChannel === 'wallet-inbound-lab';
  useEffect(() => {
    let mounted = true;
    if (!qaChannel) {
      setAuthError('Este recurso está desabilitado fora da homologação Nexa.');
      return () => { mounted = false; };
    }
    void (async () => {
      try {
        const session = await loadNexaSession();
        if (!mounted) return;
        if (!session?.accessToken || !session.email) {
          setToken(null);
          return;
        }
        // A local token alone is insufficient: verify its Nexa identity
        // against the authenticated backend before initializing Reown.
        const profile = await nexaApi.me(session.accessToken);
        if (!mounted) return;
        const user = profile?.user || profile;
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email || email !== session.email.trim().toLowerCase()) {
          throw new Error('A identidade da sessão Nexa não pôde ser confirmada.');
        }
        setToken(session.accessToken);
      } catch (error) {
        if (mounted) setAuthError(error instanceof Error ? error.message : 'Não foi possível validar o login Nexa.');
      }
    })();
    return () => { mounted = false; };
  }, [qaChannel]);

  const result = useMemo(() => {
    // Do not initialize third-party wallet SDK before Nexa auth is verified.
    if (!token || !qaChannel) return { instance: null, error: 'QA_AUTH_REQUIRED' };
    try {
      const environment = __DEV__ ? 'development'
        : process.env.EXPO_PUBLIC_NEXA_WALLET_STAGING_BUILD === 'true' ? 'preview' : 'production';
      const instance = initializeExternalWalletAppKit({
        enabled: process.env.EXPO_PUBLIC_NEXA_REOWN_ENABLED === 'true',
        // Project ID is configured only by the isolated EAS lab profile.
        projectId: process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID,
        licenseApproved: process.env.EXPO_PUBLIC_NEXA_REOWN_LICENSE_REVIEWED === 'true',
        nativeBuildVerified: process.env.EXPO_PUBLIC_NEXA_REOWN_NATIVE_VERIFIED === 'true',
        nativeQaMode: process.env.EXPO_PUBLIC_NEXA_REOWN_NATIVE_QA_MODE === 'true' &&
          process.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL === 'wallet-inbound-lab',
        environment,
      });
      return { instance, error: null as string | null };
    } catch (e) {
      return { instance: null, error: e instanceof Error ? e.message : 'WALLET_CONNECTION_DISABLED' };
    }
  }, [token, qaChannel]);

  if (authError) return <View style={{padding: 24}}><Text>{authError}</Text></View>;
  if (token === undefined) return <View style={{padding: 24}}><ActivityIndicator accessibilityLabel="Verificando sessão Nexa" /></View>;
  if (!token) return <Redirect href="/sign-in" />;
  if (!result.instance) {
    return (
      <View style={{padding: 24, gap: 12}}>
        <Text style={{fontSize: 20, fontWeight: '700'}}>Conexão externa — homologação</Text>
        <Text>Este fluxo não está habilitado neste aplicativo. Nenhuma carteira será conectada.</Text>
        <Text>Estado técnico: {result.error}</Text>
      </View>
    );
  }
  return <StagedExternalWalletConnect accessToken={token} instance={result.instance} market={market} mode="view-only" />;
}
