import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { DirectUsdcReceivePanel } from '@/components/DirectUsdcReceivePanel';
import { loadNexaSession } from '@/lib/session';

/**
 * Isolated route for direct incoming native USDC on Polygon.
 * Unlinked from production navigation until receiving endpoint is deployed
 * after fresh Privy audit and tested on physical mobile devices.
 */
export default function DirectUsdcReceiveRoute() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true;
    loadNexaSession()
      .then(session => { if (mounted) setToken(session?.accessToken ?? null); })
      .catch(() => { if (mounted) setToken(null); });
    return () => { mounted = false; };
  }, []);
  if (token === undefined) {
    return <View style={{padding: 24}}><ActivityIndicator accessibilityLabel="Verificando login Nexa" /></View>;
  }
  if (!token) return <Redirect href="/sign-in" />;
  return <DirectUsdcReceivePanel accessToken={token} />;
}
