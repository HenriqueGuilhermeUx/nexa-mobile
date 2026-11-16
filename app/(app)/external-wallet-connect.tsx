import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { nexaApi } from '@/lib/api';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import { DirectMetaMaskSignClientQa } from '@/components/DirectMetaMaskSignClientQa';

/**
 * Staging-only Expo Router page, deliberately NOT linked from the home menu.
 * A release build remains blocked by default and no transfer is possible.
 * EXPO_PUBLIC flags are UX controls, never financial authorization.
 */
export default function ExternalWalletConnectStagingRoute() {
  const params = useLocalSearchParams<{market?: string; connector?: string}>();
  const market: 'BR' | 'GLOBAL' = params.market === 'GLOBAL' ? 'GLOBAL' : 'BR';
  const showReown = params.connector === 'reown';
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [authError, setAuthError] = useState('');
  const qaChannel = config.releaseChannel === 'wallet-inbound-lab' &&
    process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED === 'false';
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
    if (!token || !qaChannel || !showReown) return { instance: null, Component: null, error: 'QA_AUTH_REQUIRED' };
    try {
      // The EVM SDK is never evaluated before Nexa authenticates the session
      // and the non-financial QA channel is explicitly active.
      const { initializeExternalWalletAppKit } =
        require('../../src/lib/reownExternalWalletAppKit') as typeof import('@/lib/reownExternalWalletAppKit');
      const { StagedExternalWalletConnect } =
        require('../../src/components/StagedExternalWalletConnect') as typeof import('@/components/StagedExternalWalletConnect');
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
      return { instance, Component: StagedExternalWalletConnect, error: null as string | null };
    } catch (e) {
      return { instance: null, Component: null, error: e instanceof Error ? e.message : 'WALLET_CONNECTION_DISABLED' };
    }
  }, [token, qaChannel, showReown]);

  if (authError) return <View style={{padding: 24}}><Text>{authError}</Text></View>;
  if (token === undefined) return <View style={{padding: 24}}><ActivityIndicator accessibilityLabel="Verificando sessão Nexa" /></View>;
  if (!token) return <Redirect href="/sign-in" />;
  // Main QA flow runs SignClient by itself: no AppKit, EthersAdapter,
  // UniversalProvider or Reown modal may initialize in parallel.
  if (!showReown) {
    return (
      <ScrollView style={{flex:1,backgroundColor:'#061626'}}
        contentContainerStyle={{padding:18,paddingBottom:60,gap:16}}>
        <Text style={{fontSize:23,fontWeight:'800',color:'#ffffff'}}>
          Conectar carteira externa — Nexa QA
        </Text>
        <Text style={{color:'#d3e3f4'}}>
          Conecte sua MetaMask usando somente o SignClient. Sem operações financeiras neste teste.
        </Text>
        <DirectMetaMaskSignClientQa />
        <Pressable accessibilityRole="button" onPress={()=>router.replace({
          pathname:'/(app)/external-wallet-connect',
          params:{market,connector:'reown'},
        } as any)} style={{padding:15,backgroundColor:'#1a3655',borderRadius:10}}>
          <Text style={{color:'white',textAlign:'center'}}>Testar outras carteiras (Reown experimental)</Text>
        </Pressable>
      </ScrollView>
    );
  }
  if (!result.instance || !result.Component) {
    return (
      <View style={{padding: 24, gap: 12}}>
        <Text style={{fontSize: 20, fontWeight: '700'}}>Conexão externa — homologação</Text>
        <Text>Este fluxo não está habilitado neste aplicativo. Nenhuma carteira será conectada.</Text>
        <Text>Estado técnico: {result.error}</Text>
      </View>
    );
  }
  const ConnectedWallet = result.Component;
  return <ConnectedWallet accessToken={token} instance={result.instance} market={market} mode="view-only" />;
}
