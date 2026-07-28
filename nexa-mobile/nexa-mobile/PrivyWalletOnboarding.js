import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getAccessToken,
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/expo';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';

function getApiMessage(data, fallback) {
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || data?.error || fallback;
}

export default function PrivyWalletOnboarding({
  user,
  nexaToken,
  onLinked,
  onExit,
}) {
  const email = String(user?.email || '').trim().toLowerCase();
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Confirme o mesmo e-mail usado na Nexa.');
  const linkingRef = useRef(false);

  const { isReady, user: privyUser, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { wallets } = useEmbeddedEthereumWallet();

  const wallet = Array.isArray(wallets) ? wallets[0] : null;

  async function requestCode() {
    if (!email) {
      setStatus('A conta Nexa não possui um e-mail válido.');
      return;
    }
    if (!isReady) {
      setStatus('A Privy ainda está inicializando. Aguarde alguns segundos.');
      return;
    }

    try {
      setBusy(true);
      setStatus('Enviando código de segurança...');
      await sendCode({ email });
      setCodeSent(true);
      setStatus('Código enviado para ' + email + '.');
    } catch (error) {
      setStatus('Não foi possível enviar o código: ' + String(error?.message || error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    const normalizedCode = String(code || '').replace(/\s/g, '');
    if (normalizedCode.length < 4) {
      setStatus('Digite o código recebido por e-mail.');
      return;
    }

    try {
      setBusy(true);
      setStatus('Confirmando sua identidade na Privy...');
      await loginWithCode({ email, code: normalizedCode });
      setStatus('Identidade confirmada. Criando sua carteira individual...');
    } catch (error) {
      setStatus('Código inválido ou expirado: ' + String(error?.message || error));
    } finally {
      setBusy(false);
    }
  }

  async function linkWallet() {
    if (linkingRef.current || !privyUser || !wallet || !nexaToken) return;

    const walletId = String(wallet.id || wallet.walletId || '').trim();
    const walletAddress = String(wallet.address || '').trim();
    if (!walletId || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      setStatus('A carteira Privy ainda está sendo preparada.');
      return;
    }

    linkingRef.current = true;
    setBusy(true);
    setStatus('Vinculando sua carteira à conta Nexa...');

    try {
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) {
        throw new Error('A sessão Privy não forneceu um access token válido.');
      }

      const linkResponse = await fetch(API + '/direct-settlement/wallet/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + nexaToken,
          'x-privy-access-token': 'Bearer ' + privyAccessToken,
        },
        body: JSON.stringify({
          privyWalletId: walletId,
          walletAddress,
        }),
      });
      const linkData = await linkResponse.json().catch(() => ({}));
      if (!linkResponse.ok || !linkData.success) {
        throw new Error(getApiMessage(linkData, 'Não foi possível vincular a carteira.'));
      }

      setStatus('Carteira vinculada. Executando auditoria de propriedade...');
      const auditResponse = await fetch(API + '/direct-settlement/wallet/audit', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + nexaToken,
        },
      });
      const auditData = await auditResponse.json().catch(() => ({}));

      const profileResponse = await fetch(API + '/direct-settlement/profile', {
        headers: {
          Authorization: 'Bearer ' + nexaToken,
        },
      });
      const profileData = await profileResponse.json().catch(() => ({}));
      if (!profileResponse.ok || !profileData.success) {
        throw new Error(getApiMessage(profileData, 'A carteira foi vinculada, mas o perfil não pôde ser atualizado.'));
      }

      setStatus(
        auditResponse.ok
          ? 'Carteira individual vinculada e auditada com sucesso.'
          : 'Carteira vinculada. A auditoria permanece pendente para revisão segura.',
      );

      await onLinked?.({
        link: linkData,
        audit: auditData,
        auditOk: auditResponse.ok,
        profile: profileData.profile,
        wallet: {
          id: walletId,
          address: walletAddress,
        },
      });
    } catch (error) {
      linkingRef.current = false;
      setStatus(String(error?.message || error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPrivySession() {
    try {
      setBusy(true);
      await logout();
      linkingRef.current = false;
      setCode('');
      setCodeSent(false);
      setStatus('Sessão Privy encerrada. Solicite um novo código para ' + email + '.');
    } catch (error) {
      setStatus('Não foi possível reiniciar a sessão Privy: ' + String(error?.message || error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isReady && privyUser && wallet) {
      linkWallet();
    }
  }, [isReady, privyUser?.id, wallet?.id, wallet?.address, nexaToken]);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>CARTEIRA INDIVIDUAL NEXA</Text>
      <Text style={styles.title}>Proteja seu patrimônio com sua própria carteira.</Text>
      <Text style={styles.description}>
        A Nexa usa a Privy para criar uma carteira vinculada à sua identidade. Use exatamente o e-mail {email}.
      </Text>

      <View style={styles.emailBox}>
        <Text style={styles.emailLabel}>E-mail Nexa</Text>
        <Text style={styles.email}>{email || 'E-mail indisponível'}</Text>
      </View>

      {!privyUser && !codeSent ? (
        <TouchableOpacity disabled={busy} style={styles.button} onPress={requestCode}>
          <Text style={styles.buttonText}>Enviar código de segurança</Text>
        </TouchableOpacity>
      ) : null}

      {!privyUser && codeSent ? (
        <>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="Código recebido"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity disabled={busy} style={styles.button} onPress={confirmCode}>
            <Text style={styles.buttonText}>Confirmar identidade</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} style={styles.secondaryButton} onPress={requestCode}>
            <Text style={styles.secondaryText}>Reenviar código</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {privyUser && !wallet ? (
        <View style={styles.waitingBox}>
          <ActivityIndicator />
          <Text style={styles.waitingText}>Criando sua carteira EVM individual...</Text>
        </View>
      ) : null}

      {privyUser && wallet && !busy ? (
        <TouchableOpacity style={styles.button} onPress={linkWallet}>
          <Text style={styles.buttonText}>Vincular carteira à Nexa</Text>
        </TouchableOpacity>
      ) : null}

      {busy ? <ActivityIndicator style={styles.loader} /> : null}
      <Text style={styles.status}>{status}</Text>

      {privyUser ? (
        <TouchableOpacity disabled={busy} style={styles.secondaryButton} onPress={resetPrivySession}>
          <Text style={styles.secondaryText}>Usar outro login Privy</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity disabled={busy} style={styles.exitButton} onPress={onExit}>
        <Text style={styles.exitText}>Sair da conta Nexa</Text>
      </TouchableOpacity>

      <Text style={styles.security}>
        A Nexa nunca solicita seed phrase, chave privada ou App Secret da Privy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  emailBox: {
    backgroundColor: '#07101e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 15,
    marginTop: 20,
  },
  emailLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  email: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 5,
  },
  input: {
    backgroundColor: '#07101e',
    borderWidth: 1,
    borderColor: '#36516f',
    borderRadius: 16,
    color: '#ffffff',
    fontSize: 18,
    letterSpacing: 4,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 13,
    marginTop: 4,
  },
  secondaryText: {
    color: '#93c5fd',
    textAlign: 'center',
    fontWeight: '800',
  },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07101e',
    borderRadius: 16,
    padding: 15,
    marginTop: 16,
  },
  waitingText: {
    color: '#cbd5e1',
    marginLeft: 12,
    flex: 1,
  },
  loader: {
    marginTop: 18,
  },
  status: {
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
  },
  exitButton: {
    paddingVertical: 13,
    marginTop: 3,
  },
  exitText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '700',
  },
  security: {
    color: '#475569',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
});
