import React, { useEffect, useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleModeHome from './AppleModeHome';
import CustodyScreen from './CustodyScreen';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';

const API = 'https://nexa-backend-p2u0.onrender.com/api/v1';
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

export default function App() {
  const [page, setPage] = useState('home');
  const [authPage, setAuthPage] = useState('login');
  const [saldo, setSaldo] = useState({ BRL: 0, USDC: 0 });
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
  const [investmentAsset, setInvestmentAsset] = useState('PAXG');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [investmentQuote, setInvestmentQuote] = useState(null);
  const [redeemAsset, setRedeemAsset] = useState('PAXG');
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

  function isPremiumAsset(asset) {
    return asset === 'PAXG' || asset === 'WBTC';
  }

  function canUseAsset(asset) {
    if (asset === 'USDC') return true;
    return isPremiumUser();
  }

  function getPremiumLabel() {
    return isPremiumUser() ? 'Premium ativo' : 'Premium não ativo';
  }

  function selectInvestmentAsset(asset) {
    setInvestmentAsset(asset);
    setInvestmentQuote(null);
    if (isPremiumAsset(asset) && !isPremiumUser()) {
      show(asset + ' está disponível apenas para clientes Nexa Premium.');
    }
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
      show('Resgatando Nexa Rewards via Aave...');
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
      show('Erro ao resgatar Rewards: ' + e.message);
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
    try {
      if (!userData || !userData.id) return userData;
      const existingAddress = userData.walletAddress || userData.wallet?.address;
      if (existingAddress) return userData;
      const walletResponse = await fetch(API + '/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id }),
      });
      const walletData = await walletResponse.json();
      if (walletData.success && walletData.walletAddress) {
        return {
          ...userData,
          walletAddress: walletData.walletAddress,
          walletNetwork: walletData.network || 'polygon',
          walletProvider: walletData.provider || 'privy',
        };
      }
      return userData;
    } catch (e) {
      return userData;
    }
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
    setSaldo({ BRL: 0, USDC: 0 });
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
      const r = await fetch(API + '/swap/portfolio?userId=' + user.id, {
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
    if (!canUseAsset(investmentAsset)) {
      show(investmentAsset + ' é um ativo exclusivo para clientes Nexa Premium.');
      setPage('premium');
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
          userId: user.id,
          toAsset: investmentAsset,
          amountUsdc: amount,
        }),
      });
      const data = await r.json();
      setInvestmentQuote(data);
      show(data);
    } catch (e) {
      show('Erro cotação: ' + e.message);
    }
  }

  async function PeanutButter() {
    // Mantido para compatibilidade estrutural interna
  }

  async function executarInvestimento() {
    if (!canUseAsset(investmentAsset)) {
      show(investmentAsset + ' é um ativo exclusivo para clientes Nexa Premium.');
      setPage('premium');
      return;
    }
    if (!investmentQuote || !investmentQuote.allowed) {
      show('Faça uma cotação válida primeiro');
      return;
    }
    const amount = parseAmount(investmentAmount);
    try {
      const r = await fetch(API + '/swap/investment-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          userId: user.id,
          toAsset: investmentAsset,
          amountUsdc: amount,
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
      show('Erro investimento: ' + e.message);
    }
  }

  async function simularResgate() {
    if (!user || !user.id) {
      show('Faça login primeiro');
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
          userId: user.id,
          fromAsset: redeemAsset,
          amount: Number(redeemAmount),
        }),
      });
      const data = await r.json();
      setRedeemQuote(data);
      show(e.message);
    } catch (e) {
      show(e.message);
    }
  }

  async function executarResgate() {
    if (!user || !user.id) {
      show('Faça login primeiro');
      return;
    }
    try {
      const r = await fetch(API + '/swap/redeem-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          userId: user.id,
          fromAsset: redeemAsset,
          amount: Number(redeemAmount),
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
      show(e.message);
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
      const r = await fetch(API + '/payment/pix/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ amountUsdc }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || data.error || 'Não foi possível cotar o saque');
      }
      setWithdrawalQuote({
        ...data,
        netBrl: Number(data.estimatedPayoutBrl || data.netBrl || 0),
        executableRate: Number(data.protectedRateBrl || data.executableRate || 0),
      });
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
      const r = await fetch(API + '/payment/pix/redemption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          amountUsdc,
          pixKey,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setWithdrawalQuote(null);
        throw new Error(data.message || data.error || 'Erro ao solicitar saque Pix');
      }
      const finalNetBrl = Number(data.estimatedPayoutBrl || data.to?.netBrl || data.netBrl || expectedNetBrl);
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
      const r = await fetch(API + '/internal-transfer/send-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUsername: recipientUser.username || normalizeUsername(username),
          amountUsdc: amountToSend,
          note: 'envio app',
          clientRequestId: 'mobile_' + user.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2),
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
      const r = await fetch(API + '/wallet/send-usdc/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const r = await fetch(API + '/wallet/send-usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (asset === 'PAXG') return '#facc15';
    if (asset === 'WBTC') return '#f97316';
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
          <Text style={styles.subtitle}>Seu patrimônio em dólar, simples.</Text>

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
  const patrimonioTotal = saldoBrlEstimado;
  const changePrefix = marketChange >= 0 ? '+' : '';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        <Text style={styles.logo}>NEXA</Text>
        <Text style={styles.subtitle}>Soberania digital no seu bolso</Text>

        {page === 'custody' && (
          <CustodyScreen
            user={user}
            token={token}
            onBack={function () { setPage('home'); }}
            onBalanceRefresh={carregarDados}
          />
        )}

        {/* HOME APPLE MODE: patrimônio, assinatura e Premium em primeiro plano */}
        {page === 'home' && (
          <AppleModeHome
            user={user}
            username={getUsername()}
            saldoUsdc={saldoUsdc}
            saldoBrl={saldoBrlEstimado}
            buyRate={buyRate}
            marketChange={marketChange}
            isPremium={isPremiumUser()}
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
            <Text style={styles.title}>Menu Executivo</Text>
            <Text style={styles.rateText}>Selecione uma opção do ecossistema Nexa:</Text>
            
            {/* BOTÕES ESPECÍFICOS DE REDIRECIONAMENTO LIMPO */}
            <Button title="👤 Acessar Meu Perfil" onPress={function () { setPage('profile'); }} />
            <Button title="📄 Ver Últimas Movimentações" onPress={function () { setPage('extrato'); }} />
            <Button title="🆔 Meu Nexa ID" onPress={function () { setPage('nexaId'); }} />
            <Button title="💳 Depositar Pix" onPress={function () { setPage('deposit'); }} />
            <Button title="📤 Enviar USDC" onPress={function () { setPage('send'); }} />
            <Button title="🏦 Sacar Pix" onPress={function () { setPage('pix'); }} />
            <Button title="🚀 Nexa Rewards" onPress={function () { setPage('rewards'); }} />
            <Button title="⭐ Nexa Premium" onPress={function () { setPage('premium'); }} />
            <Button title="🔁 Cripto por assinatura" onPress={function () { setPage('recurringCrypto'); }} />
            <Button title="🌐 Ecossistema Nexa" onPress={function () { setPage('ecosystem'); }} />
            <Button title="⚖️ Legal e Segurança" onPress={function () { setPage('legal'); }} />
            <Button title="🛡️ Compliance" onPress={() => setPage('compliance')} />
            <Button title="🧩 Ativos Digitais" onPress={function () { setPage('investments'); }} />
            
            <View style={{ marginTop: 20 }}>
              <Button title="🚪 Sair do Aplicativo" onPress={logout} />
            </View>
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
              Sua experiência completa para construir patrimônio em dólar com menos taxas e mais possibilidades.
            </Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>💎 R$ 19,90 por mês</Text>
              <Text style={styles.rateText}>
                Uma assinatura simples para economizar nas operações e acessar benefícios exclusivos.
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>🥇 PAXG e 🟠 WBTC liberados</Text>
              <Text style={styles.rateText}>
                Clientes Premium podem converter USDC para ouro digital PAXG e Bitcoin tokenizado WBTC.
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>🏷️ Desconto nas taxas</Text>
              <Text style={styles.rateText}>
                Menores taxas nas operações elegíveis dentro do app.
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>👑 Atendimento Premium</Text>
              <Text style={styles.rateText}>
                Canal prioritário para dúvidas, suporte e operações.
              </Text>
            </View>
            <View style={isPremiumUser() ? styles.verifiedProfileBox : styles.recipientBoxError}>
              <Text style={isPremiumUser() ? styles.verifiedProfileText : styles.recipientError}>
                {getPremiumLabel()}
              </Text>
            </View>
            <Button title="Quero conhecer meus benefícios" onPress={function () { setPage('investments'); }} />
            <Button title="Ativar meu dólar todo mês" onPress={function () { setPage('recurringCrypto'); }} />
            <Button title="Falar com suporte Premium" onPress={function () { abrirLink('mailto:henriquecampos66@gmail.com?subject=Nexa Premium'); }} />
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
              <Text style={styles.smallLabel}>Saldo disponível</Text>
              <Text style={styles.totalBalance}>{saldoUsdc.toFixed(6)} USDC</Text>
              <Text style={styles.rateText}>≈ R$ {saldoBrlEstimado.toFixed(2)}</Text>
              <Button title="Atualizar carteira" onPress={function () { carregarDados(); buscarPerfilAtualizado(); }} />
            </Card>

            <Card>
              <Text style={styles.title}>Receber USDC</Text>
              <TouchableOpacity style={styles.item} onPress={function () { setPage('receive'); }}>
                <Text style={styles.itemText}>✅ Receber de usuário Nexa</Text>
                <Text style={styles.walletAddressText}>{getUsername()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.item} onPress={function () { setPage('receive'); criarDepositoUsdcExterno(); }}>
                <Text style={styles.itemText}>🌐 Receber USDC externo</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {page === 'receive' && (
          <Card>
            <Text style={styles.title}>Receber USDC</Text>
            <View style={styles.receiveBox}>
              <Text style={styles.receiveHandle}>{getUsername()}</Text>
            </View>
            <View style={styles.pixBox}>
              {usdcDepositAddress ? (
                <>
                  <View style={styles.qrBox}><QRCode value={usdcDepositAddress} size={180} /></View>
                  <Text style={styles.copyText}>{usdcDepositAddress}</Text>
                  <Input placeholder="Cole aqui o txHash Polygon" value={usdcTxHash} onChangeText={setUsdcTxHash} />
                  <Button title="Confirmar recebimento" onPress={confirmarDepositoUsdcExterno} />
                </>
              ) : <Button title="Gerar endereço USDC" onPress={criarDepositoUsdcExterno} />}
            </View>
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
            <Input placeholder="@username" value={username} onChangeText={(v) => { setUsername(v); setRecipientUser(null); }} />
            <Button title="Verificar usuário" onPress={buscarDestinatario} />
            {recipientUser && <Text style={styles.recipientOk}>✅ {recipientUser.fullName}</Text>}
            <Input placeholder="Valor USDC" keyboardType="numeric" value={valorUsdc} onChangeText={setValorUsdc} />
            <Button title="Enviar para @username" onPress={enviarUsername} />
            
            <Input placeholder="Carteira 0x..." value={wallet} onChangeText={setWallet} />
            <Button title="Enviar para carteira" onPress={enviarWallet} />
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
            <Text style={styles.title}>Cripto por assinatura</Text>
            <Text style={styles.itemText}>
              Programe uma compra mensal automática de USDC.
            </Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>💵 Ativo da assinatura: USDC</Text>
              <Text style={styles.rateText}>
                Para manter a experiência simples, a compra recorrente é feita apenas em USDC.
                PAXG e WBTC ficam na aba Ativos e são exclusivos para clientes Premium.
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>🔁 Como funciona</Text>
              <Text style={styles.rateText}>
                Você escolhe o valor mensal e o dia do mês. A Nexa gera a autorização Pix para automatizar a compra recorrente.
              </Text>
            </View>
            <Input placeholder="Valor mensal em R$" keyboardType="numeric" value={recurringAmountBrl} onChangeText={setRecurringAmountBrl} />
            <Input placeholder="Dia do mês. Ex: 5" keyboardType="numeric" value={recurringDay} onChangeText={setRecurringDay} />
            <Button title="Salvar compra mensal de USDC" onPress={salvarAssinaturaRecorrente} />
            <Button title="Ativar Pix Automático" onPress={gerarLinkAssinaturaWoovi} />
            {recurringPlan ? (
              <View style={styles.verifiedProfileBox}>
                <Text style={styles.verifiedProfileText}>
                  Assinatura configurada para USDC
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
              Use seu saldo em USDC na infraestrutura DeFi da Nexa.
            </Text>
            <View style={styles.item}>
              <Text style={styles.itemText}>🟢 Como funciona</Text>
              <Text style={styles.rateText}>
                Você ativa um valor em USDC. A infraestrutura da Nexa utiliza Aave V3 na Polygon.
                Os benefícios gerados são compartilhados em Rewards.
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>🎁 Divisão dos Rewards</Text>
              <Text style={styles.rateText}>
                Você recebe até 80% dos Rewards gerados. A Nexa retém até 20% para custear infraestrutura, liquidez e operação.
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={styles.itemText}>⚠️ Importante</Text>
              <Text style={styles.rateText}>
                Rewards não são promessa de rentabilidade, investimento garantido ou juros. Podem variar conforme a infraestrutura utilizada.
              </Text>
            </View>
            <Input placeholder="Valor em USDC para ativar Rewards" keyboardType="numeric" value={rewardAmount} onChangeText={setRewardAmount} />
            <Button title="Ativar Nexa Rewards" onPress={ativarRewards} />
            {rewardPositions.length > 0 ? (
              <View style={styles.item}>
                <Text style={styles.itemText}>Posições Rewards</Text>
                {rewardPositions.map(function (position) {
                  return (
                    <View key={position.id || position.positionId || String(position.createdAt)} style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Saldo ativado</Text>
                      <Text style={styles.receiptValue}>
                        {Number(position.amountUsdc || position.principalUsdc || 0).toFixed(6)} USDC
                      </Text>
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
            <Text style={styles.title}>Ativos Digitais</Text>
            <Text style={styles.itemText}>
              Gerencie USDC, PAXG e WBTC dentro da Nexa.
            </Text>
            {portfolio && <Text style={styles.totalBalance}>US$ {Number(portfolio.totalUsd || 0).toFixed(2)}</Text>}

            <TouchableOpacity
              style={investmentAsset === 'USDC' ? styles.recipientBox : styles.item}
              onPress={function () { selectInvestmentAsset('USDC'); }}
            >
              <Text style={styles.itemText}>💵 USDC</Text>
              <Text style={styles.rateText}>
                Disponível para todos. Base para saldo, assinatura, Rewards e conversões.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={investmentAsset === 'PAXG' ? styles.recipientBox : styles.item}
              onPress={function () { selectInvestmentAsset('PAXG'); }}
            >
              <Text style={styles.itemText}>🥇 PAXG · Ouro digital</Text>
              <Text style={styles.rateText}>
                {isPremiumUser() ? 'Disponível para conversão a partir de USDC.' : '🔒 Disponível apenas para clientes Nexa Premium.'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={investmentAsset === 'WBTC' ? styles.recipientBox : styles.item}
              onPress={function () { selectInvestmentAsset('WBTC'); }}
            >
              <Text style={styles.itemText}>🟠 WBTC · Bitcoin tokenizado</Text>
              <Text style={styles.rateText}>
                {isPremiumUser() ? 'Disponível para conversão a partir de USDC.' : '🔒 Disponível apenas para clientes Nexa Premium.'}
              </Text>
            </TouchableOpacity>

            {!canUseAsset(investmentAsset) ? (
              <View style={styles.recipientBoxError}>
                <Text style={styles.recipientError}>
                  {investmentAsset} é exclusivo para clientes Nexa Premium.
                </Text>
                <Text style={styles.rateText}>
                  Assine por R$19,90/mês (cobrados em USDC/Cotação do dia) para liberar PAXG, WBTC, taxas menores e atendimento Premium.
                </Text>
              </View>
            ) : (
              <>
                <Input placeholder={'Valor em USDC para converter em ' + investmentAsset} keyboardType="numeric" value={investmentAmount} onChangeText={setInvestmentAmount} />
                <Button title={'Simular conversão para ' + investmentAsset} onPress={cotarInvestimento} />
                {investmentQuote?.allowed && <Button title="Confirmar conversão" onPress={executarInvestimento} />}
              </>
            )}

            <Button title="Ver Nexa Premium" onPress={function () { setPage('premium'); }} />
            <Button title="Voltar" onPress={function () { setPage('home'); }} />
          </Card>
        )}

        {/* SUB-PÁGINA EXTRATO: SÓ ABRE VIA CLIQUE NO BOTÃO DO MENU */}
        {page === 'extrato' && (
          <Card>
            <Text style={styles.title}>Histórico Premium</Text>
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
      <View style={styles.menu}>
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
  content: { flex: 1, padding: 20, paddingTop: 55 },
  scrollContent: { paddingBottom: 130 },
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
  menu: { height: 78, backgroundColor: '#020617', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#1e293b' },
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
};
