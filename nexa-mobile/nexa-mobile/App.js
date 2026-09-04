import React, { useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleModeHome from './AppleModeHome';
import CustodyScreen from './CustodyScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';

const API =
  process.env.EXPO_PUBLIC_NEXA_API_URL ||
  'https://nexa-backend-p2u0.onrender.com/api/v1';
const DEFAULT_USDC_BRL_RATE = 5.3;

function Card(props) {
  return <View style={styles.card}>{props.children}</View>;
}

function Button(props) {
  return (
    <TouchableOpacity style={styles.button} onPress={props.onPress}>
      <Text style={styles.buttonText}>{props.title}</Text>
    </TouchableOpacity>
  );
}

function Input(props) {
  return (
    <TextInput
      style={styles.input}
      placeholder={props.placeholder}
      value={props.value}
      onChangeText={props.onChangeText}
      secureTextEntry={props.secureTextEntry || false}
      keyboardType={props.keyboardType || 'default'}
      autoCapitalize={props.autoCapitalize || 'none'}
      autoCorrect={false}
      blurOnSubmit={false}
      returnKeyType="next"
      placeholderTextColor="#64748b"
    />
  );
}

function MenuItem(props) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={props.onPress}>
      <Text style={styles.menuIcon}>{props.icon}</Text>
      <Text style={styles.menuLabel}>{props.label}</Text>
    </TouchableOpacity>
  );
}

function MenuGridItem(props) {
  return (
    <TouchableOpacity
      style={[styles.menuGridItem, props.accent ? styles.menuGridItemAccent : null]}
      onPress={props.onPress}
      activeOpacity={0.84}
    >
      <Text style={styles.menuGridIcon}>{props.icon}</Text>
      <Text style={styles.menuGridLabel}>{props.label}</Text>
      {props.hint ? <Text style={styles.menuGridHint}>{props.hint}</Text> : null}
    </TouchableOpacity>
  );
}

