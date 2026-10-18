import React, { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { ExternalUsdcInboundPreviewPanel } from '@/components/ExternalUsdcInboundPreviewPanel';
import { loadNexaSession } from '@/lib/session';
import type { InboundMarket } from '@/lib/externalUsdcInboundPreview';

/**
 * Standalone staging route. Not registered in the user's home navigation.
 * Only renders a preview; never connects to a wallet or sends transactions.
 */
export default function ExternalInboundPreviewRoute() {
  const params = useLocalSearchParams<{ market?: string }>();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    loadNexaSession()
      .then(session => { if (active) setToken(session?.accessToken ?? null); })
      .catch(() => { if (active) setToken(null); });
    return () => { active = false; };
  }, []);
  if (token === undefined) {
    return <View style={{ padding: 24 }}><ActivityIndicator accessibilityLabel="Verificando sessão" /></View>;
  }
  if (!token) return <Redirect href="/sign-in" />;
  // No user-controlled selection of an arbitrary unsupported market.
  const market: InboundMarket = params.market === 'GLOBAL' ? 'GLOBAL' : 'BR';
  return <ExternalUsdcInboundPreviewPanel accessToken={token} market={market} />;
}
