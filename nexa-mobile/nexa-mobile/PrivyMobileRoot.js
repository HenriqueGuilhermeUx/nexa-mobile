import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAccessToken,
  PrivyProvider,
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/expo';
import App from './App';
import ForceUpdateRoot from './ForceUpdateRoot';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
const PRIVY_APP_ID = 'cmpen2gm3007v0cjswjlyefji';
const PRIVY_CLIENT_ID =
  'client-WY6ZY2Ptr39FTjXumMRAfqM2Bx8m9DUWxcU1kwXxJGPh3';

const POLL_INTERVAL_MS = 2000;
const WALLET_WAIT_ATTEMPTS = 30;
const WALLET_WAIT_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeMessage(data, fallback) {
  if (typeof data?.message === 'string') return data.message;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

function normalizeProfile(payload) {
  return payload?.profile || payload?.data?.profile || null;
}

function walletIdentity(wallet) {
  if (!wallet) return null;
  const address = String(wallet.address || '').trim();
  const id = String(
    wallet.id || wallet.walletId || wallet.wallet_id || wallet.meta?.id || '',
  ).trim();
  if (!address || !id) return null;
  return { address, id };
}

function FullScreenStatus({ title, message, loading, actionLabel, onAction }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.logo}>NEXA</Text>
        {loading ? <ActivityIndicator size="large" /> : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{message}</Text>
        {actionLabel && onAction ? (
          <TouchableOpacity style={styles.button} onPress={onAction}>
            <Text style={styles.buttonText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PrivyOnboardingBoundary({ children }) {
  const { isReady, user: privyUser, logout: privyLogout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { wallets } = useEmbeddedEthereumWallet();

  const [nexaUser, setNexaUser] = useState(null);
  const [nexaToken, setNexaToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');

  const lastSessionKey = useRef('');
  const walletsRef = useRef(wallets);

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  const readNexaSession = useCallback(async () => {
    const [storedUser, storedToken] = await Promise.all([
      AsyncStorage.getItem('nexa_user'),
      AsyncStorage.getItem('nexa_token'),
    ]);

    let parsedUser = null;
    try {
      parsedUser = storedUser ? JSON.parse(storedUser) : null;
    } catch (_) {
      parsedUser = null;
    }

    const token = storedToken || '';
    const sessionKey = `${parsedUser?.id || ''}:${token ? '1' : '0'}`;

    setNexaUser(parsedUser);
    setNexaToken(token);

    if (lastSessionKey.current !== sessionKey) {
      lastSessionKey.current = sessionKey;
      setProfile(null);
      setProfileError('');
      setCodeSent(false);
      setOtpCode('');
      setMessage('');
      setError('');
      setCompleted(false);
      setCompletionMessage('');

      if (!token && privyUser && typeof privyLogout === 'function') {
        try {
          await privyLogout();
        } catch (_) {}
      }
    }
  }, [privyLogout, privyUser]);

  useEffect(() => {
    readNexaSession().catch(() => {});
    const timer = setInterval(() => {
      readNexaSession().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [readNexaSession]);

  const loadProfile = useCallback(async () => {
    if (!nexaToken || !nexaUser?.id) return null;
    setChecking(true);
    setProfileError('');
    try {
      const response = await fetch(API + '/direct-settlement/profile', {
        headers: { Authorization: 'Bearer ' + nexaToken },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          safeMessage(data, 'Não foi possível consultar o perfil da carteira.'),
        );
      }
      const nextProfile = normalizeProfile(data);
      if (!nextProfile) {
        throw new Error('O backend não retornou o perfil de liquidação da conta.');
      }
      setProfile(nextProfile);
      return nextProfile;
    } catch (requestError) {
      const nextError =
        requestError?.message || 'Falha ao consultar o perfil da carteira.';
      setProfileError(nextError);
      return null;
    } finally {
      setChecking(false);
    }
  }, [nexaToken, nexaUser?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function sendOtp() {
    if (!nexaUser?.email) {
      setError('A conta Nexa não possui e-mail para autenticação da carteira.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendCode({ email: nexaUser.email });
      setCodeSent(true);
      setMessage('Código enviado para ' + nexaUser.email + '.');
    } catch (sendError) {
      setError(sendError?.message || 'Não foi possível enviar o código da Privy.');
    } finally {
      setBusy(false);
    }
  }

  async function waitForWallet() {
    for (let attempt = 0; attempt < WALLET_WAIT_ATTEMPTS; attempt += 1) {
      const current = walletIdentity(walletsRef.current?.[0]);
      if (current) return current;
      await delay(WALLET_WAIT_MS);
    }
    return walletIdentity(walletsRef.current?.[0]);
  }

  async function saveWalletLocally(wallet) {
    const storedUser = await AsyncStorage.getItem('nexa_user');
    let parsedUser = {};
    try {
      parsedUser = storedUser ? JSON.parse(storedUser) : {};
    } catch (_) {
      parsedUser = {};
    }

    const updatedUser = {
      ...parsedUser,
      walletAddress: wallet.address,
      walletProvider: 'privy',
      walletNetwork: 'polygon',
    };
    await AsyncStorage.setItem('nexa_user', JSON.stringify(updatedUser));
    setNexaUser(updatedUser);
  }

  async function linkAndAuditWallet(wallet) {
    const privyAccessToken = await getAccessToken();
    if (!privyAccessToken) {
      throw new Error('A Privy não forneceu um access token válido.');
    }

    const linkResponse = await fetch(API + '/direct-settlement/wallet/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + nexaToken,
        'x-privy-access-token': 'Bearer ' + privyAccessToken,
      },
      body: JSON.stringify({
        privyWalletId: wallet.id,
        walletAddress: wallet.address,
      }),
    });
    const linkData = await linkResponse.json().catch(() => ({}));
    if (!linkResponse.ok) {
      throw new Error(
        safeMessage(linkData, 'A carteira não pôde ser vinculada à conta Nexa.'),
      );
    }

    await saveWalletLocally(wallet);

    const auditResponse = await fetch(API + '/direct-settlement/wallet/audit', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + nexaToken },
    });
    const auditData = await auditResponse.json().catch(() => ({}));

    await loadProfile();

    if (auditResponse.ok) {
      setCompletionMessage(
        'Carteira individual criada, vinculada e auditada. A execução financeira continua desativada durante a homologação.',
      );
    } else {
      setCompletionMessage(
        safeMessage(
          auditData,
          'A carteira foi criada e vinculada. A auditoria de custódia permanece pendente e nenhuma movimentação financeira foi liberada.',
        ),
      );
    }
    setCompleted(true);
  }

  async function confirmOtpAndLink() {
    const code = String(otpCode || '').trim();
    if (code.length < 4) {
      setError('Digite o código recebido por e-mail.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('Autenticando e criando sua carteira individual...');
    try {
      await loginWithCode({ code, email: nexaUser.email });
      const wallet = await waitForWallet();
      if (!wallet) {
        throw new Error(
          'A autenticação foi concluída, mas a carteira ainda não ficou disponível. Toque em concluir vínculo para tentar novamente.',
        );
      }
      await linkAndAuditWallet(wallet);
    } catch (loginError) {
      setError(loginError?.message || 'Não foi possível concluir a carteira Privy.');
    } finally {
      setBusy(false);
    }
  }

  async function retryExistingPrivySession() {
    setBusy(true);
    setError('');
    setMessage('Localizando sua carteira Privy...');
    try {
      const wallet = await waitForWallet();
      if (!wallet) {
        throw new Error('Nenhuma carteira Privy foi encontrada nesta sessão.');
      }
      await linkAndAuditWallet(wallet);
    } catch (retryError) {
      setError(retryError?.message || 'Não foi possível concluir o vínculo da carteira.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPrivySession() {
    setBusy(true);
    setError('');
    try {
      if (typeof privyLogout === 'function') await privyLogout();
      setCodeSent(false);
      setOtpCode('');
      setMessage('Sessão Privy encerrada. Solicite um novo código para o e-mail Nexa.');
    } catch (logoutError) {
      setError(logoutError?.message || 'Não foi possível trocar a conta Privy.');
    } finally {
      setBusy(false);
    }
  }

  if (!nexaToken || !nexaUser?.id) return children;

  if ((checking || !profile) && !profileError) {
    return (
      <FullScreenStatus
        loading
        title="Validando sua carteira"
        message="Confirmando o perfil da conta antes de liberar o painel."
      />
    );
  }

  if (!profile) {
    return (
      <FullScreenStatus
        title="Não foi possível validar a carteira"
        message={profileError || 'Tente novamente com a conexão ativa.'}
        actionLabel="Tentar novamente"
        onAction={loadProfile}
      />
    );
  }

  if (profile.isLegacyBeta || profile.settlementProfile === 'legacy_beta') {
    return children;
  }

  if (completed) {
    return (
      <FullScreenStatus
        title="Carteira conectada"
        message={completionMessage}
        actionLabel="Continuar para a Nexa"
        onAction={() => setCompleted(false)}
      />
    );
  }

  if (profile.wallet?.linked) return children;

  if (profile.settlementProfile !== 'direct_settlement') {
    return (
      <FullScreenStatus
        title="Perfil de carteira não reconhecido"
        message="A conta não foi alterada. Entre em contato com o suporte antes de continuar."
        actionLabel="Consultar novamente"
        onAction={loadProfile}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.logo}>NEXA</Text>
          <Text style={styles.title}>Crie sua carteira individual</Text>
          <Text style={styles.description}>
            Confirme o mesmo e-mail usado na Nexa. A Privy criará uma carteira
            individual vinculada à sua conta. A Nexa não recebe sua chave privada.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>E-mail da conta Nexa</Text>
            <Text style={styles.infoValue}>{nexaUser.email}</Text>
          </View>

          {!isReady ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Inicializando segurança Privy...</Text>
            </View>
          ) : null}

          {isReady && !codeSent && !privyUser ? (
            <TouchableOpacity
              style={[styles.button, busy && styles.disabled]}
              disabled={busy}
              onPress={sendOtp}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Enviando...' : 'Enviar código de confirmação'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isReady && codeSent && !privyUser ? (
            <>
              <TextInput
                style={styles.input}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Código recebido por e-mail"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity
                style={[styles.button, busy && styles.disabled]}
                disabled={busy}
                onPress={confirmOtpAndLink}
              >
                <Text style={styles.buttonText}>
                  {busy ? 'Criando carteira...' : 'Confirmar e criar carteira'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                disabled={busy}
                onPress={sendOtp}
              >
                <Text style={styles.secondaryText}>Reenviar código</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {isReady && privyUser ? (
            <>
              <TouchableOpacity
                style={[styles.button, busy && styles.disabled]}
                disabled={busy}
                onPress={retryExistingPrivySession}
              >
                <Text style={styles.buttonText}>
                  {busy ? 'Vinculando...' : 'Concluir vínculo da carteira'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                disabled={busy}
                onPress={resetPrivySession}
              >
                <Text style={styles.secondaryText}>Usar outra conta Privy</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.safety}>
            A execução financeira permanece desativada durante a homologação. Este
            processo não movimenta Pix nem USDC.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PrivyMobileRoot() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <ForceUpdateRoot>
        <PrivyOnboardingBoundary>
          <App />
        </PrivyOnboardingBoundary>
      </ForceUpdateRoot>
    </PrivyProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 24,
    padding: 24,
  },
  statusCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 24,
    padding: 28,
  },
  logo: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 18,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 14,
  },
  infoBox: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    marginTop: 22,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  loadingText: {
    color: '#cbd5e1',
    marginLeft: 10,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    color: '#ffffff',
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 20,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
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
  success: {
    color: '#86efac',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 21,
  },
  error: {
    color: '#fca5a5',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 21,
  },
  safety: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 22,
  },
});
