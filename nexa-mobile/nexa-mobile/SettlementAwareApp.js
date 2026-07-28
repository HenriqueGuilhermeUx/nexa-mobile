import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import App from './App';
import PrivyWalletOnboarding from './PrivyWalletOnboarding';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
const SESSION_POLL_MS = 700;

function getErrorMessage(data, fallback) {
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || data?.error || fallback;
}

function LoadingScreen({ message }) {
  return (
    <SafeAreaView style={styles.centered}>
      <ActivityIndicator size="large" />
      <Text style={styles.loadingTitle}>NEXA</Text>
      <Text style={styles.loadingMessage}>{message}</Text>
    </SafeAreaView>
  );
}

function BlockingScreen({ title, message, onRetry, onLogout }) {
  return (
    <SafeAreaView style={styles.centered}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>PROTEÇÃO DE CONTA</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{message}</Text>
        {onRetry ? (
          <TouchableOpacity style={styles.button} onPress={onRetry}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.secondaryButton} onPress={onLogout}>
          <Text style={styles.secondaryText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DirectSettlementStatus({ user, profile, onRefresh, onLogout }) {
  const wallet = profile?.wallet || {};
  const address = String(wallet.address || user?.walletAddress || '');
  const ready = Boolean(profile?.directSettlementReady);
  const featureFlagEnabled = Boolean(profile?.featureFlagEnabled);
  const executable = Boolean(profile?.executable);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logo}>NEXA</Text>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>CARTEIRA INDIVIDUAL</Text>
          <Text style={styles.title}>Sua carteira está vinculada.</Text>
          <Text style={styles.description}>
            O novo fluxo de liquidação direta está em homologação segura. Nenhum Pix ou USDC será movimentado enquanto as travas financeiras permanecerem desligadas.
          </Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Perfil</Text>
            <Text style={styles.statusValue}>direct_settlement</Text>
          </View>
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Endereço Polygon</Text>
            <Text selectable style={styles.address}>{address || 'Aguardando endereço'}</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusMiniCard}>
              <Text style={styles.statusLabel}>Auditoria</Text>
              <Text style={ready ? styles.ok : styles.pending}>
                {ready ? 'Aprovada' : 'Pendente'}
              </Text>
            </View>
            <View style={styles.statusMiniCard}>
              <Text style={styles.statusLabel}>Execução</Text>
              <Text style={executable ? styles.ok : styles.pending}>
                {executable ? 'Liberada' : 'Bloqueada'}
              </Text>
            </View>
          </View>

          {!featureFlagEnabled ? (
            <View style={styles.safeBox}>
              <Text style={styles.safeTitle}>Modo seguro ativo</Text>
              <Text style={styles.safeText}>
                DIRECT_SETTLEMENT_ENABLED continua desligado. Esta tela confirma apenas identidade e carteira.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.button} onPress={onRefresh}>
            <Text style={styles.buttonText}>Atualizar status</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onLogout}>
            <Text style={styles.secondaryText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SettlementAwareApp({
  privyEnabled = false,
  privyConfigurationError = '',
}) {
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionToken, setSessionToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [appKey, setAppKey] = useState(0);

  const readSession = useCallback(async () => {
    try {
      const [storedUser, storedToken] = await Promise.all([
        AsyncStorage.getItem('nexa_user'),
        AsyncStorage.getItem('nexa_token'),
      ]);
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const normalizedToken = String(storedToken || '');

      setSessionUser((current) => {
        const currentId = current?.id || '';
        const nextId = parsedUser?.id || '';
        return currentId === nextId && JSON.stringify(current) === JSON.stringify(parsedUser)
          ? current
          : parsedUser;
      });
      setSessionToken((current) => (current === normalizedToken ? current : normalizedToken));

      if (!parsedUser || !normalizedToken) {
        setProfile(null);
        setProfileError('');
        setCheckingProfile(false);
      }
    } catch (error) {
      setProfileError('Não foi possível ler a sessão segura deste aparelho.');
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!sessionToken || !sessionUser?.id) return;

    try {
      setCheckingProfile(true);
      setProfileError('');
      const response = await fetch(API + '/direct-settlement/profile', {
        headers: {
          Authorization: 'Bearer ' + sessionToken,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.profile) {
        throw new Error(getErrorMessage(data, 'Não foi possível classificar o perfil de liquidação.'));
      }
      setProfile(data.profile);
      global.__nexaSettlementProfile = data.profile;
    } catch (error) {
      setProfile(null);
      setProfileError(String(error?.message || error));
    } finally {
      setCheckingProfile(false);
    }
  }, [sessionToken, sessionUser?.id]);

  const refreshUserAndProfile = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const response = await fetch(API + '/user/me', {
        headers: {
          Authorization: 'Bearer ' + sessionToken,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.id) {
        await AsyncStorage.setItem('nexa_user', JSON.stringify(data));
        setSessionUser(data);
      }
    } catch (error) {
      // O perfil direto continua sendo a fonte para decidir o fluxo.
    }

    await loadProfile();
  }, [sessionToken, loadProfile]);

  const logoutNexa = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem('nexa_user'),
      AsyncStorage.removeItem('nexa_token'),
    ]);
    global.__nexaSettlementProfile = null;
    setSessionUser(null);
    setSessionToken('');
    setProfile(null);
    setProfileError('');
    setCheckingProfile(false);
    setAppKey((value) => value + 1);
  }, []);

  useEffect(() => {
    readSession();
    const interval = setInterval(readSession, SESSION_POLL_MS);
    return () => clearInterval(interval);
  }, [readSession]);

  useEffect(() => {
    if (sessionToken && sessionUser?.id) {
      loadProfile();
    }
  }, [sessionToken, sessionUser?.id, loadProfile]);

  if (!sessionToken || !sessionUser) {
    return <App key={'login-' + appKey} />;
  }

  if (checkingProfile && !profile) {
    return <LoadingScreen message="Validando o perfil seguro da sua conta..." />;
  }

  if (profileError && !profile) {
    return (
      <BlockingScreen
        title="Não foi possível validar sua conta"
        message={profileError}
        onRetry={loadProfile}
        onLogout={logoutNexa}
      />
    );
  }

  if (!profile) {
    return <LoadingScreen message="Preparando sua experiência Nexa..." />;
  }

  if (profile.isLegacyBeta || profile.settlementProfile === 'legacy_beta') {
    return <App key={'legacy-' + appKey} />;
  }

  const walletLinked = Boolean(profile?.wallet?.linked);

  if (!walletLinked) {
    if (!privyEnabled) {
      return (
        <BlockingScreen
          title="Carteira individual aguardando configuração"
          message={
            privyConfigurationError ||
            'O App Client móvel da Privy ainda não foi configurado para esta versão.'
          }
          onRetry={loadProfile}
          onLogout={logoutNexa}
        />
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>NEXA</Text>
          <PrivyWalletOnboarding
            user={sessionUser}
            nexaToken={sessionToken}
            onLinked={refreshUserAndProfile}
            onExit={logoutNexa}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <DirectSettlementStatus
      user={sessionUser}
      profile={profile}
      onRefresh={refreshUserAndProfile}
      onLogout={logoutNexa}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  centered: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 44,
  },
  logo: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 20,
  },
  loadingMessage: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 12,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#244980',
    borderRadius: 28,
    padding: 22,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    color: '#ffffff',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    marginTop: 10,
  },
  description: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  statusBox: {
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 15,
    marginTop: 14,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  statusMiniCard: {
    flex: 1,
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 15,
  },
  statusLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  statusValue: {
    color: '#ffffff',
    fontWeight: '800',
    marginTop: 6,
  },
  address: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  ok: {
    color: '#34d399',
    fontWeight: '900',
    marginTop: 6,
  },
  pending: {
    color: '#fbbf24',
    fontWeight: '900',
    marginTop: 6,
  },
  safeBox: {
    backgroundColor: '#082f49',
    borderWidth: 1,
    borderColor: '#0e7490',
    borderRadius: 16,
    padding: 15,
    marginTop: 14,
  },
  safeTitle: {
    color: '#a5f3fc',
    fontWeight: '900',
  },
  safeText: {
    color: '#bae6fd',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '900',
  },
  secondaryButton: {
    paddingVertical: 14,
    marginTop: 5,
  },
  secondaryText: {
    color: '#93c5fd',
    textAlign: 'center',
    fontWeight: '800',
  },
});
