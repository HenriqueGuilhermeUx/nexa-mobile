import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import axios from 'axios';
import { Copy, CreditCard, LogOut, RefreshCcw, ShieldCheck, Wallet } from 'lucide-react-native';

const API_URL = 'https://nexa-backend-p2u0.onrender.com/api/v1';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

async function getToken() {
  return SecureStore.getItemAsync('nexa_access_token');
}

async function getStoredUser() {
  const raw = await SecureStore.getItemAsync('nexa_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const token = await getToken();

  const response = await axios({
    url: `${API_URL}${path}`,
    method: options.method || 'GET',
    data: options.body ? JSON.parse(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}

function Logo() {
  return (
    <View style={styles.logo}>
      <Text style={styles.logoText}>N</Text>
    </View>
  );
}

function LoginScreen({ onLogged }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function login() {
    try {
      setLoading(true);
      setMessage('Entrando...');

      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      await SecureStore.setItemAsync('nexa_access_token', response.data.accessToken);
      await SecureStore.setItemAsync('nexa_user', JSON.stringify(response.data.user));

      setMessage('');
      onLogged();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <View style={styles.loginWrap}>
        <Logo />
        <Text style={styles.title}>Nexa</Text>
        <Text style={styles.subtitle}>Conta digital cripto invisível</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar</Text>

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={login} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </TouchableOpacity>

          {!!message && <Text style={styles.message}>{String(message)}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

function MetricCard({ label, value }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      setLoading(true);
      const stored = await getStoredUser();
      setUser(stored);

      const me = await api('/user/me');
      setProfile(me);

      const realUserId = me?.id || stored?.id;

      const balanceData = await api(`/wallet/balance?userId=${realUserId}`);
      setBalance(balanceData);

      const ledgerData = await api(`/ledger/user?userId=${realUserId}`);
      setLedger(Array.isArray(ledgerData) ? ledgerData : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function unlockBiometric() {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      Alert.alert('Biometria', 'Este aparelho não possui biometria disponível.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirmar acesso Nexa',
    });

    Alert.alert('Biometria', result.success ? 'Acesso confirmado.' : 'Não confirmado.');
  }

  async function deposit() {
    try {
      const amount = Number(depositAmount);
      if (!amount || amount < 10) {
        setMessage('Depósito mínimo: R$ 10');
        return;
      }

      setLoading(true);
      setMessage('Gerando depósito Pix...');

      const result = await api('/deposit/pix', {
        method: 'POST',
        body: JSON.stringify({
          userId: profile?.id || user?.id,
          email: profile?.email || user?.email,
          amount,
          amountBrl: amount,
        }),
      });

      setMessage(`Depositado ${Number(result.amountUsdc || 0).toFixed(2)} USDC`);
      setDepositAmount('');
      await refresh();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Erro no depósito');
    } finally {
      setLoading(false);
    }
  }

  async function payPix() {
    try {
      const amount = Number(paymentAmount);
      if (!amount || amount <= 0) {
        setMessage('Informe valor válido');
        return;
      }
      if (!pixKey || pixKey.trim().length < 3) {
        setMessage('Informe a chave Pix');
        return;
      }

      setLoading(true);
      setMessage('Processando Pix...');

      const result = await api('/payment/pix', {
        method: 'POST',
        body: JSON.stringify({
          userId: profile?.id || user?.id,
          email: profile?.email || user?.email,
          amount,
          amountBrl: amount,
          pixKey: pixKey.trim(),
        }),
      });

      setMessage(`Pix processado: ${brl(result.amountBRL)} / ${Number(result.debitedUSDC || 0).toFixed(4)} USDC`);
      setPaymentAmount('');
      setPixKey('');
      await refresh();
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Erro no Pix');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync('nexa_access_token');
    await SecureStore.deleteItemAsync('nexa_user');
    onLogout();
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Logo />
            <View>
              <Text style={styles.brandTitle}>Nexa</Text>
              <Text style={styles.muted}>Cripto sem complicação</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.iconButton} onPress={logout}>
            <LogOut size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.hello}>Olá, {profile?.fullName || user?.fullName || user?.email}</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.metricLabel}>Saldo USDC</Text>
          <Text style={styles.bigBalance}>${Number(balance?.balances?.USDC || 0).toFixed(2)}</Text>
          <Text style={styles.muted}>{brl(balance?.balances?.BRL || 0)}</Text>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard label="Wallet" value={profile?.wallet?.address ? 'Ativa' : 'Pendente'} />
          <MetricCard label="KYC" value={profile?.kycStatus || 'pending'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conta digital</Text>
          <Text style={styles.muted}>Wallet automática nos bastidores.</Text>
          <Text style={styles.walletBox}>{profile?.wallet?.address || 'Endereço ainda não criado'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Depositar Pix</Text>
          <TextInput
            style={styles.input}
            placeholder="Valor em R$"
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
            value={depositAmount}
            onChangeText={setDepositAmount}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={deposit} disabled={loading}>
            <Text style={styles.buttonText}>Depositar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagar Pix com USDC</Text>
          <TextInput
            style={styles.input}
            placeholder="Valor em R$"
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
          />
          <TextInput
            style={styles.input}
            placeholder="Chave Pix"
            placeholderTextColor="#64748b"
            value={pixKey}
            onChangeText={setPixKey}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={payPix} disabled={loading}>
            <Text style={styles.buttonText}>Pagar Pix</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={refresh}>
            <RefreshCcw size={18} color="#fff" />
            <Text style={styles.buttonText}>Atualizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={unlockBiometric}>
            <ShieldCheck size={18} color="#fff" />
            <Text style={styles.buttonText}>Biometria</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Extrato Ledger</Text>
          {ledger.length === 0 && <Text style={styles.muted}>Nenhum lançamento ainda.</Text>}
          {ledger.slice(0, 12).map((entry) => (
            <View key={entry.id} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerTitle}>{entry.type}</Text>
                <Text style={styles.muted}>{entry.description}</Text>
              </View>
              <Text style={entry.direction === 'credit' ? styles.green : styles.red}>
                {entry.direction === 'credit' ? '+' : '-'} {Number(entry.amount || 0).toFixed(entry.asset === 'BRL' ? 2 : 4)} {entry.asset}
              </Text>
            </View>
          ))}
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [logged, setLogged] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getToken().then((token) => {
      setLogged(!!token);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={styles.pageCenter}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    );
  }

  return logged ? <Dashboard onLogout={() => setLogged(false)} /> : <LoginScreen onLogged={() => setLogged(true)} />;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#020617',
  },
  pageCenter: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 50,
  },
  loginWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 24,
  },
  brandTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 24,
  },
  title: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 48,
    marginTop: 18,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 18,
    marginBottom: 28,
  },
  hello: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  balanceCard: {
    backgroundColor: '#111827',
    borderRadius: 30,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.1)',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  bigBalance: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  input: {
    backgroundColor: '#020617',
    color: '#fff',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.1)',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
  },
  muted: {
    color: '#94a3b8',
  },
  walletBox: {
    color: '#cbd5e1',
    backgroundColor: '#020617',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    fontSize: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.08)',
    paddingTop: 14,
    marginTop: 14,
  },
  ledgerTitle: {
    color: '#fff',
    fontWeight: '900',
  },
  green: {
    color: '#34d399',
    fontWeight: '900',
  },
  red: {
    color: '#f87171',
    fontWeight: '900',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#cbd5e1',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
  },
});