export default function App() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState('home');
  const [authPage, setAuthPage] = useState('login');
  const [saldo, setSaldo] = useState({ BRL: 0, USDC: 0, BTC: 0, ETH: 0, XAUT: 0 });
  const [extrato, setExtrato] = useState([]);

  const [rewardPlans, setRewardPlans] = useState([]);
  const [rewardPositions, setRewardPositions] = useState([]);
  const [rewardAmount, setRewardAmount] = useState('');
  const [selectedRewardPlan, setSelectedRewardPlan] = useState('FLEX');

  const [marketPrice, setMarketPrice] = useState(DEFAULT_USDC_BRL_RATE);
  const [buyRate, setBuyRate] = useState(DEFAULT_USDC_BRL_RATE);
  const [marketChange, setMarketChange] = useState(0);
  const [priceSource, setPriceSource] = useState('fallback');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');

  const [valorBrl, setValorBrl] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [username, setUsername] = useState('');
  const [recipientUser, setRecipientUser] = useState(null);
  const [recipientChecked, setRecipientChecked] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [valorUsdc, setValorUsdc] = useState('');
  const [wallet, setWallet] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [usdcDepositAddress, setUsdcDepositAddress] = useState('');
  const [usdcDepositQrUrl, setUsdcDepositQrUrl] = useState('');
  const [usdcDepositId, setUsdcDepositId] = useState('');
  const [usdcTxHash, setUsdcTxHash] = useState('');
  const [spendingLimit, setSpendingLimit] = useState(null);
  const [sendPermission, setSendPermission] = useState(null);
  const [newDailyLimit, setNewDailyLimit] = useState('');
  const [limitOtpCode, setLimitOtpCode] = useState('');
  const [limitOtpRequested, setLimitOtpRequested] = useState(false);

  const [depositValue, setDepositValue] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [withdrawalQuote, setWithdrawalQuote] = useState(null);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [legalDocuments, setLegalDocuments] = useState([]);

  const [kycStarted, setKycStarted] = useState(false);
  const [kycStep, setKycStep] = useState('personal');

  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [savedName, setSavedName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('email');

  const [portfolio, setPortfolio] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [investmentAsset, setInvestmentAsset] = useState('BTC');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [investmentQuote, setInvestmentQuote] = useState(null);
  const [redeemAsset, setRedeemAsset] = useState('BTC');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemQuote, setRedeemQuote] = useState(null);
  const [assetActivities, setAssetActivities] = useState([]);
  const [recurringPlan, setRecurringPlan] = useState(null);
  const [recurringAmountBrl, setRecurringAmountBrl] = useState('');
  const [recurringAsset, setRecurringAsset] = useState('USDC');
  const [recurringDay, setRecurringDay] = useState('5');
  const [recurringPixLink, setRecurringPixLink] = useState('');

  useEffect(function () {
    carregarLoginSalvo();
    carregarCotacao();
  }, []);

  useEffect(
    function () {
      if (user && user.id) {
        carregarDados();
        buscarPerfilAtualizado();
        carregarCotacao();
        carregarRewards();
        carregarSegurancaWallet();
        carregarPortfolio();
        carregarAtividadesAtivos();
        carregarCompliance();
        carregarDocumentosLegais();
        carregarAssinaturaRecorrente();
      }
    },
    [user && user.id],
  );

  function show(data) {
    setMsg(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  function parseAmount(value) {
    const text = String(value || '')
      .trim()
      .replace(/\s/g, '')
      .replace(/R\$/gi, '')
      .replace(/USDC/gi, '');
    if (!text) return 0;

    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    let normalized = text;

    if (lastComma >= 0 && lastDot >= 0) {
      const decimalSeparator = lastComma > lastDot ? ',' : '.';
      const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
      normalized = text.split(thousandsSeparator).join('');
      if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
    } else if (lastComma >= 0) {
      normalized = text.replace(/\./g, '').replace(',', '.');
    } else if (lastDot >= 0) {
      const dotCount = (text.match(/\./g) || []).length;
      normalized = dotCount === 1 ? text : text.replace(/\.(?=.*\.)/g, '');
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function formatInputAmount(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '';
    return number
      .toFixed(8)
      .replace(/0+$/, '')
      .replace(/\.$/, '')
      .replace('.', ',');
  }

  function getUsername() {
    if (!user) return '@nexa';
    if (user.handle) return user.handle;
    if (user.username) return '@' + user.username;
    return '@' + String(user.email || user.id).split('@')[0];
  }

  function getNexaId() {
    if (!user || !user.nexaId) return 'NEXA-ID em criação';
    return user.nexaId;
  }

  function getNexaPassportQrValue() {
    return JSON.stringify({
      type: 'NEXA_PASSPORT',
      nexaId: getNexaId(),
      username: getUsername(),
      name: user?.fullName || '',
      wallet: getWalletAddress(),
      network: getWalletNetwork(),
      kyc: getKycStatus(),
    });
  }

  function getKycStatus() {
    if (!user || !user.kycStatus) return 'pending';
    return String(user.kycStatus).toLowerCase();
  }

  function getKycStatusLabel() {
    const status = getKycStatus();
    if (status === 'approved') return 'Aprovado';
    if (status === 'rejected') return 'Reprovado';
    if (status === 'in_review') return 'Em análise';
    return 'Pendente';
  }

  function isKycApproved() {
    return getKycStatus() === 'approved';
  }

  function isPremiumUser() {
    const status = String(
      user?.premiumStatus ||
      user?.subscriptionStatus ||
      user?.plan ||
      user?.premium?.status ||
      '',
    ).toLowerCase();

    return Boolean(
      user?.isPremium === true ||
      user?.premiumActive === true ||
      user?.premium?.active === true ||
      status === 'premium' ||
      status === 'active' ||
      status === 'ativo',
    );
  }

  function hasExistingWallet() {
    const address = getWalletAddress();
    return /^0x[a-fA-F0-9]{40}$/.test(String(address || ''));
  }

  function canUsePremiumWallet() {
    return isPremiumUser() || hasExistingWallet();
  }

  function canUseAsset(asset) {
    return ['USDC', 'BTC', 'ETH', 'XAUT'].includes(String(asset || '').toUpperCase());
  }

  function getPremiumLabel() {
    return isPremiumUser() ? 'Premium ativo' : 'Premium não ativo';
  }

  function selectInvestmentAsset(asset) {
    const normalized = String(asset || '').toUpperCase();
    if (!canUseAsset(normalized)) {
      show('Ativo indisponível no catálogo atual da Nexa.');
      return;
    }
    setInvestmentAsset(normalized);
    setInvestmentQuote(null);
  }

  function getWalletAddress() {
    if (!user) return 'Carteira ainda não vinculada';
    if (user.wallet && user.wallet.address) return user.wallet.address;
    if (user.walletAddress) return user.walletAddress;
    return 'Carteira ainda não vinculada';
  }

  function getWalletNetwork() {
    if (user && user.wallet && user.wallet.network) return user.wallet.network;
    if (user && user.walletNetwork) return user.walletNetwork;
    return 'polygon';
  }

  function getInitial() {
    if (!user || !user.fullName) return 'N';
    return user.fullName.charAt(0).toUpperCase();
  }

  function getIcon(item) {
    const description = String(item.description || '').toLowerCase();
    if (description.includes('pix')) return '💳';
    if (description.includes('conversão')) return '🔄';
    if (description.includes('transferência')) return '📤';
    if (description.includes('carteira')) return '🌐';
    if (item.asset === 'USDC') return '💵';
    return '💰';
  }

  function getPriceSourceLabel() {
    if (priceSource === 'coingecko') return 'CoinGecko';
    if (priceSource === 'awesomeapi') return 'AwesomeAPI';
    return 'Cotação Nexa';
  }

  function normalizeUsername(value) {
    return String(value || '').replace('@', '').trim().toLowerCase();
  }

  function newClientRequestId(prefix) {
    return (
      String(prefix || 'mobile') +
      '_' +
      String(user?.id || 'user') +
      '_' +
      Date.now() +
      '_' +
      Math.random().toString(36).slice(2, 10)
    );
  }

  async function abrirLink(url) {
    try {
      await Linking.openURL(url);
    } catch (e) {
      show('Não foi possível abrir o link: ' + e.message);
    }
  }

  async function abrirMyDataMedComNexaId() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      show('Gerando acesso seguro ao MyDataMed...');
      const savedToken = token || (await AsyncStorage.getItem('nexa_token'));
      if (!savedToken) {
        show('Sessão expirada. Faça login novamente.');
        return;
      }
      const r = await fetch(API + '/nexa-id/access-token-secure', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + savedToken,
        },
      });
      const data = await r.json();
      if (data.success && data.token) {
        await abrirLink('https://mydatamed.com/login?nexaToken=' + data.token);
        return;
      }
      show(data);
    } catch (e) {
      show('Erro ao abrir MyDataMed: ' + e.message);
    }
  }

  async function abrirStaffPremium() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      show('Gerando acesso seguro ao Staff...');
      const r = await fetch(API + '/staff/access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        }),
      });
      const data = await r.json();
      if (data.success && data.url) {
        await abrirLink(data.url);
        return;
      }
      show(data);
    } catch (e) {
      show('Erro ao abrir Staff: ' + e.message);
    }
  }

  function getNowLabel() {
    return new Date().toLocaleString('pt-BR');
  }

  async function carregarRewards() {
    if (!user || !user.id) return;
    try {
      const plansResponse = await fetch(API + '/rewards/plans');
      const plansData = await plansResponse.json();
      if (plansData.success) {
        setRewardPlans(plansData.plans || []);
      }
      const positionsResponse = await fetch(
        API + '/rewards/positions?userId=' + user.id,
      );
      const positionsData = await positionsResponse.json();
      if (positionsData.success) {
        setRewardPositions(positionsData.positions || []);
      }
    } catch (e) {
      show('Erro Rewards: ' + e.message);
    }
  }

  async function ativarRewards() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amount = parseAmount(rewardAmount);
    if (!amount || amount <= 0) {
      show('Informe um valor USDC válido');
      return;
    }
    try {
      const r = await fetch(API + '/rewards/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountUsdc: amount,
          plan: selectedRewardPlan,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setRewardAmount('');
        carregarRewards();
        carregarDados();
      }
    } catch (e) {
      show('Erro ao ativar Rewards: ' + e.message);
    }
  }

  async function carregarAssinaturaRecorrente() {
    if (!user || !user.id) return;
    try {
      const r = await fetch(
        API + '/recurring-pix/me?userId=' + user.id,
        {
          headers: {
            Authorization: 'Bearer ' + token,
          },
        },
      );
      const data = await r.json();
      if (data.success) {
        setRecurringPlan(data.plan || data.recurring || data.data || data);
      }
    } catch (e) {
      show('Erro assinatura recorrente: ' + e.message);
    }
  }

  async function salvarAssinaturaRecorrente() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amount = parseAmount(recurringAmountBrl);
    if (amount < 10) {
      show('Informe valor mensal mínimo de R$ 10,00');
      return;
    }
    try {
      const payload = {
        userId: user.id,
        amountBrl: amount,
        asset: 'USDC',
        targetAsset: 'USDC',
        dayOfMonth: Number(recurringDay || 5),
        frequency: 'monthly',
        status: 'active',
      };
      const r = await fetch(API + '/recurring-pix/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      show({
        sentPayload: payload,
        response: data,
      });
      if (data.success) {
        setRecurringPlan(data.plan || data.recurring || data.data || data);
        carregarAssinaturaRecorrente();
      }
    } catch (e) {
      show('Erro ao salvar assinatura: ' + e.message);
    }
  }

  async function pausarAssinaturaRecorrente() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/recurring-pix/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        carregarAssinaturaRecorrente();
      }
    } catch (e) {
      show('Erro ao pausar assinatura: ' + e.message);
    }
  }

  async function cancelarAssinaturaRecorrente() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/recurring-pix/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setRecurringPlan(null);
        carregarAssinaturaRecorrente();
      }
    } catch (e) {
      show('Erro ao cancelar assinatura: ' + e.message);
    }
  }

  async function gerarLinkAssinaturaWoovi() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/recurring-pix/link-woovi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await r.json();
      show(data);
      const url =
        data.url ||
        data.link ||
        data.paymentLinkUrl ||
        data.checkoutUrl ||
        data.data?.url;
      if (url) {
        setRecurringPixLink(url);
        abrirLink(url);
      }
    } catch (e) {
      show('Erro link Woovi: ' + e.message);
    }
  }

  async function gerarLinkManualAssinatura() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/recurring-pix/manual-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await r.json();
      show(data);
      const url =
        data.url ||
        data.link ||
        data.paymentLinkUrl ||
        data.checkoutUrl ||
        data.data?.url;
      if (url) {
        setRecurringPixLink(url);
        abrirLink(url);
      }
    } catch (e) {
      show('Erro link manual: ' + e.message);
    }
  }

  async function resgatarRewards(positionId) {
    if (!positionId) {
      show('Posição Rewards inválida');
      return;
    }
    try {
      show('Processando Nexa Rewards...');
      const r = await fetch(API + '/rewards/complete/' + positionId, {
        method: 'POST',
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        carregarRewards();
        carregarDados();
      }
    } catch (e) {
      show('Erro ao processar Rewards: ' + e.message);
    }
  }

  async function carregarCotacao() {
    try {
      const r = await fetch(API + '/swap/price?symbol=USDC');
      const data = await r.json();
      if (data && data.priceBrl) {
        setMarketPrice(Number(data.priceBrl));
        setBuyRate(Number(data.buyRateBrl || data.priceBrl));
        setMarketChange(Number(data.change24h || 0));
        setPriceSource(data.source || 'api');
      }
    } catch (e) {
      setPriceSource('fallback');
    }
  }

  async function buscarDestinatario() {
    const cleanUsername = normalizeUsername(username);
    setRecipientChecked(false);
    setRecipientUser(null);
    if (!cleanUsername) {
      show('Digite um @username para verificar');
      return;
    }
    try {
      const r = await fetch(API + '/user/by-username/' + cleanUsername);
      const data = await r.json();
      setRecipientChecked(true);
      if (data.success && data.user) {
        setRecipientUser(data.user);
        show('Usuário encontrado: ' + data.user.handle);
      } else {
        setRecipientUser(null);
        show('Usuário não encontrado');
      }
    } catch (e) {
      setRecipientChecked(true);
      setRecipientUser(null);
      show('Erro ao verificar usuário: ' + e.message);
    }
  }

  async function vincularWalletPrivy(userData) {
    if (!userData || !userData.id) return userData;

    // A criação de novas carteiras individuais agora é explícita e usa o SDK
    // Privy na rota /onboarding-wallet. Usuários que já possuem carteira
    // continuam com o endereço preservado, inclusive se o Premium expirar.
    return userData;
  }

  async function salvarSessao(data) {
    const userData = await vincularWalletPrivy(data.user);
    const accessToken = data.accessToken || '';
    setUser(userData);
    setToken(accessToken);
    await AsyncStorage.setItem('nexa_user', JSON.stringify(userData));
    await AsyncStorage.setItem('nexa_token', accessToken);
    if (userData.email) {
      await AsyncStorage.setItem('nexa_last_email', userData.email);
      setSavedEmail(userData.email);
    }
    if (userData.fullName) {
      await AsyncStorage.setItem('nexa_last_name', userData.fullName);
      setSavedName(userData.fullName);
    }
  }

  async function atualizarUsuarioLocal(userData) {
    setUser(userData);
    await AsyncStorage.setItem('nexa_user', JSON.stringify(userData));
  }

  async function carregarLoginSalvo() {
    try {
      const savedUser = await AsyncStorage.getItem('nexa_user');
      const savedToken = await AsyncStorage.getItem('nexa_token');
      const lastEmail = await AsyncStorage.getItem('nexa_last_email');
      const lastName = await AsyncStorage.getItem('nexa_last_name');
      if (lastEmail) {
        setEmail(lastEmail);
        setSavedEmail(lastEmail);
        setResetEmail(lastEmail);
      }
      if (lastName) {
        setSavedName(lastName);
      }
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken || '');
        setMsg('Login restaurado');
      }
    } catch (e) {
      setMsg('Erro ao restaurar login: ' + e.message);
    }
  }

  async function buscarPerfilAtualizado() {
    try {
      const savedToken = token || (await AsyncStorage.getItem('nexa_token'));
      if (!savedToken) return;
      const r = await fetch(API + '/user/me', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + savedToken,
        },
      });
      const data = await r.json();
      if (data && data.id) {
        await atualizarUsuarioLocal(data);
        setNewUsername(data.username || '');
      }
    } catch (e) {}
  }

  async function login() {
    if (!email || !password) {
      show('Informe e-mail e senha');
      return;
    }
    try {
      const response = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.accessToken) {
        await salvarSessao(data);
        show('Login realizado com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro login: ' + e.message);
    }
  }

  async function cadastrar() {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const duplicatedProviderDomain = /@((?:gmail|hotmail|outlook|yahoo|icloud)\.com)\1$/i.test(
      normalizedEmail,
    );
    const duplicatedCom = /\.com\.com$/i.test(normalizedEmail);
    const basicEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
      normalizedEmail,
    );
    if (!basicEmailValid || duplicatedProviderDomain || duplicatedCom) {
      show('Confira o e-mail. Ele parece digitado incorretamente.');
      return;
    }
    if (!email || !password || !fullName || !cpf || !phone) {
      show('Preencha todos os campos do cadastro');
      return;
    }
    try {
      const response = await fetch(API + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, cpf, fullName, phone }),
      });
      const data = await response.json();
      if (data.accessToken) {
        await salvarSessao(data);
        show('Conta criada com sucesso');
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro cadastro: ' + e.message);
    }
  }

  async function salvarUsername() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (!newUsername) {
      show('Digite um username');
      return;
    }
    try {
      const r = await fetch(API + '/user/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: newUsername,
        }),
      });
      const data = await r.json();
      if (data.success && data.user) {
        const updated = {
          ...user,
          username: data.user.username,
          handle: data.user.handle,
        };
        await atualizarUsuarioLocal(updated);
        show('Username updated: ' + data.user.handle);
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro username: ' + e.message);
    }
  }

  async function iniciarKyc() {
    try {
      if (!user || !user.id) {
        show('Usuário não encontrado');
        return;
      }
      show('Creating verification session...');
      const response = await fetch(API + '/kyc/didit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao iniciar KYC');
      }
      const verificationUrl = data.raw?.url || data.verificationUrl;
      if (!verificationUrl) {
        throw new Error('URL de verificação não recebida');
      }
      show('Abrindo verificação Didit...');
      setKycStarted(true);
      setKycStep('external');
      await Linking.openURL(verificationUrl);
    } catch (error) {
      show(error?.message || 'Falha ao iniciar KYC');
    }
  }

  async function atualizarStatusKyc() {
    try {
      if (!user || !user.id) {
        show('Usuário não encontrado');
        return;
      }
      const response = await fetch(API + '/kyc/didit/status/' + user.id);
      const data = await response.json();
      if (data.success) {
        const updatedUser = {
          ...user,
          kycStatus: data.kycStatus,
          kycVerifiedAt: data.kycVerifiedAt,
        };
        await atualizarUsuarioLocal(updatedUser);
        show('KYC atualizado: ' + data.kycStatus);
        return;
      }
      show(data);
    } catch (e) {
      show('Erro ao atualizar KYC: ' + e.message);
    }
  }

  function avancarKyc() {
    if (kycStep === 'personal') {
      setKycStep('document');
      return;
    }
    if (kycStep === 'document') {
      setKycStep('selfie');
      return;
    }
    if (kycStep === 'selfie') {
      setKycStep('review');
      show('KYC enviado para análise visual');
      return;
    }
    setPage('menuScreen');
  }

  async function logout() {
    await AsyncStorage.removeItem('nexa_user');
    await AsyncStorage.removeItem('nexa_token');
    setUser(null);
    setToken('');
    setPassword('');
    setSaldo({ BRL: 0, USDC: 0, BTC: 0, ETH: 0, XAUT: 0 });
    setExtrato([]);
    setPixCopyPaste('');
    setTicketUrl('');
    setLastReceipt(null);
    setPage('home');
    show('Você saiu da Nexa');
  }

  async function carregarAtividadesAtivos() {
    if (!user || !user.id) return;
    try {
      const r = await fetch(
        API + '/ledger/statement?userId=' + user.id + '&limit=50&mode=real',
        {
          headers: {
            Authorization: 'Bearer ' + token,
          },
        }
      );
      const data = await r.json();
      if (!data.statement) return;
      const filtered = data.statement.filter(function (item) {
        const metadata = item.metadata || {};
        return (
          metadata.kind === 'investment_swap' ||
          metadata.kind === 'redeem_swap'
        );
      });
      setAssetActivities(filtered);
    } catch (e) {
      show('Erro atividades: ' + e.message);
    }
  }

  async function carregarCompliance() {
    if (!user?.id) return;
    try {
      const r = await fetch(API + '/legal/status?userId=' + user.id);
      const data = await r.json();
      setCompliance(data);
    } catch (e) {
      show('Erro compliance: ' + e.message);
    }
  }

  async function carregarDocumentosLegais() {
    try {
      const r = await fetch(API + '/legal/documents');
      const data = await r.json();
      const documents = data.documents || data.requiredDocuments || [];
      setLegalDocuments(Array.isArray(documents) ? documents : []);
    } catch (e) {
      setLegalDocuments([]);
    }
  }

  async function carregarPortfolio() {
    if (!user || !user.id) return;
    try {
      const r = await fetch(API + '/swap/portfolio', {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      });
      const data = await r.json();
      if (data.success) {
        setPortfolio(data);
      } else {
        show(data);
      }
    } catch (e) {
      show('Erro portfolio: ' + e.message);
    }
  }

  async function aceitarDocumentosLegais() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/legal/accept-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await r.json();
      show(data);
    } catch (e) {
      show('Erro aceite legal: ' + e.message);
    }
  }

  async function cotarInvestimento() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    const asset = String(investmentAsset || '').toUpperCase();
    if (!canUseAsset(asset) || asset === 'USDC') {
      show('Escolha BTC, ETH ou XAUT.');
      return;
    }

    const amount = parseAmount(investmentAmount);
    if (!amount || amount <= 0) {
      show('Informe um valor USDC válido');
      return;
    }

    try {
      const r = await fetch(API + '/swap/investment-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          toAsset: asset,
          amountUsdc: amount,
        }),
      });
      const data = await r.json();
      setInvestmentQuote(data);
      if (!r.ok || !data.success) show(data);
    } catch (e) {
      show('Erro na cotação: ' + e.message);
    }
  }

  async function PeanutButter() {
    // Mantido para compatibilidade estrutural interna
  }

  async function executarInvestimento() {
    const asset = String(investmentAsset || '').toUpperCase();
    if (!['BTC', 'ETH', 'XAUT'].includes(asset)) {
      show('Escolha BTC, ETH ou XAUT.');
      return;
    }
    if (!investmentQuote || !investmentQuote.allowed) {
      show('Faça uma cotação válida primeiro');
      return;
    }

    const amount = parseAmount(investmentAmount);
    const clientRequestId = newClientRequestId('asset_buy');

    try {
      const r = await fetch(API + '/swap/investment-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          toAsset: asset,
          amountUsdc: amount,
          clientRequestId,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setInvestmentAmount('');
        setInvestmentQuote(null);
        carregarDados();
        carregarPortfolio();
        carregarAtividadesAtivos();
      }
    } catch (e) {
      show('Erro na compra do ativo: ' + e.message);
    }
  }

  async function simularResgate() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    const asset = String(redeemAsset || '').toUpperCase();
    if (!['BTC', 'ETH', 'XAUT'].includes(asset)) {
      show('Escolha BTC, ETH ou XAUT.');
      return;
    }

    const amount = parseAmount(redeemAmount);
    if (!amount || amount <= 0) {
      show('Informe uma quantidade válida.');
      return;
    }

    try {
      const r = await fetch(API + '/swap/redeem-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          fromAsset: asset,
          amount,
        }),
      });
      const data = await r.json();
      setRedeemQuote(data);
      if (!r.ok || !data.success) show(data);
    } catch (e) {
      show('Erro na cotação de venda: ' + e.message);
    }
  }

  async function executarResgate() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }

    const asset = String(redeemAsset || '').toUpperCase();
    if (!['BTC', 'ETH', 'XAUT'].includes(asset)) {
      show('Escolha BTC, ETH ou XAUT.');
      return;
    }

    const amount = parseAmount(redeemAmount);
    if (!amount || amount <= 0) {
      show('Informe uma quantidade válida.');
      return;
    }

    const clientRequestId = newClientRequestId('asset_sell');

    try {
      const r = await fetch(API + '/swap/redeem-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          fromAsset: asset,
          amount,
          clientRequestId,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setRedeemQuote(null);
        setRedeemAmount('');
        carregarDados();
        carregarPortfolio();
        carregarAtividadesAtivos();
      }
    } catch (e) {
      show('Erro na venda do ativo: ' + e.message);
    }
  }

  async function carregarDados() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const statementResponse = await fetch(
        API + '/ledger/statement?userId=' + user.id + '&limit=50&mode=real',
      );
      const statementData = await statementResponse.json();
      if (statementData.statement) {
        setExtrato(statementData.statement);
      }
      const balanceResponse = await fetch(
        API + '/ledger/balance?userId=' + user.id + '&mode=real',
      );
      const balanceData = await balanceResponse.json();
      setSaldo({
        BRL: Number(balanceData.balances?.BRL || 0),
        USDC: Number(balanceData.balances?.USDC || 0),
        BTC: Number(balanceData.balances?.BTC || 0),
        ETH: Number(balanceData.balances?.ETH || 0),
        XAUT: Number(balanceData.balances?.XAUT || 0),
      });
      show('Saldo real updated');
    } catch (e) {
      show('Falha ao carregar dados: ' + e.message);
    }
  }

  async function depositarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de depositar Pix');
      setPage('menuScreen');
      return;
    }
    const amount = parseAmount(depositValue);
    if (!amount || amount < 10) {
      show('Depósito mínimo é R$ 10,00');
      return;
    }
    try {
      show('Gerando Pix Nexa...');
      const r = await fetch(API + '/fiat-deposit/woovi/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountBrl: amount,
        }),
      });
      const data = await r.json();
      if (!data.success) {
        show(data);
        return;
      }
      const charge = data.charge || {};
      const pix = charge.paymentMethods?.pix || {};
      const brCode = pix.brCode || charge.brCode || '';
      const qrImage = pix.qrCodeImage || charge.qrCodeImage || '';
      const paymentLink = charge.paymentLinkUrl || '';
      setPixCopyPaste(brCode);
      setTicketUrl(paymentLink || qrImage);
      show('Pix gerado com sucesso. Após o pagamento, a Nexa converte automaticamente para USDC.');
    } catch (e) {
      show('Erro depósito Pix: ' + e.message);
    }
  }

  async function converter() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amount = parseAmount(valorBrl);
    if (!amount || amount <= 0) {
      show('Informe um valor válido em R$');
      return;
    }
    try {
      const r = await fetch(API + '/swap/brl-to-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountBrl: amount }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setValorBrl('');
        carregarDados();
        carregarCotacao();
      }
    } catch (e) {
      show('Erro conversão: ' + e.message);
    }
  }

  async function cotarSaquePix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amountUsdc = parseAmount(valorUsdc);
    if (!amountUsdc || amountUsdc <= 0) {
      show('Informe a quantidade de USDC que deseja vender');
      return;
    }
    if (amountUsdc > Number(saldo.USDC || 0)) {
      show('O valor informado é maior que seu saldo USDC disponível');
      return;
    }
    try {
      setWithdrawalLoading(true);
      setWithdrawalQuote(null);
      show('Buscando a cotação real de venda...');
      const r = await fetch(API + '/withdrawal/pix-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amountUsdc }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || data.error || 'Não foi possível cotar o saque');
      }
      setWithdrawalQuote(data);
      show('Cotação pronta. Confira o valor líquido antes de confirmar.');
    } catch (e) {
      show('Erro cotação saque: ' + e.message);
    } finally {
      setWithdrawalLoading(false);
    }
  }

  async function sacarPix() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de sacar Pix');
      setPage('menuScreen');
      return;
    }
    if (!pixKey) {
      show('Informe a chave Pix');
      return;
    }
    if (!withdrawalQuote || !withdrawalQuote.success) {
      show('Faça uma cotação válida antes de confirmar o saque');
      return;
    }
    const amountUsdc = Number(withdrawalQuote.amountUsdc || withdrawalQuote.from?.amount || 0);
    const expectedNetBrl = Number(withdrawalQuote.netBrl || withdrawalQuote.to?.netBrl || withdrawalQuote.maximumWithdrawableBrl || 0);
    if (!amountUsdc || !expectedNetBrl) {
      show('Cotação inválida. Faça uma nova cotação.');
      setWithdrawalQuote(null);
      return;
    }
    try {
      setWithdrawalLoading(true);
      show('Registrando solicitação de saque Pix...');
      const r = await fetch(API + '/withdrawal/pix-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountUsdc,
          expectedNetBrl,
          pixKey,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setWithdrawalQuote(null);
        throw new Error(data.message || data.error || 'Erro ao solicitar saque Pix');
      }
      const finalNetBrl = Number(data.to?.netBrl || data.netBrl || expectedNetBrl);
      const receipt = {
        type: 'pix_withdraw',
        status: data.status || 'pending',
        transferId: data.referenceId || 'pix_' + Date.now(),
        amountUsdc,
        amountBrl: finalNetBrl,
        destinationName: 'Chave Pix',
        destinationHandle: pixKey,
        fromHandle: getUsername(),
        date: getNowLabel(),
        message: data.message || 'Saque Pix solicitado para processamento',
      };
      setLastReceipt(receipt);
      setValorUsdc('');
      setPixKey('');
      setWithdrawalQuote(null);
      carregarDados();
      setPage('receipt');
    } catch (e) {
      show('Erro saque Pix: ' + e.message);
    } finally {
      setWithdrawalLoading(false);
    }
  }

  async function enviarUsername() {
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de enviar USDC');
      setPage('menuScreen');
      return;
    }
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    if (!recipientUser) {
      show('Verifique o @username antes de enviar');
      return;
    }
    const amountToSend = parseAmount(valorUsdc);
    if (!amountToSend || amountToSend <= 0) {
      show('Informe um valor USDC válido');
      return;
    }
    try {
      const savedToken = token || (await AsyncStorage.getItem('nexa_token'));
      const r = await fetch(API + '/internal-transfer/send-by-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + savedToken,
        },
        body: JSON.stringify({
          toUsername: recipientUser.username || normalizeUsername(username),
          asset: 'USDC',
          amountUsdc: amountToSend,
          note: 'envio app',
          clientRequestId: newClientRequestId('internal_usdc'),
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        const receipt = {
          type: 'internal_transfer',
          status: 'completed',
          transferId: data.transferId || 'internal_' + Date.now(),
          amountUsdc: data.amountUsdc || amountToSend,
          destinationName: recipientUser.fullName,
          destinationHandle: data.handle || recipientUser.handle,
          destinationUsername: data.toUsername || recipientUser.username,
          fromHandle: getUsername(),
          date: getNowLabel(),
          message: data.message || 'Transferência interna concluída',
        };
        setLastReceipt(receipt);
        setUsername('');
        setRecipientUser(null);
        setRecipientChecked(false);
        setValorUsdc('');
        carregarDados();
        setPage('receipt');
      }
    } catch (e) {
      show('Erro envio: ' + e.message);
    }
  }

  async function carregarSegurancaWallet() {
    if (!user || !user.id) return;
    try {
      const limitResponse = await fetch(API + '/wallet/spending-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const limitData = await limitResponse.json();
      if (limitData.success) {
        setSpendingLimit(limitData);
      }
      const permissionResponse = await fetch(
        API + '/wallet/usdc-send-permission?userId=' + user.id,
      );
      const permissionData = await permissionResponse.json();
      if (permissionData.success) {
        setSendPermission(permissionData);
      }
    } catch (e) {
      show('Erro segurança wallet: ' + e.message);
    }
  }

  async function solicitarHabilitacaoEnvioExterno() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/wallet/request-usdc-send-enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          note: 'Solicitação feita pelo app Nexa',
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        carregarSegurancaWallet();
      }
    } catch (e) {
      show('Erro ao solicitar habilitação: ' + e.message);
    }
  }

  async function criarDepositoUsdcExterno() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      show('Gerando endereço para receber USDC...');
      const r = await fetch(API + '/usdc-deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amountExpected: 0,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setUsdcDepositId(data.depositId || '');
        setUsdcDepositAddress(data.treasuryAddress || data.qrCodeValue || '');
        setUsdcDepositQrUrl(data.qrCodeImageUrl || '');
        setUsdcTxHash('');
      }
    } catch (e) {
      show('Erro depósito USDC: ' + e.message);
    }
  }

  async function confirmarDepositoUsdcExterno() {
    if (!user || !user.id || !usdcDepositId) {
      show('Dados de depósito inválidos');
      return;
    }
    try {
      show('Confirmando depósito...');
      const r = await fetch(API + '/usdc-deposit/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          depositId: usdcDepositId,
          txHash: usdcTxHash,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setUsdcDepositId('');
        setUsdcDepositAddress('');
        setUsdcTxHash('');
        carregarDados();
      }
    } catch (e) {
      show('Erro ao confirmar depósito: ' + e.message);
    }
  }

  async function solicitarOtpEnvioWallet() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amount = parseAmount(valorUsdc);
    const cleanWallet = String(wallet || '').trim();
    if (!cleanWallet) {
      show('Informe a carteira 0x de destino');
      return;
    }
    if (!cleanWallet.startsWith('0x') || cleanWallet.length !== 42) {
      show('Carteira inválida. O endereço precisa começar com 0x e ter 42 caracteres.');
      return;
    }
    if (!amount || amount <= 0) {
      show('Informe um valor USDC válido');
      return;
    }
    try {
      show('Solicitando código OTP...');
      const payload = {
        userId: user.id,
        toAddress: cleanWallet,
        amountUsdc: amount,
      };
      const savedToken = token || (await AsyncStorage.getItem('nexa_token'));
      const r = await fetch(API + '/wallet/send-usdc/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + savedToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      show({
        status: r.status,
        sentPayload: payload,
        response: data,
      });
      if (r.ok && data.success) {
        setWallet(cleanWallet);
        setOtpRequested(true);
      }
    } catch (e) {
      show('Erro OTP app: ' + e.message);
    }
  }

  async function solicitarOtpLimiteDiario() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const newLimit = parseAmount(newDailyLimit);
    if (!newLimit || newLimit <= 0) {
      show('Informe um novo limite diário válido');
      return;
    }
    try {
      const r = await fetch(API + '/wallet/spending-limit/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          newDailyUsdcLimit: newLimit,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setLimitOtpRequested(true);
      }
    } catch (e) {
      show('Erro OTP limite: ' + e.message);
    }
  }

  async function confirmarNovoLimiteDiario() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const newLimit = parseAmount(newDailyLimit);
    if (!newLimit || newLimit <= 0) {
      show('Informe um novo limite diário válido');
      return;
    }
    if (!limitOtpCode) {
      show('Digite o código OTP recebido por e-mail');
      return;
    }
    try {
      const r = await fetch(API + '/wallet/spending-limit/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          newDailyUsdcLimit: newLimit,
          otpCode: limitOtpCode,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setNewDailyLimit('');
        setLimitOtpCode('');
        setLimitOtpRequested(false);
        carregarSegurancaWallet();
      }
    } catch (e) {
      show('Erro confirmar limite: ' + e.message);
    }
  }

  async function enviarWallet() {
    if (getKycStatus() !== 'approved') {
      show('Conclua sua verificação de identidade antes de enviar USDC');
      setPage('menuScreen');
      return;
    }
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    const amount = parseAmount(valorUsdc);
    if (!amount || amount <= 0) {
      show('Informe um valor USDC válido');
      return;
    }
    try {
      const savedToken = token || (await AsyncStorage.getItem('nexa_token'));
      const r = await fetch(API + '/wallet/send-usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + savedToken,
        },
        body: JSON.stringify({
          userId: user.id,
          toAddress: wallet,
          amountUsdc: amount,
          otpCode,
          note: 'envio externo app',
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        const receipt = {
          type: 'external_wallet',
          status: 'completed',
          transferId: data.transferId,
          amountUsdc: data.amountUsdc || amount,
          destinationName: 'Carteira externa',
          destinationHandle: data.toAddress || wallet,
          fromHandle: getUsername(),
          date: getNowLabel(),
          message: data.message || 'Envio externo concluído',
        };
        setLastReceipt(receipt);
        setWallet('');
        setValorUsdc('');
        setOtpCode('');
        setOtpRequested(false);
        carregarDados();
        setPage('receipt');
      }
    } catch (e) {
      show('Erro wallet: ' + e.message);
    }
  }

  async function solicitarRecuperacaoSenha() {
    const emailToUse = resetEmail || email || savedEmail;
    if (!emailToUse) {
      show('Informe seu e-mail');
      return;
    }
    try {
      const r = await fetch(API + '/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setResetEmail(emailToUse);
        setForgotStep('code');
      }
    } catch (e) {
      show('Erro recuperação: ' + e.message);
    }
  }

  async function redefinirSenha() {
    if (!resetEmail || !resetCode || !resetNewPassword) {
      show('Informe e-mail, código e nova senha');
      return;
    }
    try {
      const r = await fetch(API + '/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          code: resetCode,
          newPassword: resetNewPassword,
        }),
      });
      const data = await r.json();
      show(data);
      if (data.success) {
        setPassword('');
        setResetCode('');
        setResetNewPassword('');
        setAuthPage('login');
        setForgotStep('email');
      }
    } catch (e) {
      show('Erro reset senha: ' + e.message);
    }
  }

  function formatMoney(value) {
    const number = Number(value || 0);
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Bloco de coloração agnóstica de redes
  function getAssetColor(asset) {
    if (asset === 'USDC') return '#2563eb';
    if (asset === 'BTC') return '#f97316';
    if (asset === 'ETH') return '#8b5cf6';
    if (asset === 'XAUT') return '#facc15';
    return '#64748b';
  }

  function getTransactionTitle(item) {
    const description = String(item.description || '').toLowerCase();
    if (description.includes('pix') && item.direction === 'credit') return 'Depósito Pix';
    if (description.includes('pix') && item.direction === 'debit') return 'Saque Pix';
    if (description.includes('conversão') && item.asset === 'BRL') return 'Compra de USDC';
    if (description.includes('conversão') && item.asset === 'USDC') return 'USDC recebido';
    if (description.includes('transferência') && item.direction === 'debit') return 'USDC enviado';
    if (description.includes('transferência') && item.direction === 'credit') return 'USDC recebido';
    if (item.asset === 'USDC' && item.direction === 'credit') return 'Entrada USDC';
    if (item.asset === 'USDC' && item.direction === 'debit') return 'Saída USDC';
    return item.description || 'Movimentação';
  }

  function getTransactionSubtitle(item) {
    const asset = item.asset || '';
    const direction = item.direction === 'credit' ? 'Entrada' : 'Saída';
    return `${direction} · ${asset}`;
  }

  function getTransactionAmountText(item) {
    const sign = item.direction === 'credit' ? '+' : '-';
    if (item.asset === 'BRL') {
      return `${sign} R$ ${formatMoney(item.amount)}`;
    }
    return `${sign} ${Number(item.amount || 0).toFixed(8)} ${item.asset}`;
  }

  function getTransactionAmountStyle(item) {
    return item.direction === 'credit'
      ? styles.transactionAmountCredit
      : styles.transactionAmountDebit;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          <Text style={styles.logo}>NEXA</Text>
          <Text style={styles.subtitle}>Cripto sem complicação.</Text>

          <Card>
            {authPage === 'forgot' ? (
              <>
                <Text style={styles.title}>Recuperar senha</Text>
                {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}
                {forgotStep === 'email' ? (
                  <>
                    <Input
                      placeholder="E-mail"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Button title="Receber código" onPress={solicitarRecuperacaoSenha} />
                    <Button title="Voltar para login" onPress={function () { setAuthPage('login'); }} />
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="E-mail"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Input
                      placeholder="Código recebido"
                      value={resetCode}
                      onChangeText={setResetCode}
                      keyboardType="numeric"
                    />
                    <Input
                      placeholder="Nova senha"
                      secureTextEntry={true}
                      value={resetNewPassword}
                      onChangeText={setResetNewPassword}
                    />
                    <Button title="Redefinir senha" onPress={redefinirSenha} />
                    <Button title="Receber novo código" onPress={function () { setForgotStep('email'); }} />
                    <Button title="Voltar para login" onPress={function () { setAuthPage('login'); }} />
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.title}>
                  {authPage === 'login' ? 'Acesse sua Nexa' : 'Abra sua conta'}
                </Text>
                {savedEmail && authPage === 'login' ? (
                  <View style={styles.savedLoginBox}>
                    <Text style={styles.savedLoginTitle}>
                      Olá{savedName ? ', ' + savedName.split(' ')[0] : ''} 👋
                    </Text>
                    <Text style={styles.savedLoginEmail}>{savedEmail}</Text>
                  </View>
                ) : null}
                {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}
                {authPage === 'login' && savedEmail ? null : (
                  <Input
                    placeholder="E-mail"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                )}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#07101e',
                  borderWidth: 1,
                  borderColor: password ? '#36516f' : '#263650',
                  borderRadius: 16,
                  marginTop: 10,
                  paddingLeft: 14,
                }}>
                  <TextInput
                    style={{ flex: 1, color: '#ffffff', paddingVertical: 15, fontSize: 16 }}
                    placeholder="Senha"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={function () { setShowPassword(!showPassword); }}
                    style={{ paddingHorizontal: 15, paddingVertical: 14 }}
                  >
                    <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: '900' }}>
                      {showPassword ? 'OCULTAR' : 'MOSTRAR'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {password ? (
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 7 }}>
                    {showPassword ? 'Senha visível' : 'Senha preenchida com segurança'}
                  </Text>
                ) : null}
                {authPage === 'register' && (
                  <>
                    <Input
                      placeholder="Nome completo"
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                    />
                    <Input
                      placeholder="CPF"
                      keyboardType="numeric"
                      value={cpf}
                      onChangeText={setCpf}
                    />
                    <Input
                      placeholder="Telefone"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </>
                )}
                {authPage === 'login' ? (
                  <Button title="Entrar" onPress={login} />
                ) : (
                  <Button title="Criar conta" onPress={cadastrar} />
                )}
                {authPage === 'login' ? (
                  <View style={{ marginTop: 18, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={function () {
                        setResetEmail(savedEmail || email);
                        setAuthPage('forgot');
                      }}
                      style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                    >
                      <Text style={{ color: '#7c8da3', fontSize: 13, fontWeight: '700' }}>
                        Esqueci minha senha
                      </Text>
                    </TouchableOpacity>

                    {savedEmail ? (
                      <TouchableOpacity
                        onPress={async function () {
                          await AsyncStorage.removeItem('nexa_last_email');
                          await AsyncStorage.removeItem('nexa_last_name');
                          setSavedEmail('');
                          setSavedName('');
                          setEmail('');
                          setPassword('');
                          setShowPassword(false);
                          setMsg('');
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                      >
                        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>
                          Entrar com outra conta
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={function () { setAuthPage('register'); }}
                        style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 18 }}
                      >
                        <Text style={{ color: '#93c5fd', fontSize: 14, fontWeight: '900' }}>
                          Abra sua conta Nexa
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={function () { setAuthPage('login'); }}
                    style={{ marginTop: 18, alignSelf: 'center', padding: 10 }}
                  >
                    <Text style={{ color: '#7c8da3', fontSize: 13, fontWeight: '700' }}>
                      Já tenho uma conta
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  const saldoUsdc = Number(saldo.USDC || 0);
  const saldoBrlEstimado = Number((saldoUsdc * buyRate).toFixed(2));

  return (
    <View style={styles.container}>
      <ScrollView
        style={[styles.content, { paddingTop: Math.max(24, insets.top + 10) }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 150 + Math.max(insets.bottom, 12) },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Soberania digital no seu bolso</Text>

        {page === 'custody' && (
          canUsePremiumWallet() ? (
            <CustodyScreen
              user={user}
              token={token}
              onBack={function () { setPage('home'); }}
              onBalanceRefresh={carregarDados}
            />
          ) : (
            <Card>
              <Text style={styles.title}>Carteira individual Premium</Text>
              <Text style={styles.itemText}>
                O Saldo Nexa e as transferências por @username continuam disponíveis para todos.
              </Text>
              <Text style={styles.rateText}>
                O Premium adiciona uma carteira individual para receber e movimentar USDC on-chain.
              </Text>
              <Button title="Conhecer Premium" onPress={function () { setPage('premium'); }} />
              <Button title="Voltar" onPress={function () { setPage('home'); }} />
            </Card>
          )
        )}

        {/* HOME PRINCIPAL: saldo, ativos, assinatura e Premium */}
        {page === 'home' && (
          <AppleModeHome
            user={user}
            username={getUsername()}
            saldoUsdc={saldoUsdc}
            saldoBrl={saldoBrlEstimado}
            buyRate={buyRate}
            marketChange={marketChange}
            isPremium={isPremiumUser()}
            hasWallet={hasExistingWallet()}
            recurringPlan={recurringPlan}
            rewardsTotal={(rewardPositions || []).reduce(function (total, position) {
              return total + Number(position.earnedUsdc || position.rewardUsdc || position.yieldEarned || 0);
            }, 0)}
            onNavigate={setPage}
            onRefresh={function () {
              carregarDados();
              carregarCotacao();
              carregarRewards();
              carregarAssinaturaRecorrente();
            }}
          />
        )}

        {/* Home anterior preservada para auditoria visual, sem exposição ao usuário */}
        {page === 'legacyHome' && (
          <>
            <Card>
              <View style={styles.headerRow}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>
                <View style={styles.headerTextBox}>
                  <Text style={styles.welcome} numberOfLines={1}>
                    Olá, {user.fullName}
                  </Text>
                  <Text style={styles.usernameText}>{getUsername()}</Text>
                  <Text style={styles.nexaIdText}>{getNexaId()}</Text>
                  {isKycApproved() ? (
                    <Text style={styles.verifiedBadge}>✅ Verificado</Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.smallLabel}>Saldo disponível</Text>
              <Text style={styles.totalBalance}>
                {saldoUsdc.toFixed(6)} USDC
              </Text>
              <Text style={styles.rateText}>
                ≈ R$ {saldoBrlEstimado.toFixed(2)}
              </Text>

              <View style={styles.balanceGrid}>
                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>Uso diário</Text>
                  <Text style={styles.balanceMiniText}>
                    {saldoUsdc.toFixed(4)} USDC
                  </Text>
                </View>
                <View style={styles.balanceMiniCard}>
                  <Text style={styles.smallLabel}>Estimado em R$</Text>
                  <Text style={styles.balanceMiniText}>
                    R$ {saldoBrlEstimado.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.marketBox}>
                <Text style={styles.marketTitle}>USDC</Text>
                <Text style={styles.marketPrice}>
                  R$ {buyRate.toFixed(2)}
                </Text>
                <Text style={styles.rateText}>Nexa</Text>
                <Text style={marketChange >= 0 ? styles.marketUp : styles.marketDown}>
                  {changePrefix}{marketChange.toFixed(2)}%
                </Text>
              </View>

              <Button
                title="Atualizar saldo e cotação"
                onPress={function () {
                  carregarDados();
                  carregarCotacao();
                }}
              />
            </Card>

            <Card>
              <Text style={styles.title}>Notificações</Text>
              <View style={styles.item}>
                <Text style={styles.itemText}>🔔 Bem-vindo à Nexa</Text>
                <Text style={styles.rateText}>Sua conta está pronta para usar.</Text>
              </View>
              <View style={styles.item}>
                <Text style={styles.itemText}>💰 Saldo atualizado</Text>
                <Text style={styles.rateText}>
                  BRL e USDC sincronizados com sua carteira.
                </Text>
              </View>
              {!isKycApproved() ? (
                <View style={styles.item}>
                  <Text style={styles.itemText}>🪪 KYC {getKycStatusLabel()}</Text>
                  <Text style={styles.rateText}>Acompanhe sua verificação de identidade.</Text>
                </View>
              ) : null}
              {lastReceipt ? (
                <View style={styles.item}>
                  <Text style={styles.itemText}>✅ Última transferência concluída</Text>
                  <Text style={styles.rateText}>
                    {lastReceipt.amountUsdc} USDC para {lastReceipt.destinationHandle}
                  </Text>
                </View>
              ) : null}
            </Card>
          </>
        )}

        {/* ABA 5: A NOVA CENTRAL DE MENU (NADA EXPOSTO, TUDO BOTÃO) */}
        {page === 'menuScreen' && (
          <Card>
            <Text style={styles.title}>Menu</Text>
            <Text style={styles.rateText}>Conta, produtos e configurações da Nexa.</Text>

            <View style={styles.menuGrid}>
              <MenuGridItem icon="👤" label="Perfil" onPress={function () { setPage('profile'); }} />
              <MenuGridItem icon="📄" label="Movimentações" onPress={function () { setPage('extrato'); }} />
              <MenuGridItem icon="🆔" label="Nexa ID" onPress={function () { setPage('nexaId'); }} />
              <MenuGridItem icon="💳" label="Depositar Pix" onPress={function () { setPage('deposit'); }} />
              <MenuGridItem icon="🏦" label="Sacar Pix" onPress={function () { setPage('pix'); }} />
              <MenuGridItem icon="⭐" label="Premium" hint="4% + carteira" accent onPress={function () { setPage('premium'); }} />
              <MenuGridItem icon="🔁" label="USDC por assinatura" onPress={function () { setPage('recurringCrypto'); }} />
              <MenuGridItem icon="✦" label="Rewards" onPress={function () { setPage('rewards'); }} />
              <MenuGridItem icon="🌐" label="Ecossistema" onPress={function () { setPage('ecosystem'); }} />
              <MenuGridItem icon="⚖️" label="Legal e Segurança" onPress={function () { setPage('legal'); }} />
              <MenuGridItem icon="🛡️" label="Compliance" onPress={function () { setPage('compliance'); }} />
              <MenuGridItem icon="◈" label="Ativos" hint="BTC · ETH · XAUT" onPress={function () { setPage('investments'); }} />
            </View>

            <Button title="🚪 Sair do aplicativo" onPress={logout} />
          </Card>
        )}

        {/* SUB-PÁGINA: DETALHES DO PERFIL (SÓ ABRE CLICANDO NO BOTÃO DO MENU) */}
        {page === 'profile' && (
          <Card>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{getInitial()}</Text>
            </View>
            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.itemText}>Nome: {user.fullName}</Text>
            <Text style={styles.itemText}>Username atual: {getUsername()}</Text>
            <Text style={styles.itemText}>Nexa ID: {getNexaId()}</Text>
            <Text style={styles.itemText}>E-mail: {user.email}</Text>
            <Text style={styles.itemText}>CPF: {user.cpf}</Text>
            <Text style={styles.itemText}>KYC: {getKycStatusLabel()}</Text>

            <Input
              placeholder="Novo username"
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
            />
            <Button title="Salvar @username" onPress={salvarUsername} />
            
            {!isKycApproved() ? (
              <Button title="🪪 Verificação de identidade" onPress={iniciarKyc} />
            ) : (
              <View style={styles.verifiedProfileBox}>
                <Text style={styles.verifiedProfileText}>✅ Identidade verificada</Text>
              </View>
            )}
            <Button title="Atualizar perfil" onPress={buscarPerfilAtualizado} />
            <Button title="Voltar para Menu" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {/* SUB-PÁGINAS GERAIS DO APP (MANUTENÇÃO DE CÓDIGO) */}
        {page === 'premium' && (
          <Card>
            <Text style={styles.title}>Nexa Premium</Text>
            <Text style={styles.itemText}>
              Mais autonomia, melhores condições e uma carteira individual vinculada à sua conta Nexa.
            </Text>

            <View style={styles.premiumCompare}>
              <View style={styles.premiumCompareColumn}>
                <Text style={styles.premiumCompareLabel}>FREE</Text>
                <Text style={styles.premiumCompareValue}>8%</Text>
                <Text style={styles.rateText}>taxa de entrada Nexa</Text>
              </View>
              <View style={[styles.premiumCompareColumn, styles.premiumCompareColumnActive]}>
                <Text style={styles.premiumCompareLabelActive}>PREMIUM</Text>
                <Text style={styles.premiumCompareValue}>4%</Text>
                <Text style={styles.rateText}>taxa de entrada Nexa</Text>
              </View>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>🔐 Carteira individual</Text>
              <Text style={styles.rateText}>
                Carteira Privy vinculada à Nexa para receber e movimentar USDC on-chain pela rede Polygon.
              </Text>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>🌐 Enviar e receber USDC externo</Text>
              <Text style={styles.rateText}>
                Use sua carteira individual para movimentações externas com endereço e QR próprios.
              </Text>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>◈ Ativos para todos</Text>
              <Text style={styles.rateText}>
                USDC, BTC, ETH e XAUT não dependem do Premium. O Premium melhora condições e adiciona recursos de carteira.
              </Text>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>👑 Atendimento prioritário</Text>
              <Text style={styles.rateText}>
                Canal prioritário para suporte e operações elegíveis.
              </Text>
            </View>

            <View style={isPremiumUser() ? styles.verifiedProfileBox : styles.recipientBoxError}>
              <Text style={isPremiumUser() ? styles.verifiedProfileText : styles.recipientError}>
                {getPremiumLabel()}
              </Text>
            </View>

            {isPremiumUser() && !hasExistingWallet() ? (
              <Button
                title="Criar minha carteira individual"
                onPress={function () { router.push('/onboarding-wallet'); }}
              />
            ) : null}

            {hasExistingWallet() ? (
              <Button title="Abrir Minha Carteira" onPress={function () { setPage('custody'); }} />
            ) : null}

            <Button title="Ver BTC, ETH e Ouro Digital" onPress={function () { setPage('investments'); }} />
            <Button title="Configurar USDC por assinatura" onPress={function () { setPage('recurringCrypto'); }} />
            <Button
              title={isPremiumUser() ? "Falar com suporte Premium" : "Quero ser Premium"}
              onPress={function () { abrirLink('mailto:henriquecampos66@gmail.com?subject=Nexa Premium'); }}
            />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'ecosystem' && (
          <Card>
            <Text style={styles.title}>Ecossistema Nexa</Text>
            <Text style={styles.itemText}>Sua vida digital sob seu controle.</Text>
            <TouchableOpacity style={styles.item} onPress={function () { abrirLink('https://docwallet.netlify.app'); }}>
              <Text style={styles.itemText}>📄 DocWallet</Text>
              <Text style={styles.rateText}>Documentos, identidade e arquivos importantes sob seu controle.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={function () { abrirLink('https://healthwallet1.netlify.app'); }}>
              <Text style={styles.itemText}>🏥 HealthWallet</Text>
              <Text style={styles.rateText}>Carteira de saúde com exames, histórico médico e IA para análise.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={abrirMyDataMedComNexaId}>
              <Text style={styles.itemText}>👨‍⚕️ MyDataMed</Text>
              <Text style={styles.rateText}>Portal profissional para dados de saúde compartilhados pelo paciente.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.item} onPress={abrirStaffPremium}>
              <Text style={styles.itemText}>🤖 Staff Premium</Text>
              <Text style={styles.rateText}>Assistente pessoal inteligente incluído para clientes Nexa.</Text>
            </TouchableOpacity>
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'kyc' && (
          <Card>
            <Text style={styles.title}>Verificação de identidade</Text>
            <Text style={styles.itemText}>Status atual: {getKycStatusLabel()}</Text>
            <View style={styles.kycBox}>
              <Text style={kycStep === 'personal' ? styles.kycActive : styles.kycDone}>1. Dados pessoais</Text>
              <Text style={kycStep === 'document' ? styles.kycActive : styles.kycDone}>2. Documento</Text>
              <Text style={kycStep === 'selfie' ? styles.kycActive : styles.kycDone}>3. Selfie</Text>
              <Text style={kycStep === 'review' ? styles.kycActive : styles.kycPending}>4. Análise</Text>
            </View>
            <Button title={kycStep === 'review' ? 'Concluir' : 'Continuar'} onPress={avancarKyc} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'wallet' && (
          <>
            <Card>
              <Text style={styles.title}>Carteira Nexa</Text>
              <View style={styles.walletHeader}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarText}>{getInitial()}</Text>
                </View>
                <View style={styles.headerTextBox}>
                  <Text style={styles.walletName} numberOfLines={1}>{user.fullName}</Text>
                  <Text style={styles.usernameText}>{getUsername()}</Text>
                  {isKycApproved() ? <Text style={styles.verifiedBadge}>✅ Verificado</Text> : null}
                </View>
              </View>

              <Text style={styles.smallLabel}>Saldo Nexa</Text>
              <Text style={styles.totalBalance}>{saldoUsdc.toFixed(6)} USDC</Text>
              <Text style={styles.rateText}>≈ R$ {saldoBrlEstimado.toFixed(2)}</Text>

              <View style={styles.assetBalanceGrid}>
                <View style={styles.assetBalanceCard}>
                  <Text style={styles.assetBalanceSymbol}>₿ BTC</Text>
                  <Text style={styles.assetBalanceValue}>{Number(saldo.BTC || 0).toFixed(8)}</Text>
                </View>
                <View style={styles.assetBalanceCard}>
                  <Text style={styles.assetBalanceSymbol}>◆ ETH</Text>
                  <Text style={styles.assetBalanceValue}>{Number(saldo.ETH || 0).toFixed(8)}</Text>
                </View>
                <View style={styles.assetBalanceCard}>
                  <Text style={styles.assetBalanceSymbol}>🥇 XAUT</Text>
                  <Text style={styles.assetBalanceValue}>{Number(saldo.XAUT || 0).toFixed(8)}</Text>
                </View>
              </View>

              <Button title="Atualizar carteira" onPress={function () { carregarDados(); buscarPerfilAtualizado(); carregarPortfolio(); }} />
            </Card>

            <Card>
              <Text style={styles.title}>Receber USDC</Text>
              <TouchableOpacity style={styles.item} onPress={function () { setPage('receive'); }}>
                <Text style={styles.itemText}>✅ De outro usuário Nexa</Text>
                <Text style={styles.walletAddressText}>{getUsername()}</Text>
              </TouchableOpacity>

              {canUsePremiumWallet() ? (
                <TouchableOpacity style={styles.item} onPress={function () { setPage('receive'); }}>
                  <Text style={styles.itemText}>🌐 Na minha carteira individual</Text>
                  <Text style={styles.rateText}>
                    {hasExistingWallet() ? 'Receba USDC Polygon no seu endereço individual.' : 'Crie sua carteira Premium para receber USDC externo.'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.premiumTeaser} onPress={function () { setPage('premium'); }}>
                  <Text style={styles.itemText}>⭐ Carteira individual Premium</Text>
                  <Text style={styles.rateText}>
                    Envio e recebimento externo de USDC com endereço próprio.
                  </Text>
                </TouchableOpacity>
              )}

              {canUsePremiumWallet() && hasExistingWallet() ? (
                <Button title="Minha Carteira" onPress={function () { setPage('custody'); }} />
              ) : null}
            </Card>
          </>
        )}

        {page === 'receive' && (
          <Card>
            <Text style={styles.title}>Receber USDC</Text>

            <Text style={styles.smallLabel}>De usuário Nexa</Text>
            <View style={styles.receiveBox}>
              <Text style={styles.receiveHandle}>{getUsername()}</Text>
              <Text style={styles.rateText}>Compartilhe seu @username. A transferência é interna e instantânea.</Text>
            </View>

            {canUsePremiumWallet() ? (
              hasExistingWallet() ? (
                <View style={styles.pixBox}>
                  <Text style={styles.itemText}>🌐 Minha carteira individual</Text>
                  <Text style={styles.rateText}>Rede Polygon · somente USDC</Text>
                  <View style={styles.qrBox}>
                    <QRCode value={getWalletAddress()} size={180} />
                  </View>
                  <Text selectable style={styles.copyText}>{getWalletAddress()}</Text>
                  <Text style={styles.rateText}>
                    Valores recebidos aqui ficam na sua carteira individual. Para usar como Saldo Nexa, utilize “Minha Carteira”.
                  </Text>
                  <Button title="Abrir Minha Carteira" onPress={function () { setPage('custody'); }} />
                </View>
              ) : (
                <View style={styles.premiumTeaser}>
                  <Text style={styles.itemText}>Carteira Premium ainda não criada</Text>
                  <Text style={styles.rateText}>
                    Crie sua carteira individual para receber USDC externo.
                  </Text>
                  <Button title="Criar carteira individual" onPress={function () { router.push('/onboarding-wallet'); }} />
                </View>
              )
            ) : (
              <View style={styles.premiumTeaser}>
                <Text style={styles.itemText}>⭐ Recebimento externo é Premium</Text>
                <Text style={styles.rateText}>
                  O recebimento por @username continua disponível para todos. O Premium adiciona uma carteira individual para USDC on-chain.
                </Text>
                <Button title="Conhecer Premium" onPress={function () { setPage('premium'); }} />
              </View>
            )}

            <Button title="Voltar para carteira" onPress={function () { setPage('wallet'); }} />
          </Card>
        )}

        {page === 'deposit' && (
          <Card>
            <Text style={styles.title}>Depositar via Pix</Text>
            <Text style={styles.itemText}>Seu Pix será convertido automaticamente para USDC pela Cotação Nexa vigente.</Text>
            <Text style={styles.rateText}>A cotação apresentada já considera custos do provedor, liquidez, execução e margem comercial da Nexa. O valor final em USDC é confirmado após a liquidação do Pix.</Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>Cotação Nexa atual</Text>
              <Text style={styles.totalBalance}>R$ {Number(buyRate || 0).toFixed(4)} / USDC</Text>
              {parseAmount(depositValue) > 0 ? (
                <Text style={styles.rateText}>Estimativa: {(parseAmount(depositValue) / Number(buyRate || 1)).toFixed(6)} USDC antes de eventuais tarifas externas identificadas na liquidação.</Text>
              ) : null}
            </View>
            {msg ? <Text style={styles.loginMsg}>{msg}</Text> : null}
            <Input placeholder="Valor em R$" keyboardType="numeric" value={depositValue} onChangeText={setDepositValue} />
            <Button title="Gerar Pix com Cotação Nexa" onPress={depositarPix} />
            {pixCopyPaste ? (
              <View style={styles.pixBox}>
                <View style={styles.qrBox}><QRCode value={pixCopyPaste} size={180} /></View>
                <Text style={styles.copyText}>{pixCopyPaste}</Text>
              </View>
            ) : null}
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'pix' && (
          <Card>
            <Text style={styles.title}>Sacar Pix</Text>
            <Text style={styles.itemText}>Venda seu USDC pela cotação real disponível e receba o valor líquido via Pix.</Text>
            <Text style={styles.rateText}>O valor em reais pode ser menor que o valor originalmente depositado. Ele depende do livro de ofertas, liquidez, custos de execução, margem operacional e tarifa Pix.</Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>Saldo disponível</Text>
              <Text style={styles.totalBalance}>{Number(saldo.USDC || 0).toFixed(6)} USDC</Text>
            </View>
            <Input placeholder="Quantidade de USDC para vender" keyboardType="numeric" value={valorUsdc} onChangeText={function (value) { setValorUsdc(value); setWithdrawalQuote(null); }} />
            <Button title="Usar saldo total" onPress={function () { setValorUsdc(formatInputAmount(saldo.USDC)); setWithdrawalQuote(null); }} />
            <Button title={withdrawalLoading ? 'Cotando...' : 'Calcular valor líquido'} onPress={cotarSaquePix} />
            {withdrawalQuote ? (
              <View style={styles.pixBox}>
                <Text style={styles.itemText}>Resumo da cotação</Text>
                <Text style={styles.rateText}>USDC vendido: {Number(withdrawalQuote.amountUsdc || withdrawalQuote.from?.amount || 0).toFixed(6)}</Text>
                <Text style={styles.rateText}>Cotação executável: R$ {Number(withdrawalQuote.executableRate || withdrawalQuote.sellRate || 0).toFixed(6)}</Text>
                <Text style={styles.rateText}>Valor bruto: R$ {formatMoney(withdrawalQuote.grossBrl || withdrawalQuote.to?.grossBrl || 0)}</Text>
                <Text style={styles.totalBalance}>Você receberá aproximadamente R$ {formatMoney(withdrawalQuote.netBrl || withdrawalQuote.to?.netBrl || withdrawalQuote.maximumWithdrawableBrl || 0)}</Text>
                <Text style={styles.rateText}>A cotação será validada novamente na confirmação. Se o mercado mudar, será necessário cotar de novo.</Text>
              </View>
            ) : null}
            <Input placeholder="Chave Pix" value={pixKey} onChangeText={setPixKey} />
            {withdrawalQuote ? <Button title="Confirmar solicitação de Pix" onPress={sacarPix} /> : null}
            <Button title="Voltar" onPress={function () { setWithdrawalQuote(null); setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'send' && (
          <Card>
            <Text style={styles.title}>Enviar USDC</Text>

            <Text style={styles.smallLabel}>Para usuário Nexa</Text>
            <Input placeholder="@username" value={username} onChangeText={(v) => { setUsername(v); setRecipientUser(null); setRecipientChecked(false); }} />
            <Button title="Verificar usuário" onPress={buscarDestinatario} />
            {recipientUser ? <Text style={styles.recipientOk}>✅ {recipientUser.fullName}</Text> : null}
            <Input placeholder="Valor em USDC" keyboardType="numeric" value={valorUsdc} onChangeText={setValorUsdc} />
            <Button title="Enviar para @username" onPress={enviarUsername} />

            <View style={styles.sectionDivider} />

            <Text style={styles.smallLabel}>Para carteira externa</Text>
            {canUsePremiumWallet() ? (
              hasExistingWallet() ? (
                <>
                  <Text style={styles.rateText}>
                    Recurso da carteira individual. Envio externo exige validações de segurança.
                  </Text>
                  <Input placeholder="Carteira 0x..." value={wallet} onChangeText={setWallet} />
                  {!otpRequested ? (
                    <Button title="Solicitar código de segurança" onPress={solicitarOtpEnvioWallet} />
                  ) : (
                    <>
                      <Input placeholder="Código OTP" value={otpCode} onChangeText={setOtpCode} keyboardType="numeric" />
                      <Button title="Confirmar envio externo" onPress={enviarWallet} />
                    </>
                  )}
                  <Button title="Abrir Minha Carteira" onPress={function () { setPage('custody'); }} />
                </>
              ) : (
                <View style={styles.premiumTeaser}>
                  <Text style={styles.itemText}>Crie sua carteira individual</Text>
                  <Text style={styles.rateText}>Sua conta Premium está ativa, mas a carteira ainda não foi vinculada.</Text>
                  <Button title="Criar carteira" onPress={function () { router.push('/onboarding-wallet'); }} />
                </View>
              )
            ) : (
              <View style={styles.premiumTeaser}>
                <Text style={styles.itemText}>⭐ Envio externo é Premium</Text>
                <Text style={styles.rateText}>
                  Transferências por @username continuam disponíveis para todos. O Premium adiciona a carteira individual para USDC on-chain.
                </Text>
                <Button title="Conhecer Premium" onPress={function () { setPage('premium'); }} />
              </View>
            )}

            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'receipt' && (
          <Card>
            <Text style={styles.receiptTitle}>✓ Transação concluída</Text>
            <Button title="Voltar para Home" onPress={function () { setPage('home'); }} />
          </Card>
        )}

        {page === 'card' && (
          <Card>
            <Text style={styles.title}>Cartão Virtual</Text>
            <Button title="Voltar" onPress={function () { setPage('wallet'); }} />
          </Card>
        )}

        {page === 'nexaId' && (
          <Card>
            <Text style={styles.passportTopLabel}>NEXA PASSPORT</Text>
            <View style={styles.passportCard}>
              <Text style={styles.passportName}>{user.fullName}</Text>
              <Text style={styles.passportNexaId}>{getNexaId()}</Text>
              <View style={styles.passportQrBox}><QRCode value={getNexaPassportQrValue()} size={190} /></View>
            </View>
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'recurringCrypto' && (
          <Card>
            <Text style={styles.title}>USDC por assinatura</Text>
            <Text style={styles.itemText}>
              Programe uma compra mensal automática de USDC com Pix Automático.
            </Text>

            <View style={styles.item}>
              <Text style={styles.itemText}>💵 Ativo da assinatura: USDC</Text>
              <Text style={styles.rateText}>
                A recorrência permanece simples e exclusiva para USDC. BTC, ETH e XAUT ficam disponíveis na aba Ativos para todos os clientes.
              </Text>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>🔁 Como funciona</Text>
              <Text style={styles.rateText}>
                Escolha o valor mensal e o dia. A Nexa gera a autorização necessária para automatizar a compra recorrente.
              </Text>
            </View>

            <Input placeholder="Valor mensal em R$" keyboardType="numeric" value={recurringAmountBrl} onChangeText={setRecurringAmountBrl} />
            <Input placeholder="Dia do mês. Ex: 5" keyboardType="numeric" value={recurringDay} onChangeText={setRecurringDay} />
            <Button title="Salvar assinatura de USDC" onPress={salvarAssinaturaRecorrente} />
            <Button title="Ativar Pix Automático" onPress={gerarLinkAssinaturaWoovi} />

            {recurringPlan ? (
              <View style={styles.verifiedProfileBox}>
                <Text style={styles.verifiedProfileText}>
                  USDC por assinatura configurado
                </Text>
              </View>
            ) : null}

            <Button title="Pausar assinatura" onPress={pausarAssinaturaRecorrente} />
            <Button title="Cancelar assinatura" onPress={cancelarAssinaturaRecorrente} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'rewards' && (
          <Card>
            <Text style={styles.title}>Nexa Rewards</Text>
            <Text style={styles.itemText}>
              Benefícios vinculados às campanhas e regras do programa Rewards da Nexa.
            </Text>

            <View style={styles.item}>
              <Text style={styles.itemText}>✦ Como funciona</Text>
              <Text style={styles.rateText}>
                Escolha uma modalidade disponível, ative um valor elegível em USDC e acompanhe o status dentro do app.
              </Text>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>🎁 Benefícios variáveis</Text>
              <Text style={styles.rateText}>
                Cada modalidade pode ter regras, percentuais e condições próprias. O app mostra apenas os valores registrados pela API.
              </Text>
            </View>

            <View style={styles.item}>
              <Text style={styles.itemText}>⚠️ Importante</Text>
              <Text style={styles.rateText}>
                Rewards são benefícios do programa e podem variar conforme as regras vigentes. Consulte os detalhes antes de ativar.
              </Text>
            </View>

            {rewardPlans.length > 0 ? (
              <View style={styles.item}>
                <Text style={styles.itemText}>Modalidades disponíveis</Text>
                <View style={styles.rewardPlanRow}>
                  {rewardPlans.map(function (plan, index) {
                    const code = String(plan.code || plan.plan || plan.id || 'FLEX');
                    const active = selectedRewardPlan === code;
                    return (
                      <TouchableOpacity
                        key={code + '_' + index}
                        style={[styles.rewardPlanChip, active ? styles.rewardPlanChipActive : null]}
                        onPress={function () { setSelectedRewardPlan(code); }}
                      >
                        <Text style={active ? styles.rewardPlanChipTextActive : styles.rewardPlanChipText}>
                          {plan.name || plan.label || code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Input placeholder="Valor em USDC" keyboardType="numeric" value={rewardAmount} onChangeText={setRewardAmount} />
            <Button title="Ativar Rewards" onPress={ativarRewards} />

            {rewardPositions.length > 0 ? (
              <View style={styles.item}>
                <Text style={styles.itemText}>Meus Rewards</Text>
                {rewardPositions.map(function (position) {
                  const benefit = Number(position.earnedUsdc || position.rewardUsdc || 0);
                  return (
                    <View key={position.id || position.positionId || String(position.createdAt)} style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>USDC ativado</Text>
                      <Text style={styles.receiptValue}>
                        {Number(position.amountUsdc || position.principalUsdc || 0).toFixed(6)} USDC
                      </Text>
                      {benefit > 0 ? (
                        <Text style={styles.rateText}>Rewards registrados: {benefit.toFixed(6)} USDC</Text>
                      ) : null}
                      <Text style={styles.rateText}>Status: {position.status || 'ativo'}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Button title="Atualizar Rewards" onPress={carregarRewards} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'legal' && (
          <Card>
            <Text style={styles.title}>Legal, Cotações e Riscos</Text>
            <Text style={styles.itemText}>Antes de operar, leia e aceite os documentos vigentes.</Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>Entrada por Pix</Text>
              <Text style={styles.rateText}>O valor líquido, após custos do provedor Pix, é convertido pela Cotação Nexa. A cotação incorpora custos de liquidez, execução, risco e margem comercial, e pode diferir de referências públicas.</Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>Saída por Pix</Text>
              <Text style={styles.rateText}>O limite de saque corresponde ao valor líquido realizável na venda do USDC no momento da solicitação, descontadas tarifas, margem operacional e custos de execução. Não há garantia de recompra pelo valor depositado.</Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>Risco de mercado e liquidez</Text>
              <Text style={styles.rateText}>Os preços de compra e venda podem apresentar diferenças relevantes. A quantidade de reais recebida depende das ofertas efetivamente disponíveis.</Text>
            </View>
            {legalDocuments.map(function (document, index) {
              return (
                <View key={document.documentType || document.type || index} style={styles.item}>
                  <Text style={styles.itemText}>{document.title || document.documentType || document.type || 'Documento legal'}</Text>
                  <Text style={styles.rateText}>Versão {document.version || document.documentVersion || 'vigente'}</Text>
                  {document.content ? <Text style={styles.rateText}>{document.content}</Text> : null}
                </View>
              );
            })}
            <Button title="Atualizar documentos" onPress={carregarDocumentosLegais} />
            <Button title="Li e aceito os documentos vigentes" onPress={aceitarDocumentosLegais} />
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'compliance' && (
          <Card>
            <Text style={styles.title}>Compliance</Text>
            <Button title="Voltar" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}

        {page === 'investments' && (
          <Card>
            <Text style={styles.title}>Ativos</Text>
            <Text style={styles.itemText}>
              USDC, Bitcoin, Ethereum e Ouro Digital em uma experiência simples.
            </Text>
            {portfolio ? (
              <Text style={styles.rateText}>
                Valor de referência dos ativos: ≈ US$ {Number(portfolio.totalUsd || 0).toFixed(2)}
              </Text>
            ) : null}

            <View style={styles.assetCatalogGrid}>
              <TouchableOpacity style={styles.assetCatalogCard} onPress={function () { selectInvestmentAsset('BTC'); setRedeemAsset('BTC'); }}>
                <Text style={styles.assetCatalogIcon}>₿</Text>
                <Text style={styles.assetCatalogSymbol}>BTC</Text>
                <Text style={styles.assetCatalogName}>Bitcoin</Text>
                <Text style={styles.assetCatalogBalance}>{Number(saldo.BTC || 0).toFixed(8)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assetCatalogCard} onPress={function () { selectInvestmentAsset('ETH'); setRedeemAsset('ETH'); }}>
                <Text style={styles.assetCatalogIcon}>◆</Text>
                <Text style={styles.assetCatalogSymbol}>ETH</Text>
                <Text style={styles.assetCatalogName}>Ethereum</Text>
                <Text style={styles.assetCatalogBalance}>{Number(saldo.ETH || 0).toFixed(8)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assetCatalogCard} onPress={function () { selectInvestmentAsset('XAUT'); setRedeemAsset('XAUT'); }}>
                <Text style={styles.assetCatalogIcon}>🥇</Text>
                <Text style={styles.assetCatalogSymbol}>XAUT</Text>
                <Text style={styles.assetCatalogName}>Ouro Digital</Text>
                <Text style={styles.assetCatalogBalance}>{Number(saldo.XAUT || 0).toFixed(8)}</Text>
              </TouchableOpacity>
              <View style={[styles.assetCatalogCard, styles.assetCatalogCardUsdc]}>
                <Text style={styles.assetCatalogIcon}>💵</Text>
                <Text style={styles.assetCatalogSymbol}>USDC</Text>
                <Text style={styles.assetCatalogName}>Saldo base</Text>
                <Text style={styles.assetCatalogBalance}>{Number(saldo.USDC || 0).toFixed(6)}</Text>
              </View>
            </View>

            <View style={styles.assetOperationBox}>
              <Text style={styles.itemText}>Comprar {investmentAsset}</Text>
              <Text style={styles.rateText}>
                A cotação é consultada antes da confirmação. BTC, ETH e XAUT têm execução imediata de backing no provedor.
              </Text>
              <Input
                placeholder={'Valor em USDC para comprar ' + investmentAsset}
                keyboardType="numeric"
                value={investmentAmount}
                onChangeText={function (value) { setInvestmentAmount(value); setInvestmentQuote(null); }}
              />
              <Button title={'Cotar ' + investmentAsset} onPress={cotarInvestimento} />
              {investmentQuote?.allowed ? (
                <View style={styles.quoteBox}>
                  <Text style={styles.itemText}>Cotação pronta</Text>
                  <Text style={styles.rateText}>
                    Estimativa: {Number(investmentQuote.estimatedToAmount || investmentQuote.netToAmount || 0).toFixed(8)} {investmentAsset}
                  </Text>
                  <Text style={styles.rateText}>
                    A confirmação usa a execução real e reconcilia os custos do provedor.
                  </Text>
                  <Button title={'Confirmar compra de ' + investmentAsset} onPress={executarInvestimento} />
                </View>
              ) : null}
            </View>

            <View style={styles.assetOperationBox}>
              <Text style={styles.itemText}>Vender {redeemAsset}</Text>
              <Text style={styles.rateText}>O valor líquido é convertido para USDC após a execução confirmada.</Text>
              <View style={styles.inlineAssetSelector}>
                {['BTC', 'ETH', 'XAUT'].map(function (asset) {
                  return (
                    <TouchableOpacity
                      key={asset}
                      style={[styles.assetSelectorChip, redeemAsset === asset ? styles.assetSelectorChipActive : null]}
                      onPress={function () { setRedeemAsset(asset); setRedeemQuote(null); }}
                    >
                      <Text style={redeemAsset === asset ? styles.assetSelectorTextActive : styles.assetSelectorText}>{asset}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Input
                placeholder={'Quantidade de ' + redeemAsset}
                keyboardType="numeric"
                value={redeemAmount}
                onChangeText={function (value) { setRedeemAmount(value); setRedeemQuote(null); }}
              />
              <Button title={'Cotar venda de ' + redeemAsset} onPress={simularResgate} />
              {redeemQuote?.allowed ? (
                <View style={styles.quoteBox}>
                  <Text style={styles.itemText}>Cotação pronta</Text>
                  <Text style={styles.rateText}>
                    Estimativa líquida: {Number(redeemQuote.estimatedUsdc || redeemQuote.netUsdc || 0).toFixed(8)} USDC
                  </Text>
                  <Button title={'Confirmar venda de ' + redeemAsset} onPress={executarResgate} />
                </View>
              ) : null}
            </View>

            <Text style={styles.rateText}>
              Ativos disponíveis para todos os clientes. Premium melhora condições e adiciona a carteira individual.
            </Text>

            <Button title="Voltar" onPress={function () { setPage('home'); }} />
          </Card>
        )}

        {/* SUB-PÁGINA EXTRATO: SÓ ABRE VIA CLIQUE NO BOTÃO DO MENU */}
        {page === 'extrato' && (
          <Card>
            <Text style={styles.title}>Movimentações</Text>
            <Button title="Atualizar histórico" onPress={carregarDados} />
            {extrato.length === 0 && <Text style={styles.itemText}>Nenhuma transação encontrada.</Text>}
            {extrato.map(function (item) {
              return (
                <View key={item.id} style={styles.transactionCard}>
                  <View style={styles.transactionMiddle}>
                    <Text style={styles.transactionTitle}>{getTransactionTitle(item)}</Text>
                    <Text style={styles.transactionSubtitle}>{getTransactionSubtitle(item)}</Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={getTransactionAmountStyle(item)}>{getTransactionAmountText(item)}</Text>
                  </View>
                </View>
              );
            })}
            <Button title="Voltar para Menu" onPress={function () { setPage('menuScreen'); }} />
          </Card>
        )}
      </ScrollView>

      {/* A BARRA DE NAVEGAÇÃO DE 5 ABAS COM AS 3 BARRINHAS NO MENU */}
      <View
        style={[
          styles.menu,
          {
            minHeight: 68 + Math.max(insets.bottom, 10),
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <MenuItem icon="🏠" label="Home" onPress={function () { setPage('home'); }} />
        <MenuItem icon="👛" label="Carteira" onPress={function () { setPage('wallet'); }} />
        <MenuItem icon="🧩" label="Ativos" onPress={function () { setPage('investments'); }} />
        <MenuItem icon="📤" label="Enviar" onPress={function () { setPage('send'); }} />
        <MenuItem icon="☰" label="Menu" onPress={function () { setPage('menuScreen'); }} /> 
      </View>
    </View>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#020617' },
  content: { flex: 1, paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 150 },
  logo: { color: 'white', fontSize: 36, fontWeight: '900', textAlign: 'center', letterSpacing: 2 },
  subtitle: { color: '#93c5fd', textAlign: 'center', marginBottom: 24, fontSize: 13 },
  card: { backgroundColor: '#0f172a', padding: 22, borderRadius: 24, marginBottom: 18, borderWidth: 1, borderColor: '#1e40af' },
  title: { color: 'white', fontSize: 21, fontWeight: '800', marginBottom: 16, marginTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTextBox: { flex: 1, minWidth: 0 },
  walletHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  walletName: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4, flexShrink: 1 },
  walletAddressBox: { backgroundColor: '#020617', borderRadius: 14, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  walletAddressText: { color: '#93c5fd', fontSize: 12, lineHeight: 18, fontWeight: '800' },
  welcome: { color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 4, flexShrink: 1 },
  usernameText: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  verifiedBadge: { color: '#22c55e', fontSize: 12, fontWeight: '900', marginTop: 4 },
  savedLoginBox: { backgroundColor: '#111827', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#1e40af' },
  savedLoginTitle: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  savedLoginEmail: { color: '#93c5fd', fontSize: 13, fontWeight: '700' },
  avatarSmall: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: 'white', fontSize: 24, fontWeight: '900' },
  avatarLarge: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  avatarLargeText: { color: 'white', fontSize: 38, fontWeight: '900' },
  smallLabel: { color: '#94a3b8', fontSize: 13, marginTop: 10, marginBottom: 4 },
  totalBalance: { color: '#ffffff', fontSize: 38, fontWeight: '900', marginBottom: 12 },
  balanceGrid: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 10 },
  balanceMiniCard: { flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 14 },
  balanceMiniText: { color: 'white', fontWeight: '900', fontSize: 18 },
  rateText: { color: '#93c5fd', fontSize: 12, marginBottom: 14 },
  loginMsg: { color: '#93c5fd', marginBottom: 15, textAlign: 'center', fontSize: 13 },
  marketBox: { backgroundColor: '#111827', borderRadius: 18, padding: 14, marginTop: 8, marginBottom: 14 },
  marketTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  marketPrice: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 4 },
  marketUp: { color: '#22c55e', fontSize: 12, fontWeight: '800', marginTop: 3 },
  marketDown: { color: '#f87171', fontSize: 12, fontWeight: '800', marginTop: 3 },
  kycBox: { backgroundColor: '#111827', borderRadius: 16, padding: 14, marginBottom: 14 },
  kycActive: { color: '#93c5fd', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  kycDone: { color: '#22c55e', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  kycPending: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  recipientBox: { backgroundColor: '#052e16', borderColor: '#22c55e', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  recipientBoxError: { backgroundColor: '#450a0a', borderColor: '#ef4444', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  recipientOk: { color: '#22c55e', fontSize: 12, fontWeight: '900', marginBottom: 5 },
  recipientError: { color: '#f87171', fontSize: 12, fontWeight: '900' },
  receiptIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  receiptIconText: { color: 'white', fontSize: 42, fontWeight: '900' },
  receiptTitle: { color: 'white', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  receiptRow: { backgroundColor: '#111827', borderRadius: 14, padding: 13, marginBottom: 10 },
  receiptLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  receiptValue: { color: 'white', fontSize: 15, fontWeight: '900' },
  receiptBox: { backgroundColor: '#020617', borderRadius: 14, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  receiptSmallLabel: { color: '#94a3b8', fontSize: 11, marginBottom: 5 },
  receiptId: { color: '#93c5fd', fontSize: 12, fontWeight: '800' },
  verifiedProfileBox: { backgroundColor: '#052e16', borderColor: '#22c55e', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 12 },
  verifiedProfileText: { color: '#22c55e', textAlign: 'center', fontWeight: '900', fontSize: 14 },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 14, marginBottom: 12, fontSize: 15 },
  button: { backgroundColor: '#2563eb', padding: 13, borderRadius: 14, marginBottom: 11 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: '800', fontSize: 15 },
  menu: { backgroundColor: '#020617', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 10 },
  menuItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  menuIcon: { color: '#e2e8f0', fontSize: 18 },
  menuLabel: { color: '#94a3b8', fontSize: 9, marginTop: 2, fontWeight: '700' },
  item: { backgroundColor: '#111827', borderRadius: 14, padding: 12, marginBottom: 10 },
  itemText: { color: '#f8fafc', marginBottom: 6, fontSize: 13 },
  creditText: { color: '#22c55e', fontWeight: '900', fontSize: 14 },
  debitText: { color: '#f87171', fontWeight: '900', fontSize: 14 },
  pixBox: { backgroundColor: '#020617', padding: 14, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#1e293b' },
  copyText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  qrBox: { backgroundColor: 'white', padding: 16, borderRadius: 18, alignSelf: 'center', marginBottom: 16 },
  transactionCard: { backgroundColor: '#111827', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center' },
  transactionMiddle: { flex: 1, paddingRight: 8 },
  transactionTitle: { color: 'white', fontWeight: '900', fontSize: 14, marginBottom: 3 },
  transactionSubtitle: { color: '#93c5fd', fontWeight: '700', fontSize: 11, marginBottom: 3 },
  transactionRight: { alignItems: 'flex-end', maxWidth: 110 },
  transactionAmountCredit: { color: '#22c55e', fontWeight: '900', fontSize: 13, textAlign: 'right' },
  transactionAmountDebit: { color: '#f87171', fontWeight: '900', fontSize: 13, textAlign: 'right' },
  receiveBox: { backgroundColor: '#020617', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#1e40af', alignItems: 'center' },
  receiveLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  receiveHandle: { color: '#60a5fa', fontSize: 28, fontWeight: '900' },
  nexaIdText: { color: '#c4b5fd', fontSize: 12, fontWeight: '900', marginTop: 3 },
  passportTopLabel: { color: '#c4b5fd', fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 12 },
  passportCard: { backgroundColor: '#111827', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: '#4f46e5', marginBottom: 16 },
  allocationBox: { backgroundColor: '#020617', borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' },
  allocationItem: { marginBottom: 12 },
  allocationTrack: { height: 10, borderRadius: 999, backgroundColor: '#111827', overflow: 'hidden' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  menuGridItem: { width: '48.5%', minHeight: 112, backgroundColor: '#111827', borderRadius: 18, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: '#1e293b', justifyContent: 'center' },
  menuGridItemAccent: { backgroundColor: '#171225', borderColor: '#5b3f88' },
  menuGridIcon: { fontSize: 24, marginBottom: 9 },
  menuGridLabel: { color: '#f8fafc', fontSize: 14, fontWeight: '900' },
  menuGridHint: { color: '#93c5fd', fontSize: 10, marginTop: 5, fontWeight: '700' },
  premiumCompare: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  premiumCompareColumn: { flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#1e293b' },
  premiumCompareColumnActive: { backgroundColor: '#171225', borderColor: '#7c3aed' },
  premiumCompareLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  premiumCompareLabelActive: { color: '#c4b5fd', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  premiumCompareValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 7 },
  premiumTeaser: { backgroundColor: '#171225', borderColor: '#5b3f88', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  assetBalanceGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  assetBalanceCard: { flex: 1, backgroundColor: '#111827', borderRadius: 15, padding: 11, borderWidth: 1, borderColor: '#1e293b' },
  assetBalanceSymbol: { color: '#93c5fd', fontSize: 11, fontWeight: '900' },
  assetBalanceValue: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 5 },
  sectionDivider: { height: 1, backgroundColor: '#1e293b', marginVertical: 18 },
  rewardPlanRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  rewardPlanChip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#334155' },
  rewardPlanChipActive: { backgroundColor: '#12213e', borderColor: '#60a5fa' },
  rewardPlanChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '800' },
  rewardPlanChipTextActive: { color: '#e0f2fe', fontSize: 11, fontWeight: '900' },
  assetCatalogGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8, marginBottom: 14 },
  assetCatalogCard: { width: '48.5%', backgroundColor: '#111827', borderRadius: 19, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  assetCatalogCardUsdc: { borderColor: '#2563eb' },
  assetCatalogIcon: { fontSize: 23, color: '#fff' },
  assetCatalogSymbol: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 8 },
  assetCatalogName: { color: '#64748b', fontSize: 11, marginTop: 3 },
  assetCatalogBalance: { color: '#93c5fd', fontSize: 11, fontWeight: '800', marginTop: 8 },
  assetOperationBox: { backgroundColor: '#0b1220', borderRadius: 20, padding: 15, marginBottom: 14, borderWidth: 1, borderColor: '#1e293b' },
  quoteBox: { backgroundColor: '#07101e', borderRadius: 16, padding: 13, marginTop: 10, borderWidth: 1, borderColor: '#263650' },
  inlineAssetSelector: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  assetSelectorChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#111827', borderWidth: 1, borderColor: '#334155' },
  assetSelectorChipActive: { backgroundColor: '#12213e', borderColor: '#60a5fa' },
  assetSelectorText: { color: '#94a3b8', fontSize: 11, fontWeight: '800' },
  assetSelectorTextActive: { color: '#fff', fontSize: 11, fontWeight: '900' },
};
