import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '@/config';
import { FORCE_UPDATE_EVENT, ForceUpdatePolicyPayload } from '@/lib/forceUpdate';
import { colors, radius, spacing } from '@/theme';

type VersionPolicy = {
  success?: boolean;
  minimumVersion?: string;
  latestVersion?: string;
  minimumBuild?: number;
  latestBuild?: number;
  forceUpdate?: boolean;
  message?: string;
  playStoreUrl?: string;
};

function compareVersions(a: string, b: string) {
  const left = String(a || '0').split('.').map((item) => Number(item) || 0);
  const right = String(b || '0').split('.').map((item) => Number(item) || 0);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const l = left[index] || 0;
    const r = right[index] || 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function requiresUpdate(policy: VersionPolicy) {
  const minimumVersion = String(policy.minimumVersion || '').trim();
  const minimumBuild = Number(policy.minimumBuild || 0);
  const currentBuild = Number(config.appBuild || 0);

  const versionTooOld =
    Boolean(minimumVersion) &&
    compareVersions(config.appVersion, minimumVersion) < 0;
  const buildTooOld =
    Number.isFinite(minimumBuild) &&
    minimumBuild > 0 &&
    currentBuild < minimumBuild;

  return versionTooOld || buildTooOld;
}

export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [policy, setPolicy] = useState<VersionPolicy | null>(null);
  const [offline, setOffline] = useState(false);

  const checkVersion = useCallback(async () => {
    setChecking(true);
    setOffline(false);

    try {
      const response = await fetch(`${config.apiUrl}/app/version`, {
        headers: {
          'X-Nexa-App-Version': config.appVersion,
          'X-Nexa-App-Build': config.appBuild,
          'X-Nexa-Platform': Platform.OS,
        },
      });
      const payload = (await response.json()) as VersionPolicy;
      if (!response.ok || payload?.success !== true) {
        throw new Error('Não foi possível validar a versão do aplicativo.');
      }

      setPolicy(payload);
      setRequired(requiresUpdate(payload));
    } catch {
      // Financial app: fail closed when release policy cannot be validated.
      setOffline(true);
      setRequired(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkVersion();

    const subscription = DeviceEventEmitter.addListener(
      FORCE_UPDATE_EVENT,
      (nextPolicy: ForceUpdatePolicyPayload) => {
        setOffline(false);
        setPolicy(nextPolicy);
        setRequired(true);
        setChecking(false);
      },
    );

    return () => subscription.remove();
  }, [checkVersion]);

  async function openStore() {
    const url =
      policy?.playStoreUrl ||
      'https://play.google.com/store/apps/details?id=br.com.trynexa.app';
    await Linking.openURL(url);
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>Validando a versão da Nexa…</Text>
      </SafeAreaView>
    );
  }

  if (required) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.logo}>NEXA</Text>
          <Text style={styles.title}>Atualização obrigatória</Text>
          <Text style={styles.message}>
            {offline
              ? 'Não foi possível validar a versão segura da Nexa. Verifique sua conexão e tente novamente.'
              : policy?.message ||
                'Existe uma nova versão obrigatória da Nexa. Atualize para continuar.'}
          </Text>
          <Text style={styles.version}>
            Versão instalada: {config.appVersion} · build {config.appBuild}
            {!offline && policy?.minimumVersion
              ? `\nVersão mínima: ${policy.minimumVersion} · build ${policy.minimumBuild || '-'}`
              : ''}
          </Text>

          {!offline ? (
            <TouchableOpacity style={styles.button} onPress={openStore}>
              <Text style={styles.buttonText}>Atualizar na Google Play</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.secondaryButton} onPress={checkVersion}>
            <Text style={styles.secondaryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  logo: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  message: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  version: {
    color: '#C4B5FD',
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 21,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  secondaryText: {
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '800',
  },
});
