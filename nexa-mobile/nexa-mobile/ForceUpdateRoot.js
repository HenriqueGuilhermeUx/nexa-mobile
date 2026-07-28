import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SettlementAwareApp from './SettlementAwareApp';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
const CURRENT_VERSION = '1.4.7';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=br.com.trynexa.app';

function compareVersions(a, b) {
  const left = String(a || '0').split('.').map((item) => Number(item) || 0);
  const right = String(b || '0').split('.').map((item) => Number(item) || 0);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export default function ForceUpdateRoot({
  privyEnabled = false,
  privyConfigurationError = '',
}) {
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [offlineMessage, setOfflineMessage] = useState('');

  async function checkVersion() {
    setChecking(true);
    setOfflineMessage('');

    try {
      const response = await fetch(API + '/app/version', {
        headers: {
          'X-Nexa-App-Version': CURRENT_VERSION,
          'X-Nexa-Platform': 'android',
        },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Não foi possível validar a versão do aplicativo.');
      }

      setPolicy(data);
      setRequired(compareVersions(CURRENT_VERSION, data.minimumVersion) < 0);
    } catch (error) {
      setOfflineMessage(
        'Não foi possível validar a segurança desta versão. Verifique sua conexão e tente novamente.',
      );
      setRequired(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkVersion();
  }, []);

  async function openStore() {
    const url = policy?.playStoreUrl || PLAY_STORE_URL;
    await Linking.openURL(url);
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.title}>Validando versão segura...</Text>
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
            {offlineMessage ||
              policy?.message ||
              'Existe uma nova versão obrigatória da Nexa. Atualize para continuar usando o aplicativo.'}
          </Text>
          <Text style={styles.version}>
            Versão instalada: {CURRENT_VERSION}
            {policy?.minimumVersion ? `\nVersão mínima: ${policy.minimumVersion}` : ''}
          </Text>
          {!offlineMessage ? (
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

  return (
    <SettlementAwareApp
      privyEnabled={privyEnabled}
      privyConfigurationError={privyConfigurationError}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e40af',
    borderRadius: 24,
    padding: 28,
  },
  logo: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 14,
  },
  message: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  version: {
    color: '#93c5fd',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 21,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 24,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 14,
    marginTop: 8,
  },
  secondaryText: {
    color: '#93c5fd',
    textAlign: 'center',
    fontWeight: '800',
  },
});
