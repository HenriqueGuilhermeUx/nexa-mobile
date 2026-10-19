import React, { useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { StagedExternalWalletConnect } from '@/components/StagedExternalWalletConnect';
import { initializeExternalWalletAppKit } from '@/lib/reownExternalWalletAppKit';
import { loadNexaSession } from '@/lib/session';

/**
 * Staging-only Expo Router page, deliberately NOT linked from the home menu.
 * A release build remains blocked by default and no transfer is possible.
 * EXPO_PUBLIC flags are UX controls, never financial authorization.
 */
export default function ExternalWalletConnectStagingRoute() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    loadNexaSession().then(s => {
      if (mounted) setToken(s?.accessToken ?? null);
    }).catch(() => {
      if (mounted) setToken(null);
    });
    return () => { mounted = false; };
  }, []);

  const result = useMemo(() => {
    // Do not initialize third-party wallet SDK before Nexa auth is verified.
    if (!token) return { instance: null, error: 'AUTH_REQUIRED' };
    try {
      const environment = __DEV__ ? 'development'
        : process.env.EXPO_PUBLIC_NEXA_WALLET_STAGING_BUILD === 'true' ? 'preview' : 'production';
      const instance = initializeExternalWalletAppKit({
        enabled: process.env.EXPO_PUBLIC_NEXA_REOWN_ENABLED === 'true',
        // Public legacy Criptozen Reown project ID supplied for Nexa staging only.
        // Production remains forbidden and the existing project must be relabeled/allowlisted in Dashboard.
        projectId: process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID ||
          (environment !== 'production' ? '0d9b915b32c04b058efeba535319dd70' : undefined),
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
  }, [token]);

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
  return <StagedExternalWalletConnect accessToken={token} instance={result.instance} />;
}
