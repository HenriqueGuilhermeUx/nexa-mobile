import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';

import { config } from '@/config';
import { nexaApi } from '@/lib/api';
import CustodyScreen from '../../nexa-mobile/nexa-mobile/CustodyScreen';

const API = config.apiUrl.replace(/\/$/, '');
const POLYGON_CHAIN_ID = 137;
const POLYGON_USDC_CONTRACT = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const PremiumThemeContext = React.createContext(false);

function encodeUsdcTransfer(toAddress: string, amountUsdc: number) {
  const cleanAddress = String(toAddress || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
    throw new Error('Endereço de destino inválido.');
  }

  const atomic = BigInt(Math.round(Number(amountUsdc) * 1_000_000));
  if (atomic <= 0n) throw new Error('Valor USDC inválido.');

  const selector = 'a9059cbb';
  const addressWord = cleanAddress.slice(2).toLowerCase().padStart(64, '0');
  const amountWord = atomic.toString(16).padStart(64, '0');
  return `0x${selector}${addressWord}${amountWord}`;
}

const ASSETS = [
  { symbol: 'USDC', name: 'USD Coin', icon: '💵', description: 'Dólar digital para saldo, Pix, assinatura e transferências Nexa.' },
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', description: 'Bitcoin disponível dentro da Nexa.' },
  { symbol: 'ETH', name: 'Ethereum', icon: '◆', description: 'Ethereum disponível dentro da Nexa.' },
  { symbol: 'PAXG', name: 'Ouro Digital', icon: '◈', description: 'Ouro Digital disponível na sua carteira Nexa.' },
];

function premiumActive(user: any) {
  // /user/me is the canonical subscription source.
  // A Rewards plan, asset pilot or technical test entitlement must never turn
  // the customer's Premium identity on.
  if (typeof user?.premium?.isPremium === 'boolean') {
    return user.premium.isPremium === true;
  }

  // Compatibility only for older cached sessions that predate the canonical
  // premium object.
  const status = String(
    user?.premiumStatus || user?.subscriptionStatus || user?.plan || '',
  ).toLowerCase();
  return Boolean(
    user?.isPremium === true ||
      user?.premiumActive === true ||
      status === 'premium' ||
      status === 'active' ||
      status === 'ativo',
  );
}

function amount(value: any, digits = 6) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits })
    : '0';
}

function newClientRequestId(prefix: string, userId?: string) {
  const safeUser = String(userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
  return `${prefix}_${safeUser}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function money(value: any) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function maskPixKey(value: unknown, type?: unknown) {
  const key = String(value || '').trim();
  const normalizedType = String(type || '').trim().toUpperCase();
  if (!key) return '—';

  if (normalizedType === 'CPF') {
    const digits = key.replace(/\D/g, '');
    return digits.length === 11
      ? `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`
      : 'CPF confirmado';
  }

  if (normalizedType === 'EMAIL') {
    const [name, domain] = key.toLowerCase().split('@');
    return name && domain
      ? `${name.slice(0, Math.min(2, name.length))}***@${domain}`
      : 'E-mail confirmado';
  }

  if (normalizedType === 'PHONE') {
    const digits = key.replace(/\D/g, '');
    return digits.length >= 8 ? `(**) *****-${digits.slice(-4)}` : 'Telefone confirmado';
  }

  return 'Chave confirmada';
}

function Card({ children, style }: any) {
  const premiumTheme = React.useContext(PremiumThemeContext);
  return (
    <View
      style={[
        styles.card,
        style,
        premiumTheme ? styles.cardPremiumTheme : null,
      ]}
    >
      {children}
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled, secondary }: any) {
  const premiumTheme = React.useContext(PremiumThemeContext);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.84}
      style={[
        styles.button,
        secondary ? styles.buttonSecondary : null,
        premiumTheme
          ? secondary
            ? styles.buttonSecondaryPremium
            : styles.buttonPremium
          : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : null]}>{title}</Text>
    </TouchableOpacity>
  );
}

function MenuTile({ icon, title, subtitle, onPress, accent, premium }: any) {
  const globalPremium = React.useContext(PremiumThemeContext);
  const premiumTheme = globalPremium || premium;
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={[
        styles.menuTile,
        accent ? styles.menuTileAccent : null,
        premiumTheme ? styles.menuTilePremium : null,
      ]}
    >
      <Text
        style={[
          styles.menuTileIcon,
          premiumTheme ? styles.menuTileIconPremium : null,
        ]}
      >
        {icon}
      </Text>
      <Text style={styles.menuTileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.menuTileSubtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

function BottomNav({ page, onNavigate, premium }: any) {
  const insets = useSafeAreaInsets();
  const globalPremium = React.useContext(PremiumThemeContext);
  const premiumTheme = globalPremium || premium;
  const items = [
    ['home', '⌂', 'Início'],
    ['wallet', '◫', 'Carteira'],
    ['assets', '◇', 'Ativos'],
    ['send', '↑', 'Enviar'],
    ['menu', '☰', 'Menu'],
  ];
  return (
    <View
      style={[
        styles.bottomNav,
        premiumTheme ? styles.bottomNavPremium : null,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      {items.map(([target, icon, label]) => {
        const active = page === target;
        return (
          <TouchableOpacity
            key={target}
            style={styles.bottomItem}
            onPress={() => onNavigate(target)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.bottomIcon,
                active ? styles.bottomActive : null,
                active && premiumTheme ? styles.bottomActivePremium : null,
              ]}
            >
              {icon}
            </Text>
            <Text
              style={[
                styles.bottomLabel,
                active ? styles.bottomActive : null,
                active && premiumTheme ? styles.bottomActivePremium : null,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AlignedLegacyApp({ initialUser, token, onLogout }: any) {
  const insets = useSafeAreaInsets();
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const embeddedWallet = useMemo(
    () => wallets.find((candidate) => /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || ''))) || null,
    [wallets],
  );

  const [page, setPage] = useState('home');
  const [user, setUser] = useState<any>(initialUser || {});
  const [balances, setBalances] = useState<any>({ BRL: 0, USDC: 0, BTC: 0, ETH: 0, PAXG: 0 });
  const [walletFirst, setWalletFirst] = useState<any>(null);
  const [payoutSubaccount, setPayoutSubaccount] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [statement, setStatement] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any>(null);
  const [rewardPlans, setRewardPlans] = useState<any[]>([]);
  const [rewardPositions, setRewardPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [recipient, setRecipient] = useState<any>(null);
  const [sendAmount, setSendAmount] = useState('');
  const [asset, setAsset] = useState('BTC');
  const [assetAmountUsdc, setAssetAmountUsdc] = useState('');
  const [assetQuote, setAssetQuote] = useState<any>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringDay, setRecurringDay] = useState('5');
  const [depositAmountBrl, setDepositAmountBrl] = useState('');
  const [depositResult, setDepositResult] = useState<any>(null);
  const [withdrawAmountUsdc, setWithdrawAmountUsdc] = useState('');
  const [withdrawPixKey, setWithdrawPixKey] = useState('');
  const [withdrawQuote, setWithdrawQuote] = useState<any>(null);
  const [internalTransferRequestId, setInternalTransferRequestId] = useState('');
  const [assetBuyRequestId, setAssetBuyRequestId] = useState('');
  const [assetSellRequestId, setAssetSellRequestId] = useState('');
  const [pixOutRequestId, setPixOutRequestId] = useState('');
  const [rewardAmountUsdc, setRewardAmountUsdc] = useState('');
  const [rewardJoinRequestId, setRewardJoinRequestId] = useState('');
  const [depositRequestId, setDepositRequestId] = useState('');
  const [recurringAddress, setRecurringAddress] = useState({
    zipcode: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
  });

  const isPremium = premiumActive(user);
  const walletAddress =
    walletFirst?.portfolio?.address ||
    user?.wallet?.address ||
    user?.walletAddress ||
    embeddedWallet?.address ||
    '';
  const hasExistingWallet = Boolean(walletAddress);
  const canAccessCustody = hasExistingWallet;
  const firstName = String(user?.fullName || 'Cliente').split(' ')[0];
  const handle = user?.handle || (user?.username ? `@${user.username}` : '');
  const nexaId = String(user?.nexaId || '').trim();
  const walletNetwork = String(user?.wallet?.network || user?.walletNetwork || 'polygon');

  const nexaPassportQrValue = useMemo(
    () =>
      nexaId
        ? JSON.stringify({
            type: 'NEXA_PASSPORT',
            nexaId,
            username: handle,
            name: user?.fullName || '',
            wallet: walletAddress || null,
            network: walletNetwork,
            kyc: String(user?.kycStatus || 'pending').toLowerCase(),
          })
        : '',
    [nexaId, handle, user?.fullName, user?.kycStatus, walletAddress, walletNetwork],
  );

  const clientHeaders = useMemo(
    () => ({
      'X-Nexa-App-Version': config.appVersion,
      'X-Nexa-App-Build': config.appBuild,
      'X-Nexa-Platform': Platform.OS,
    }),
    [],
  );

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...clientHeaders,
      Authorization: `Bearer ${token}`,
    }),
    [clientHeaders, token],
  );

  async function json(url: string, options: any = {}) {
    const headers = {
      ...clientHeaders,
      ...(options.headers || {}),
    };
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Falha ${response.status}`);
    }
    return data;
  }

  async function loadAll() {
    if (!user?.id || !token) return;
    setLoading(true);
    setMessage('');
    try {
      const cache = Date.now();
      const [
        meResult,
        walletFirstResult,
        payoutSubaccountResult,
        legacyBalanceResult,
        legacyPortfolioResult,
        statementResult,
      ] = await Promise.allSettled([
          json(`${API}/user/me`, { headers: authHeaders }),
          json(`${API}/wallet-v15/me?_${cache}`, { headers: authHeaders }),
          json(`${API}/d1-payout/subaccount/me?_${cache}`, { headers: authHeaders }),
          json(`${API}/ledger/balance?userId=${encodeURIComponent(user.id)}&mode=portfolio&_=${cache}`, { headers: authHeaders }),
          json(`${API}/swap/portfolio?_=${cache}`, { headers: authHeaders }),
          json(`${API}/ledger/statement?userId=${encodeURIComponent(user.id)}&limit=40&mode=portfolio&_=${cache}`, { headers: authHeaders }),
        ]);

      const me =
        meResult.status === 'fulfilled' ? meResult.value : null;
      const currentUser = me?.user || me || user;
      setUser(currentUser);

      const wf =
        walletFirstResult.status === 'fulfilled' &&
        walletFirstResult.value?.success === true
          ? walletFirstResult.value
          : null;
      setWalletFirst(wf);
      setPayoutSubaccount(
        payoutSubaccountResult.status === 'fulfilled'
          ? payoutSubaccountResult.value
          : null,
      );

      const legacyBalance =
        legacyBalanceResult.status === 'fulfilled'
          ? legacyBalanceResult.value
          : null;
      const legacyPortfolio =
        legacyPortfolioResult.status === 'fulfilled' &&
        legacyPortfolioResult.value?.success === true
          ? legacyPortfolioResult.value
          : null;

      const wfBalances = wf?.portfolio?.balances || {};
      const walletReady = wf?.portfolio?.walletReady === true;
      setBalances({
        BRL: Number(legacyBalance?.balances?.BRL || 0),
        USDC: walletReady
          ? Number(wfBalances.USDC || 0)
          : Number(legacyBalance?.balances?.USDC || 0),
        BTC: walletReady
          ? Number(wfBalances.WBTC || 0)
          : Number(legacyBalance?.balances?.BTC || 0),
        ETH: walletReady
          ? Number(wfBalances.WETH || 0)
          : Number(legacyBalance?.balances?.ETH || 0),
        PAXG: walletReady
          ? Number(wfBalances.PAXG || 0)
          : Number(
              legacyBalance?.balances?.PAXG ||
                legacyBalance?.balances?.XAUT ||
                0,
            ),
      });

      setPortfolio(walletReady ? null : legacyPortfolio);
      setStatement(
        statementResult.status === 'fulfilled'
          ? statementResult.value?.statement || []
          : [],
      );

      const [recurringData, plansData, positionsData] = await Promise.allSettled([
        json(`${API}/recurring-pix/me`, { headers: authHeaders }),
        json(`${API}/rewards/plans`),
        json(`${API}/rewards/positions?userId=${encodeURIComponent(user.id)}`),
      ]);
      if (recurringData.status === 'fulfilled') {
        const d: any = recurringData.value;
        setRecurring(d?.recurringPix || d?.plan || d?.recurring || d?.data || null);
      }
      if (plansData.status === 'fulfilled') {
        setRewardPlans((plansData.value as any)?.plans || []);
      }
      if (positionsData.status === 'fulfilled') {
        setRewardPositions((positionsData.value as any)?.positions || []);
      }
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível atualizar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [initialUser?.id, token]);

  async function openNexaSupport() {
    const supportMessage = [
      'Olá, equipe Nexa!',
      '',
      'Preciso de ajuda com minha conta.',
      user?.email ? `E-mail: ${user.email}` : '',
      handle ? `Nexa ID/usuário: ${handle}` : '',
      '',
      'Se for sobre atualização ou saldo anterior, posso enviar os detalhes por aqui.',
    ]
      .filter(Boolean)
      .join('\n');

    const url =
      'https://wa.me/551333289704?text=' +
      encodeURIComponent(supportMessage);

    try {
      await Linking.openURL(url);
    } catch {
      setMessage(
        'Não foi possível abrir o WhatsApp. Fale com a Nexa pelo número (13) 3328-9704.',
      );
    }
  }

  async function findRecipient() {
    const clean = username.replace('@', '').trim().toLowerCase();
    if (!clean) return setMessage('Digite um @username.');
    try {
      setMessage('Verificando usuário...');
      const data = await json(`${API}/user/by-username/${encodeURIComponent(clean)}`);
      if (!data?.user) throw new Error('Usuário Nexa não encontrado.');
      setRecipient(data.user);
      setMessage(`Usuário confirmado: ${data.user.handle || `@${data.user.username}`}`);
    } catch (error: any) {
      setRecipient(null);
      setMessage(error.message);
    }
  }

  async function sendInternal() {
    const value = Number(String(sendAmount).replace(',', '.'));
    if (!recipient) return setMessage('Verifique o @username antes de enviar.');
    if (!value || value <= 0) return setMessage('Informe um valor USDC válido.');
    try {
      setLoading(true);
      const requestId =
        internalTransferRequestId ||
        newClientRequestId('mobile_transfer', user.id);
      if (!internalTransferRequestId) setInternalTransferRequestId(requestId);

      const data = await json(`${API}/internal-transfer/send-by-username`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          asset: 'USDC',
          toUsername: recipient.username || username.replace('@', ''),
          amountUsdc: value,
          note: 'Nexa mobile',
          clientRequestId: requestId,
        }),
      });
      setMessage(data?.message || 'USDC enviado com sucesso.');
      setUsername('');
      setRecipient(null);
      setSendAmount('');
      setInternalTransferRequestId('');
      await loadAll();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function quoteAsset() {
    const value = Number(String(assetAmountUsdc).replace(',', '.'));
    if (!value || value <= 0) return setMessage('Informe um valor USDC válido.');
    try {
      setLoading(true);
      setAssetQuote(null);
      const data = await json(`${API}/swap/investment-quote`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ toAsset: asset, amountUsdc: value }),
      });
      setAssetQuote(data);
      if (data?.allowed !== false) {
        setAssetBuyRequestId(newClientRequestId(`mobile_buy_${asset}`, user.id));
      }
      setMessage(data?.allowed === false ? data?.reason || 'Cotação indisponível.' : 'Cotação atualizada.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeAssetBuy() {
    if (!config.financialExecutionEnabled) {
      return setMessage('Execução financeira está desativada neste build. A cotação pode ser conferida normalmente.');
    }
    const value = Number(String(assetAmountUsdc).replace(',', '.'));
    if (!assetQuote?.allowed || !value) return setMessage('Atualize a cotação antes de confirmar.');
    try {
      setLoading(true);
      const data = await json(`${API}/swap/investment-execute`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          toAsset: asset,
          amountUsdc: value,
          clientRequestId:
            assetBuyRequestId ||
            newClientRequestId(`mobile_buy_${asset}`, user.id),
        }),
      });
      setMessage(data?.message || `${asset} confirmado na Nexa.`);
      setAssetAmountUsdc('');
      setAssetQuote(null);
      setAssetBuyRequestId('');
      await loadAll();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function quoteSell() {
    const value = Number(String(sellAmount).replace(',', '.'));
    if (!value || value <= 0) return setMessage(`Informe uma quantidade de ${asset} válida.`);
    try {
      setLoading(true);
      const data = await json(`${API}/swap/redeem-quote`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ fromAsset: asset, amount: value }),
      });
      setSellQuote(data);
      if (data?.allowed !== false) {
        setAssetSellRequestId(newClientRequestId(`mobile_sell_${asset}`, user.id));
      }
      setMessage(data?.allowed === false ? data?.reason || 'Cotação indisponível.' : 'Cotação de saída atualizada.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeSell() {
    if (!config.financialExecutionEnabled) {
      return setMessage('Execução financeira está desativada neste build.');
    }
    const value = Number(String(sellAmount).replace(',', '.'));
    if (!sellQuote?.allowed || !value) return setMessage('Atualize a cotação antes de confirmar.');
    try {
      setLoading(true);
      const data = await json(`${API}/swap/redeem-execute`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          fromAsset: asset,
          amount: value,
          clientRequestId:
            assetSellRequestId ||
            newClientRequestId(`mobile_sell_${asset}`, user.id),
        }),
      });
      setMessage(data?.message || `${asset} convertido para USDC.`);
      setSellAmount('');
      setSellQuote(null);
      setAssetSellRequestId('');
      await loadAll();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveRecurring() {
    const value = Number(String(recurringAmount).replace(',', '.'));
    const day = Number(recurringDay || 5);
    if (!value || value < 10) return setMessage('Valor mensal mínimo: R$ 10,00.');
    if (!Number.isInteger(day) || day < 1 || day > 28) return setMessage('Escolha um dia entre 1 e 28.');
    try {
      setLoading(true);
      const data = await json(`${API}/recurring-pix/upsert`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          monthlyAmountBrl: value,
          preferredDay: day,
        }),
      });
      setRecurring(data?.recurringPix || null);
      setMessage(data?.message || 'USDC por assinatura atualizado.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function pauseRecurring() {
    if (!recurring) return setMessage('Nenhuma assinatura ativa para pausar.');
    try {
      setLoading(true);
      const data = await json(`${API}/recurring-pix/pause`, {
        method: 'POST',
        headers: authHeaders,
      });
      setRecurring(data?.recurringPix || recurring);
      setMessage(data?.message || 'USDC por assinatura pausado.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRecurring() {
    if (!recurring) return setMessage('Nenhuma assinatura para cancelar.');
    try {
      setLoading(true);
      const data = await json(`${API}/recurring-pix/cancel`, {
        method: 'POST',
        headers: authHeaders,
      });
      setRecurring(data?.recurringPix || recurring);
      setMessage(data?.message || 'USDC por assinatura cancelado.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function linkRecurringWoovi() {
    if (!recurring) return setMessage('Salve a assinatura antes de ativar o Pix Automático.');
    if (!config.financialExecutionEnabled) {
      return setMessage('Pix Automático está bloqueado neste build de preview.');
    }
    try {
      setLoading(true);
      const data = await json(`${API}/recurring-pix/link-woovi`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          address: recurringAddress,
        }),
      });
      if (data?.success === false) throw new Error(data?.message || 'Não foi possível ativar o Pix Automático.');
      setRecurring(data?.recurringPix || recurring);
      setMessage(data?.message || 'Pix Automático vinculado à sua assinatura.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinRewards() {
    const value = Number(String(rewardAmountUsdc).replace(',', '.'));
    if (!value || value <= 0) return setMessage('Informe um valor USDC válido.');
    if (!isPremium) return setMessage('Nexa Rewards está disponível para clientes Premium.');
    if (!config.financialExecutionEnabled) {
      return setMessage('Participação no Rewards está bloqueada neste build de preview.');
    }

    try {
      setLoading(true);
      const requestId =
        rewardJoinRequestId ||
        newClientRequestId('mobile_rewards_join', user.id);
      if (!rewardJoinRequestId) setRewardJoinRequestId(requestId);

      const data = await json(`${API}/rewards/join`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amountUsdc: value,
          plan: 'FLEX',
          clientRequestId: requestId,
        }),
      });

      setRewardAmountUsdc('');
      setRewardJoinRequestId('');
      setMessage(data?.message || 'Saldo reservado no Nexa Rewards.');
      await loadAll();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function withdrawReward(positionId: string) {
    if (!positionId) return;
    if (!config.financialExecutionEnabled) {
      return setMessage('Resgate Rewards está bloqueado neste build de preview.');
    }

    try {
      setLoading(true);
      const data = await json(
        `${API}/rewards/withdraw/${encodeURIComponent(positionId)}`,
        {
          method: 'POST',
          headers: authHeaders,
        },
      );
      setMessage(data?.message || 'Rewards resgatado.');
      await loadAll();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createPixDeposit() {
    const value = Number(String(depositAmountBrl).replace(',', '.'));
    if (!value || value < 10) return setMessage('Depósito Pix mínimo: R$ 10,00.');
    if (!config.financialExecutionEnabled) {
      return setMessage('Geração de cobrança Pix está bloqueada neste build de preview.');
    }
    try {
      setLoading(true);
      setDepositResult(null);
      const requestId =
        depositRequestId ||
        newClientRequestId('mobile_pix_in', user.id);
      if (!depositRequestId) setDepositRequestId(requestId);
      const data = await json(`${API}/fiat-deposit/woovi/create-charge`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amountBrl: value,
          clientRequestId: requestId,
        }),
      });
      setDepositResult({
        ...data,
        customerStage: 'awaiting_pix',
        customerLabel: 'Aguardando Pix',
        customerMessage:
          'Pague usando o QR Code ou copia e cola. Assim que o Pix for confirmado, a Nexa acompanha a conversão e o envio do USDC para sua carteira.',
      });
      setDepositRequestId(requestId);
      setMessage(
        'Pix criado. Após o pagamento, a confirmação pode levar alguns instantes. Você será avisado quando o USDC estiver disponível.',
      );
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPixDeposit() {
    const correlationID = String(
      depositResult?.correlationID || depositRequestId || '',
    ).trim();
    if (!correlationID) return setMessage('Gere um Pix primeiro.');
    try {
      setLoading(true);
      const data = await json(
        `${API}/fiat-deposit/wallet-first/status/${encodeURIComponent(correlationID)}`,
        { headers: authHeaders },
      );
      setDepositResult((current: any) => ({
        ...current,
        ...data,
        correlationID,
        customerStage: data?.stage || current?.customerStage,
        customerLabel: data?.label || current?.customerLabel,
        customerMessage: data?.message || current?.customerMessage,
      }));
      setMessage(
        data?.message ||
          (data?.completed
            ? 'Confirmação concluída. Seu USDC já está disponível.'
            : 'Confirmação em andamento. Você pode fechar o app; avisaremos por e-mail quando concluir.'),
      );
      if (data?.completed === true) await loadAll();
    } catch (error: any) {
      setMessage(
        error?.message ||
          'Não foi possível atualizar agora. Seu Pix não precisa ser pago novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function quotePixWithdrawal() {
    const value = Number(String(withdrawAmountUsdc).replace(',', '.'));
    if (!value || value <= 0) return setMessage('Informe um valor USDC válido.');
    try {
      setLoading(true);
      setWithdrawQuote(null);
      const data = await json(`${API}/payment/pix/quote`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ amountUsdc: value }),
      });
      setWithdrawQuote({
        ...data,
        netBrl: Number(data?.estimatedPayoutBrl || data?.netBrl || 0),
        executableRate: Number(
          data?.protectedRateBrl || data?.executableRate || 0,
        ),
      });
      setPixOutRequestId(newClientRequestId('mobile_pixout', user.id));
      setMessage('Cotação Pix atualizada.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestPixWithdrawal() {
    const value = Number(String(withdrawAmountUsdc).replace(',', '.'));
    const key = String(withdrawPixKey || '').trim();
    if (!withdrawQuote || !value) return setMessage('Atualize a cotação antes de solicitar o Pix.');
    if (!key) return setMessage('Informe sua chave Pix.');
    if (!config.financialExecutionEnabled) {
      return setMessage('Solicitação de Pix está bloqueada neste build de preview.');
    }
    try {
      setLoading(true);
      const data = await json(`${API}/payment/pix/redemption`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amountUsdc: value,
          pixKey: key,
        }),
      });
      setMessage(data?.message || 'Solicitação Pix registrada.');
      setWithdrawAmountUsdc('');
      setWithdrawPixKey('');
      setWithdrawQuote(null);
      setPixOutRequestId('');
      await loadAll();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendExternalPrivyUsdc({
    toAddress,
    amountUsdc,
  }: {
    toAddress: string;
    amountUsdc: number;
  }) {
    if (!config.financialExecutionEnabled) {
      throw new Error('Envio externo está bloqueado neste build de preview.');
    }
    if (!embeddedWallet?.address) {
      throw new Error('Sua carteira não está disponível neste dispositivo.');
    }

    const linkedAddress = String(walletAddress || '').toLowerCase();
    const deviceAddress = String(embeddedWallet.address || '').toLowerCase();
    if (linkedAddress && linkedAddress !== deviceAddress) {
      throw new Error(
        'A carteira deste dispositivo não corresponde à carteira vinculada à sua conta Nexa.',
      );
    }

    const value = Number(amountUsdc);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Informe um valor USDC válido.');
    }

    const cleanTo = String(toAddress || '').trim();
    const transferData = encodeUsdcTransfer(cleanTo, value);

    if (typeof embeddedWallet.switchChain === 'function') {
      await embeddedWallet.switchChain(POLYGON_CHAIN_ID);
    }

    const provider = await embeddedWallet.getEthereumProvider();
    const result = await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: embeddedWallet.address,
          to: POLYGON_USDC_CONTRACT,
          value: '0x0',
          data: transferData,
        },
      ],
    });

    const txHash =
      typeof result === 'string'
        ? result
        : String((result as any)?.hash || (result as any)?.transactionHash || '');

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new Error(
        'A carteira assinou a operação, mas não retornou um hash de transação válido.',
      );
    }

    try {
      const journal = await json(`${API}/wallet/my-privy/journal-usdc-send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          txHash,
          toAddress: cleanTo,
          amountUsdc: value,
        }),
      });
      return { txHash, journal };
    } catch (journalError: any) {
      return {
        txHash,
        journal: null,
        journalWarning:
          journalError?.message ||
          'Transação enviada; o registro Nexa será conciliado posteriormente.',
      };
    }
  }


  const portfolioPositions = useMemo(() => {
    const byAsset: Record<string, any> = {};
    for (const item of portfolio?.positions || []) {
      byAsset[String(item.asset || '').toUpperCase()] = item;
    }
    return ASSETS.map((item) => ({
      ...item,
      amount: Number(byAsset[item.symbol]?.amount ?? balances[item.symbol] ?? 0),
      valueUsd: Number(byAsset[item.symbol]?.valueUsd || 0),
      priceUsd: Number(byAsset[item.symbol]?.priceUsd || 0),
    }));
  }, [portfolio, balances]);

  const portfolioTotalUsd = useMemo(
    () =>
      portfolioPositions.reduce(
        (total, item) => total + Math.max(0, Number(item.valueUsd || 0)),
        0,
      ),
    [portfolioPositions],
  );

  function openWalletFirstDeposit() {
    router.push('/(app)/new-order' as any);
  }

  function openWalletFirstWithdraw() {
    router.push('/(app)/cash-out' as any);
  }

  function openWalletFirstSend() {
    router.push('/(app)/send-nexa' as any);
  }

  function openWalletFirstAssets() {
    router.push('/(app)/buy-crypto' as any);
  }

  function openUsdcSubscription() {
    router.push('/open-finance-recurring' as any);
  }

  const contentBottom = 92 + Math.max(insets.bottom, 10);

  function Home() {
    return (
      <>
        <View style={styles.homeTop}>
          <View>
            <Text style={[styles.welcomeLabel, isPremium ? styles.premiumAccentText : null]}>
              CRIPTO WALLET
            </Text>
            <Text style={styles.hello}>Olá, {firstName}</Text>
            <Text style={styles.handle}>{handle || 'Conta Nexa'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setPage('profile')}
            style={[styles.avatar, isPremium ? styles.avatarPremium : null]}
          >
            <Text style={[styles.avatarText, isPremium ? styles.avatarTextPremium : null]}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        <Card style={[styles.heroCard, isPremium ? styles.heroCardPremium : null]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>
                CARTEIRA CRIPTO
              </Text>
              <Text style={styles.heroAmount}>{amount(balances.USDC, 6)}</Text>
              <Text style={styles.heroUnit}>USDC disponível</Text>
            </View>
            <View style={[styles.heroMark, isPremium ? styles.heroMarkPremium : null]}>
              <Text style={[styles.heroMarkText, isPremium ? styles.premiumAccentText : null]}>N</Text>
            </View>
          </View>
          {portfolioTotalUsd > 0 ? (
            <Text style={[styles.portfolioValue, isPremium ? styles.portfolioValuePremium : null]}>
              Carteira estimada: US$ {amount(portfolioTotalUsd, 2)}
            </Text>
          ) : null}
          <Text style={styles.heroHint}>
            Seu USDC e seus ativos em uma experiência simples, com a parte técnica nos bastidores.
          </Text>
        </Card>

        <View style={styles.quickRow}>
          <MenuTile icon="＋" title="Adicionar" subtitle="Pix → USDC" onPress={openWalletFirstDeposit} />
          <MenuTile icon="↓" title="Sacar" subtitle="USDC → Pix" onPress={openWalletFirstWithdraw} />
          <MenuTile icon="↑" title="Enviar" subtitle="Nexa → Nexa" onPress={openWalletFirstSend} />
          <MenuTile icon="◇" title="Comprar" subtitle="BTC · ETH · Ouro" onPress={openWalletFirstAssets} accent />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>CARTEIRA</Text>
            <Text style={styles.sectionTitle}>Seus ativos</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('assets')}>
            <Text style={[styles.inlineAction, isPremium ? styles.premiumAccentText : null]}>
              Ver todos
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.assetGrid}>
          {portfolioPositions.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={[
                styles.assetMini,
                isPremium ? styles.premiumSurface : null,
              ]}
              onPress={() => {
                setAsset(item.symbol === 'USDC' ? 'BTC' : item.symbol);
                setPage(item.symbol === 'USDC' ? 'wallet' : 'assets');
              }}
            >
              <Text style={[styles.assetIcon, isPremium ? styles.premiumAccentText : null]}>
              {item.icon}
            </Text>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetBalance}>{amount(item.amount, 6)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {config.assistantEnabled ? (
          <Card style={styles.staffCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={[styles.staffEyebrow, isPremium ? styles.premiumAccentText : null]}>ASSISTENTE NEXA</Text>
                <Text style={styles.highlightTitle}>Seu assistente pessoal.</Text>
                <Text style={styles.highlightText}>
                  Organize o dia, acompanhe prioridades e use seu contexto da Nexa quando precisar.
                </Text>
              </View>
              <View style={[styles.staffOrb, isPremium ? styles.premiumBorder : null]}>
                <Text style={[styles.staffOrbText, isPremium ? styles.premiumAccentText : null]}>
                  ✦
                </Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.staffPrimaryAction,
                  isPremium ? styles.staffPrimaryActionPremium : null,
                ]}
                onPress={() => router.push('/assistant')}
              >
                <Text style={styles.staffPrimaryActionText}>Abrir Assistente</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.staffSecondaryAction,
                  isPremium ? styles.premiumBorder : null,
                ]}
                onPress={openNexaSupport}
              >
                <Text style={styles.staffSecondaryActionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        <Card style={styles.cryptoCard}>
          <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>ATIVOS CRIPTO</Text>
          <Text style={styles.highlightTitle}>Compre os principais ativos cripto sem complicação.</Text>
          <Text style={styles.highlightText}>
            Bitcoin, Ethereum e Ouro Digital usando seu saldo em USDC.
          </Text>
          <PrimaryButton title="Ver ativos" onPress={() => setPage('assets')} secondary />
        </Card>

        <View style={styles.homeSecondaryRow}>
          <TouchableOpacity
            style={styles.homeSecondaryCard}
            onPress={() => router.push('/(app)/rewards' as any)}
          >
            <Text style={[styles.homeSecondaryKicker, isPremium ? styles.premiumAccentText : null]}>REWARDS</Text>
            <Text style={styles.homeSecondaryTitle}>Turbinar USDC</Text>
            <Text style={styles.homeSecondaryText}>
              Separe USDC para participar do Rewards.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.homeSecondaryCard,
              isPremium ? styles.homePremiumCardActive : null,
            ]}
            onPress={() => setPage('premium')}
          >
            <Text style={isPremium ? styles.homePremiumKicker : styles.homeSecondaryKicker}>
              PREMIUM
            </Text>
            <Text style={styles.homeSecondaryTitle}>
              {isPremium ? 'Premium ativo' : 'Conhecer Premium'}
            </Text>
            <Text style={styles.homeSecondaryText}>
              Benefícios extras por R$ 19,90/mês em USDC.
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.homeWideCard,
            isPremium ? styles.premiumSurface : null,
          ]}
          onPress={openUsdcSubscription}
        >
          <Text style={[styles.homeSecondaryKicker, isPremium ? styles.premiumAccentText : null]}>
            OPEN FINANCE
          </Text>
          <Text style={styles.homeSecondaryTitle}>USDC por assinatura</Text>
          <Text style={styles.homeSecondaryText}>
            Autorize no seu banco e receba USDC automaticamente todo mês.
          </Text>
        </TouchableOpacity>
      </>
    );
  }

  function Wallet() {
    const walletReady =
      walletFirst?.portfolio?.walletReady === true || Boolean(walletAddress);

    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>CRIPTO WALLET</Text>
        <Text style={styles.pageTitle}>Carteira</Text>
        <Text style={styles.pageSubtitle}>
          Seus ativos ficam vinculados à sua própria carteira. A Nexa simplifica a experiência sem custodiar sua chave.
        </Text>

        <Card style={styles.heroCard}>
          <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>SALDO DISPONÍVEL</Text>
          <Text style={styles.heroAmount}>{amount(balances.USDC, 6)} USDC</Text>
          <Text style={styles.highlightText}>
            {walletReady
              ? 'Carteira conectada e pronta para movimentações.'
              : 'Sua carteira está sendo preparada.'}
          </Text>
          {walletAddress ? (
            <Text style={[styles.walletAddress, isPremium ? styles.premiumAccentText : null]}>
              {walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}
            </Text>
          ) : null}
        </Card>

        <View style={styles.quickRow}>
          <MenuTile icon="＋" title="Adicionar" subtitle="Pix → USDC" onPress={openWalletFirstDeposit} />
          <MenuTile icon="↓" title="Sacar" subtitle="USDC → Pix" onPress={openWalletFirstWithdraw} />
          <MenuTile icon="↑" title="Enviar" subtitle="Nexa → Nexa" onPress={openWalletFirstSend} />
          <MenuTile icon="◇" title="Comprar" subtitle="BTC · ETH · Ouro" onPress={openWalletFirstAssets} accent />
        </View>

        <Text style={styles.sectionTitle}>Posições</Text>
        {portfolioPositions.map((item) => (
          <Card key={item.symbol}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.assetRowTitle}>{item.icon} {item.name}</Text>
                <Text style={styles.assetRowSymbol}>{item.symbol}</Text>
              </View>
              <View style={styles.alignRight}>
                <Text style={styles.assetRowAmount}>{amount(item.amount, 8)}</Text>
                {item.valueUsd > 0 ? (
                  <Text style={styles.assetRowValue}>US$ {amount(item.valueUsd, 2)}</Text>
                ) : null}
              </View>
            </View>
          </Card>
        ))}

        <Card>
          <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>AUTONOMIA</Text>
          <Text style={styles.highlightTitle}>A carteira é sua.</Text>
          <Text style={styles.highlightText}>
            A Nexa prepara a infraestrutura necessária, mas autorizações sensíveis continuam sob seu controle.
          </Text>
          <PrimaryButton
            title="Segurança da carteira"
            onPress={() => router.push('/security')}
            secondary
          />
        </Card>
      </>
    );
  }

  function Assets() {
    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>ATIVOS CRIPTO</Text>
        <Text style={styles.pageTitle}>Ativos</Text>
        <Text style={styles.pageSubtitle}>
          Acompanhe suas posições e compre ativos usando o USDC da sua carteira.
        </Text>

        <View style={styles.assetGrid}>
          {portfolioPositions.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={styles.assetMini}
              onPress={() => {
                if (item.symbol === 'USDC') {
                  setPage('wallet');
                  return;
                }
                router.push({
                  pathname: '/(app)/buy-crypto',
                  params: { asset: item.symbol },
                } as any);
              }}
            >
              <Text style={[styles.assetIcon, isPremium ? styles.premiumAccentText : null]}>{item.icon}</Text>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetBalance}>{amount(item.amount, 8)}</Text>
              <Text style={styles.assetNameSmall}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.cryptoCard}>
          <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>COMPRAR</Text>
          <Text style={styles.highlightTitle}>USDC primeiro. Outros ativos depois.</Text>
          <Text style={styles.highlightText}>
            O dinheiro novo entra em USDC. A partir dele, você pode comprar Bitcoin, Ethereum ou Ouro Digital.
          </Text>
          <PrimaryButton title="Comprar ativos" onPress={openWalletFirstAssets} />
        </Card>

        <Card>
          <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>VOLTAR PARA REAIS</Text>
          <Text style={styles.highlightTitle}>Resgate simples por Pix.</Text>
          <Text style={styles.highlightText}>
            Quando quiser sair para reais, use seu saldo em USDC e solicite o resgate Pix.
          </Text>
          <PrimaryButton title="Sacar para Pix" onPress={openWalletFirstWithdraw} secondary />
        </Card>
      </>
    );
  }

  function Send() {
    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>TRANSFERÊNCIAS</Text>
        <Text style={styles.pageTitle}>Enviar</Text>
        <Text style={styles.pageSubtitle}>
          Envie USDC diretamente da sua carteira. A Nexa prepara a operação e você confirma.
        </Text>
        <Card style={styles.heroCard}>
          <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>TRANSFERÊNCIA SEGURA</Text>
          <Text style={styles.highlightTitle}>Envio direto, sem saldo interno.</Text>
          <Text style={styles.highlightText}>
            O valor sai da sua própria carteira e não de um saldo contábil mantido pela Nexa.
          </Text>
          <PrimaryButton title="Fazer uma transferência" onPress={openWalletFirstSend} />
        </Card>
        <Card>
          <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>NEXA ID</Text>
          <Text style={styles.highlightTitle}>Identidade continua simples.</Text>
          <Text style={styles.highlightText}>
            Seu @username e Nexa ID continuam disponíveis para identificação e relacionamento dentro do ecossistema.
          </Text>
          <PrimaryButton title="Ver meu Nexa ID" onPress={() => setPage('nexaId')} secondary />
        </Card>
      </>
    );
  }

  function Premium() {
    return (
      <>
        <Text style={isPremium ? styles.premiumKickerGold : styles.pageKicker}>
          NEXA PREMIUM
        </Text>
        <Text style={styles.pageTitle}>Premium</Text>
        <Text style={styles.pageSubtitle}>
          Benefícios adicionais para sua experiência Nexa.
        </Text>

        <Card style={isPremium ? styles.premiumCardActive : styles.highlightPremium}>
          <Text style={isPremium ? styles.premiumEyebrowGold : styles.premiumEyebrow}>
            {isPremium ? 'PREMIUM ATIVO' : 'ASSINATURA PREMIUM'}
          </Text>
          <Text style={styles.highlightTitle}>R$ 19,90 por mês.</Text>
          <Text style={styles.highlightText}>
            Cobrança equivalente em USDC, com vencimento no dia 10 de cada mês.
          </Text>
        </Card>

        <Card>
          <Text style={styles.benefit}>✓ Condições diferenciadas em recursos elegíveis</Text>
          <Text style={styles.benefit}>✓ Condições diferenciadas no Rewards</Text>
          <Text style={styles.benefit}>✓ Atendimento prioritário</Text>
          <Text style={styles.benefit}>✓ Benefícios Premium exibidos diretamente no app</Text>
          <PrimaryButton
            title="Entender o Premium"
            onPress={() => router.push('/premium-info' as any)}
            secondary
          />
        </Card>

        {!isPremium ? (
          <Card>
            <Text style={[styles.sectionKicker, isPremium ? styles.premiumAccentText : null]}>ASSINATURA</Text>
            <Text style={styles.highlightText}>
              A ativação da cobrança recorrente exige autorização da sua carteira. A Nexa não assina por você.
            </Text>
          </Card>
        ) : null}
      </>
    );
  }

  function Recurring() {
    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>OPEN FINANCE</Text>
        <Text style={styles.pageTitle}>USDC por assinatura</Text>
        <Text style={styles.pageSubtitle}>
          Escolha valor, banco e dia do mês. Você autoriza uma vez no seu banco e a Nexa envia o USDC para sua própria carteira a cada parcela confirmada.
        </Text>
        <Card style={styles.highlightRecurring}>
          <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>AUTORIZAÇÃO BANCÁRIA</Text>
          <Text style={styles.highlightTitle}>Configure uma vez.</Text>
          <Text style={styles.highlightText}>
            A Nexa nunca pede sua senha bancária. A recorrência só é criada depois da sua confirmação e autorização no banco via Open Finance.
          </Text>
          <PrimaryButton
            title="Configurar USDC por assinatura"
            onPress={openUsdcSubscription}
            disabled={loading}
          />
        </Card>
      </>
    );
  }

  function Rewards() {
    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>REWARDS</Text>
        <Text style={styles.pageTitle}>Nexa Rewards</Text>
        <Text style={styles.pageSubtitle}>
          O Rewards agora usa sua própria carteira. Nenhum saldo interno legado é necessário.
        </Text>
        <Card>
          <Text style={styles.highlightTitle}>Rewards Wallet‑First</Text>
          <Text style={styles.highlightText}>
            Separe uma parte do seu USDC. O valor fica bloqueado enquanto participa e a Nexa cuida das etapas técnicas.
          </Text>
          <PrimaryButton
            title="Abrir Rewards"
            onPress={() => router.push('/(app)/rewards' as any)}
          />
          <PrimaryButton
            title="Como funciona"
            onPress={() => router.push('/rewards-info' as any)}
            secondary
          />
        </Card>
      </>
    );
  }

  function Menu() {
    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>CONTA & SERVIÇOS</Text>
        <Text style={styles.pageTitle}>Menu</Text>
        <Text style={styles.pageSubtitle}>Sua conta, ativos, atendimento e segurança.</Text>

        <Text style={styles.menuSectionLabel}>CONTA</Text>
        <View style={styles.menuGrid}>
          <MenuTile icon="◎" title="Perfil" subtitle={handle || 'Dados pessoais'} onPress={() => setPage('profile')} />
          <MenuTile icon="↕" title="Movimentações" subtitle="Histórico" onPress={() => setPage('history')} />
          <MenuTile icon="ID" title="Nexa ID" subtitle={nexaId || handle} onPress={() => setPage('nexaId')} />
          <MenuTile icon="◈" title="Carteira" subtitle="Ativos e carteira" onPress={() => setPage('wallet')} />
        </View>

        <Text style={styles.menuSectionLabel}>MOVIMENTAR</Text>
        <View style={styles.menuGrid}>
          <MenuTile icon="＋" title="Adicionar" subtitle="Pix → USDC" onPress={openWalletFirstDeposit} />
          <MenuTile icon="↓" title="Sacar" subtitle="USDC → Pix" onPress={openWalletFirstWithdraw} />
          <MenuTile icon="↑" title="Enviar" subtitle="Nexa → Nexa" onPress={openWalletFirstSend} />
          <MenuTile icon="◇" title="Comprar" subtitle="BTC · ETH · Ouro" onPress={openWalletFirstAssets} accent />
          {config.efiOpenFinanceEnabled ? (
            <MenuTile
              icon="↙"
              title="Trazer dinheiro"
              subtitle="Open Finance → USDC"
              onPress={() => router.push('/open-finance')}
            />
          ) : null}
        </View>

        <Text style={styles.menuSectionLabel}>SERVIÇOS</Text>
        <View style={styles.menuGrid}>
          <MenuTile
            icon="★"
            title="Premium"
            subtitle={isPremium ? 'Ativo' : 'R$ 19,90/mês'}
            onPress={() => setPage('premium')}
            premium={isPremium}
          />
          <MenuTile
            icon="↻"
            title="USDC por assinatura"
            subtitle="Open Finance • mensal"
            onPress={openUsdcSubscription}
          />
          <MenuTile
            icon="✦"
            title="Rewards"
            subtitle="Turbinar USDC"
            onPress={() => router.push('/(app)/rewards' as any)}
          />
          <MenuTile icon="⌁" title="Segurança" subtitle="Biometria e proteção" onPress={() => router.push('/security')} />
        </View>

        <Text style={styles.menuSectionLabel}>ATENDIMENTO</Text>
        <View style={styles.menuGrid}>
          {config.assistantEnabled ? (
            <MenuTile
              icon="✦"
              title="Assistente Nexa"
              subtitle="IA para o dia a dia"
              onPress={() => router.push('/assistant')}
              accent
            />
          ) : null}
          <MenuTile
            icon="◉"
            title="Fale com a Nexa"
            subtitle="Atendimento no WhatsApp"
            onPress={openNexaSupport}
            accent
          />
        </View>

        <PrimaryButton title="Sair da Nexa" onPress={onLogout} secondary />
      </>
    );
  }

  function DepositPix() {
    return (
      <>
        <Text style={styles.pageTitle}>Depositar via Pix</Text>
        <Text style={styles.pageSubtitle}>
          Gere uma cobrança Pix vinculada à sua conta Nexa. Após a confirmação, o crédito segue o fluxo operacional do backend.
        </Text>
        <Card>
          <Text style={styles.formLabel}>Valor em reais</Text>
          <TextInput
            style={[styles.input, isPremium ? styles.premiumBorder : null]}
            placeholder="R$ 100,00"
            placeholderTextColor="#64748b"
            value={depositAmountBrl}
            onChangeText={(value) => {
              setDepositAmountBrl(value);
              setDepositRequestId('');
              setDepositResult(null);
            }}
            keyboardType="decimal-pad"
          />
          <PrimaryButton
            title={config.financialExecutionEnabled ? 'Gerar Pix' : 'Geração de Pix bloqueada no preview'}
            onPress={createPixDeposit}
            disabled={!config.financialExecutionEnabled || loading}
          />
          {!config.financialExecutionEnabled ? (
            <Text style={[styles.previewNotice, isPremium ? styles.premiumAccentText : null]}>
              Preview seguro: esta tela está conectada ao contrato real, mas não cria cobrança Woovi.
            </Text>
          ) : null}
        </Card>
        {depositResult ? (
          <Card style={styles.highlightRecurring}>
            <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>PIX NEXA</Text>
            <Text style={styles.highlightTitle}>{money(depositResult.amountBrl || 0)}</Text>
            <Text style={styles.highlightText}>
              {String(
                depositResult.customerLabel ||
                  depositResult.label ||
                  depositResult.status ||
                  'Aguardando Pix',
              )}
            </Text>
            {depositResult.customerMessage || depositResult.message ? (
              <Text style={[styles.previewNotice, isPremium ? styles.premiumAccentText : null]}>
                {String(depositResult.customerMessage || depositResult.message)}
              </Text>
            ) : null}
            {Number(depositResult.quotedUsdc || 0) > 0 ? (
              <Text style={styles.highlightText}>
                USDC estimado: {amount(Number(depositResult.quotedUsdc || 0), 8)}
              </Text>
            ) : null}
            {depositResult.copyPasteCode ? (
              <>
                <View style={styles.qrWrap}>
                  <QRCode value={String(depositResult.copyPasteCode)} size={190} />
                </View>
                <Text style={styles.codeText}>{String(depositResult.copyPasteCode)}</Text>
              </>
            ) : null}
            <PrimaryButton title="Atualizar status" onPress={refreshPixDeposit} secondary disabled={loading} />
          </Card>
        ) : null}
      </>
    );
  }

  function WithdrawPix() {
    return (
      <>
        <Text style={styles.pageTitle}>Sacar via Pix</Text>
        <Text style={styles.pageSubtitle}>
          Converta USDC do Saldo Nexa para BRL e solicite o Pix. A cotação pode ser consultada no preview sem executar a saída.
        </Text>
        <Card>
          <Text style={styles.formLabel}>Valor em USDC</Text>
          <TextInput
            style={[styles.input, isPremium ? styles.premiumBorder : null]}
            placeholder="USDC"
            placeholderTextColor="#64748b"
            value={withdrawAmountUsdc}
            onChangeText={(value) => {
              setWithdrawAmountUsdc(value);
              setWithdrawQuote(null);
              setPixOutRequestId('');
            }}
            keyboardType="decimal-pad"
          />
          <PrimaryButton title="Ver cotação Pix" onPress={quotePixWithdrawal} disabled={loading} />
          {withdrawQuote ? (
            <View style={[styles.quoteBox, isPremium ? styles.premiumBorder : null]}>
              <Text style={styles.quoteTitle}>Cotação Nexa</Text>
              <Text style={styles.quoteText}>USDC: {amount(withdrawQuote.amountUsdc, 8)}</Text>
              <Text style={styles.quoteText}>Pix estimado: {money(withdrawQuote.netBrl || 0)}</Text>
              <Text style={styles.quoteText}>
                Taxas e proteção de liquidez já consideradas conforme a cotação apresentada.
              </Text>
              <Text style={styles.formLabel}>Chave Pix</Text>
              <TextInput
                style={[styles.input, isPremium ? styles.premiumBorder : null]}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                placeholderTextColor="#64748b"
                value={withdrawPixKey}
                onChangeText={setWithdrawPixKey}
                autoCapitalize="none"
              />
              <PrimaryButton
                title={config.financialExecutionEnabled ? 'Solicitar Pix' : 'Solicitação bloqueada no preview'}
                onPress={requestPixWithdrawal}
                disabled={!config.financialExecutionEnabled || loading}
              />
            </View>
          ) : null}
          {!config.financialExecutionEnabled ? (
            <Text style={[styles.previewNotice, isPremium ? styles.premiumAccentText : null]}>
              Preview seguro: consultar cotação está liberado; reservar USDC e solicitar Pix permanece bloqueado.
            </Text>
          ) : null}
        </Card>
      </>
    );
  }

  function NexaId() {
    return (
      <>
        <Text style={styles.pageTitle}>Meu Nexa ID</Text>
        <Text style={styles.pageSubtitle}>Sua identidade Nexa para identificação e experiências integradas do ecossistema.</Text>
        <Card style={styles.highlightPremium}>
          <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>NEXA ID</Text>
          <Text style={styles.highlightTitle}>{nexaId || 'Nexa ID em criação'}</Text>
          <Text style={styles.highlightText}>{handle || 'Username ainda não definido'}</Text>
          {nexaPassportQrValue ? (
            <View style={styles.qrWrap}>
              <QRCode value={nexaPassportQrValue} size={210} />
            </View>
          ) : (
            <Text style={[styles.previewNotice, isPremium ? styles.premiumAccentText : null]}>O QR Code aparecerá assim que seu Nexa ID estiver disponível.</Text>
          )}
          <Text style={styles.profileLine}>Nome: {user?.fullName || '-'}</Text>
          <Text style={styles.profileLine}>KYC: {String(user?.kycStatus || 'pending')}</Text>
          {walletAddress ? (
            <Text style={styles.profileLine}>Carteira: {walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</Text>
          ) : null}
        </Card>
      </>
    );
  }

  function Profile() {
    return (
      <>
        <Text style={[styles.pageKicker, isPremium ? styles.premiumAccentText : null]}>CLIENTE NEXA</Text>
        <Text style={styles.pageTitle}>Perfil</Text>
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.profileAvatar,
                isPremium ? styles.profileAvatarPremium : null,
              ]}
            >
              <Text
                style={[
                  styles.profileAvatarText,
                  isPremium ? styles.premiumAccentText : null,
                ]}
              >
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.fullName}</Text>
              <Text style={styles.profileHandle}>{handle || 'Conta Nexa'}</Text>
            </View>
          </View>
          <View style={styles.profileDivider} />
          <Text style={styles.profileLabel}>E-mail</Text>
          <Text style={styles.profileValue}>{user?.email || '-'}</Text>
          <Text style={styles.profileLabel}>Identidade</Text>
          <Text style={styles.profileValue}>
            {String(user?.kycStatus || 'pending').toLowerCase() === 'approved' ? 'Verificada' : 'Em análise'}
          </Text>
          <Text style={styles.profileLabel}>Relacionamento</Text>
          <Text style={styles.profileValue}>{isPremium ? 'Nexa Premium' : 'Nexa'}</Text>
          <Text style={styles.profileLabel}>Pix para resgates</Text>
          <Text style={styles.profileValue}>
            {user?.pixWithdrawEnabled && user?.pixKey
              ? `${String(user?.pixKeyType || 'PIX').toUpperCase()} • ${maskPixKey(
                  user?.pixKey,
                  user?.pixKeyType,
                )}`
              : 'Não configurado'}
          </Text>
          <Text style={styles.profileLabel}>Conta de resgate</Text>
          <Text style={styles.profileValue}>
            {payoutSubaccount?.active === true
              ? 'Pronta'
              : user?.pixWithdrawEnabled
                ? 'Em preparação'
                : 'Não configurada'}
          </Text>
          {walletAddress ? (
            <>
              <Text style={styles.profileLabel}>Carteira vinculada</Text>
              <Text style={styles.profileValue}>{walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</Text>
            </>
          ) : null}
        </Card>
        <Card style={styles.profileSupportCard}>
          <Text style={[styles.staffEyebrow, isPremium ? styles.premiumAccentText : null]}>ATENDIMENTO</Text>
          <Text style={styles.highlightTitle}>Precisa de ajuda?</Text>
          <Text style={styles.highlightText}>Fale com a Nexa pelo WhatsApp ou peça ajuda ao seu Assistente.</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.staffPrimaryAction} onPress={openNexaSupport}>
              <Text style={styles.staffPrimaryActionText}>WhatsApp</Text>
            </TouchableOpacity>
            {config.assistantEnabled ? (
              <TouchableOpacity style={styles.staffSecondaryAction} onPress={() => router.push('/assistant')}>
                <Text style={styles.staffSecondaryActionText}>Assistente Nexa</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
      </>
    );
  }

  function History() {
    return (
      <>
        <Text style={styles.pageTitle}>Movimentações</Text>
        <Text style={styles.pageSubtitle}>Registros do seu saldo e dos seus ativos.</Text>
        {statement.length ? statement.map((item: any) => (
          <Card key={item.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.assetRowTitle}>{item.description || 'Movimentação'}</Text>
                <Text style={styles.assetRowSymbol}>{item.asset || ''}</Text>
              </View>
              <Text style={item.direction === 'credit' ? styles.credit : styles.debit}>
                {item.direction === 'credit' ? '+' : '-'}{amount(item.amount, 8)} {item.asset}
              </Text>
            </View>
          </Card>
        )) : <Card><Text style={styles.highlightText}>Nenhuma movimentação encontrada.</Text></Card>}
      </>
    );
  }

  let body: React.ReactNode = null;
  if (page === 'home') body = <Home />;
  else if (page === 'wallet') body = <Wallet />;
  else if (page === 'assets') body = <Assets />;
  else if (page === 'send') body = <Send />;
  else if (page === 'menu') body = <Menu />;
  else if (page === 'premium') body = <Premium />;
  else if (page === 'recurring') body = <Recurring />;
  else if (page === 'rewards') body = <Rewards />;
  else if (page === 'deposit') body = <DepositPix />;
  else if (page === 'withdraw') body = <WithdrawPix />;
  else if (page === 'nexaId') body = <NexaId />;
  else if (page === 'profile') body = <Profile />;
  else if (page === 'history') body = <History />;
  else if (page === 'custody') {
    body = canAccessCustody ? (
      <CustodyScreen
        user={user}
        token={token}
        apiUrl={API}
        financialExecutionEnabled={config.financialExecutionEnabled}
        onBack={() => setPage('wallet')}
        onBalanceRefresh={loadAll}
        onSendExternalUsdc={sendExternalPrivyUsdc}
        clientHeaders={clientHeaders}
        privyWalletReady={Boolean(
          embeddedWallet?.address &&
            (!walletAddress ||
              String(embeddedWallet.address).toLowerCase() ===
                String(walletAddress).toLowerCase()),
        )}
      />
    ) : (
      <Premium />
    );
  }

  return (
    <PremiumThemeContext.Provider value={isPremium}>
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 18) + 10, paddingBottom: contentBottom }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadAll}
            tintColor={isPremium ? '#D8BC7A' : '#60a5fa'}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>NEXA</Text>
            <Text style={styles.brandTag}>Cripto sem complicação.</Text>
          </View>
          {isPremium ? <Text style={styles.brandEditionPremium}>PREMIUM</Text> : null}
        </View>
        {message ? (
          <TouchableOpacity onPress={() => setMessage('')} style={[styles.messageBox, isPremium ? styles.premiumBorder : null]}>
            <Text style={styles.messageText}>{message}</Text>
          </TouchableOpacity>
        ) : null}
        {loading && !body ? <ActivityIndicator color="#60a5fa" /> : body}
      </ScrollView>
      <BottomNav page={page} onNavigate={setPage} premium={isPremium} />
    </View>
    </PremiumThemeContext.Provider>
  );
}

const styles: any = {
  root: { flex: 1, backgroundColor: '#070A0F' },
  scroll: { flex: 1, paddingHorizontal: 18 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 26,
    paddingHorizontal: 2,
  },
  brand: { color: '#F7F8FA', fontSize: 27, fontWeight: '900', letterSpacing: 3.2 },
  brandTag: { color: '#7F8A9B', fontSize: 11, marginTop: 3 },
  brandEditionPremium: { color: '#D8BC7A', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  homeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  welcomeLabel: { color: '#8B5CF6', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  hello: { color: '#F7F8FA', fontSize: 28, fontWeight: '800' },
  handle: { color: '#8F9AAC', fontSize: 12, fontWeight: '700', marginTop: 4 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#111722',
    borderWidth: 1, borderColor: '#2B3442', alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { color: '#C4B5FD', fontSize: 18, fontWeight: '900' },
  avatarPremium: { backgroundColor: '#17140D', borderColor: '#8A6B2D' },
  avatarTextPremium: { color: '#D8BC7A' },
  premiumAccentText: { color: '#D8BC7A' },
  card: {
    backgroundColor: '#0C1119', borderWidth: 1, borderColor: '#1B2432',
    borderRadius: 20, padding: 18, marginBottom: 14
  },
  cardPremiumTheme: {
    backgroundColor: '#0F100D',
    borderColor: '#8A6B2D',
  },
  premiumSurface: {
    backgroundColor: '#0F100D',
    borderColor: '#8A6B2D',
  },
  premiumBorder: { borderColor: '#8A6B2D' },
  heroCard: { backgroundColor: '#0D1522', borderColor: '#4C1D95', padding: 20 },
  heroCardPremium: { backgroundColor: '#15130E', borderColor: '#8A6B2D' },
  heroMark: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#171D27',
    borderWidth: 1, borderColor: '#5B21B6', alignItems: 'center', justifyContent: 'center'
  },
  heroMarkText: { color: '#A78BFA', fontSize: 20, fontWeight: '900' },
  heroMarkPremium: { backgroundColor: '#1B1810', borderColor: '#A88432' },
  eyebrow: { color: '#8B5CF6', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  premiumEyebrow: { color: '#A78BFA', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroAmount: { color: '#F7F8FA', fontSize: 40, fontWeight: '800', marginTop: 8 },
  heroUnit: { color: '#A3ADBA', fontSize: 13, fontWeight: '700', marginTop: 1 },
  portfolioValue: { color: '#A78BFA', fontSize: 12, fontWeight: '800', marginTop: 16 },
  portfolioValuePremium: { color: '#D8BC7A' },
  heroHint: { color: '#7F8A9B', lineHeight: 18, marginTop: 9, fontSize: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  menuTile: {
    width: '48%', minHeight: 100, backgroundColor: '#0C1119', borderWidth: 1,
    borderColor: '#1B2432', borderRadius: 18, padding: 15
  },
  menuTileAccent: { backgroundColor: '#111720', borderColor: '#5B21B6' },
  menuTilePremium: { backgroundColor: '#15130E', borderColor: '#8A6B2D' },
  menuTileIconPremium: { color: '#D8BC7A' },
  menuTileIcon: { color: '#A78BFA', fontSize: 18, marginBottom: 12, fontWeight: '900' },
  menuTileTitle: { color: '#F3F5F7', fontSize: 14, fontWeight: '800' },
  menuTileSubtitle: { color: '#788393', fontSize: 10, marginTop: 5 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 },
  menuSectionLabel: { color: '#778292', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 9, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionKicker: { color: '#7D8795', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 4 },
  sectionTitle: { color: '#F7F8FA', fontSize: 21, fontWeight: '800', marginBottom: 12, marginTop: 2 },
  inlineAction: { color: '#8B5CF6', fontSize: 11, fontWeight: '800', marginBottom: 12 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 18 },
  assetMini: {
    width: '48%', backgroundColor: '#0C1119', borderWidth: 1, borderColor: '#1B2432',
    borderRadius: 18, padding: 15, minHeight: 112
  },
  assetSelected: { borderColor: '#6D28D9', backgroundColor: '#121821' },
  assetIcon: { color: '#A78BFA', fontSize: 21, marginBottom: 8 },
  assetSymbol: { color: '#F7F8FA', fontSize: 15, fontWeight: '900' },
  assetBalance: { color: '#9AA4B2', fontSize: 12, marginTop: 6 },
  assetNameSmall: { color: '#6E7887', fontSize: 10, marginTop: 5 },
  staffCard: { backgroundColor: '#11151C', borderColor: '#5B21B6' },
  staffEyebrow: { color: '#A78BFA', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  staffOrb: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1B1A17',
    borderWidth: 1, borderColor: '#6D28D9', alignItems: 'center', justifyContent: 'center'
  },
  staffOrbText: { color: '#C4B5FD', fontSize: 22, fontWeight: '900' },
  staffPrimaryAction: {
    flex: 1, backgroundColor: '#8B5CF6', borderRadius: 13, paddingVertical: 12,
    paddingHorizontal: 12, alignItems: 'center'
  },
  staffPrimaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  staffPrimaryActionPremium: {
    backgroundColor: '#8A6B2D',
    borderWidth: 1,
    borderColor: '#D8BC7A',
  },
  staffSecondaryAction: {
    flex: 1, backgroundColor: '#121821', borderWidth: 1, borderColor: '#2B3442',
    borderRadius: 13, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center'
  },
  staffSecondaryActionText: { color: '#E5E9EF', fontSize: 12, fontWeight: '800' },
  cryptoCard: { backgroundColor: '#0D131D', borderColor: '#3B2A66' },
  homeSecondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  homeSecondaryCard: {
    flex: 1, minHeight: 126, backgroundColor: '#0C1119', borderWidth: 1,
    borderColor: '#1B2432', borderRadius: 18, padding: 15
  },
  homeSecondaryKicker: { color: '#8B5CF6', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  homeSecondaryTitle: { color: '#F3F5F7', fontSize: 15, fontWeight: '800', marginTop: 8 },
  homeSecondaryText: { color: '#788393', fontSize: 11, lineHeight: 16, marginTop: 6 },
  homeWideCard: {
    backgroundColor: '#0C1119', borderWidth: 1, borderColor: '#1B2432',
    borderRadius: 18, padding: 15, minHeight: 94, marginBottom: 6
  },
  homePremiumCardActive: { borderColor: '#8A6B2D', backgroundColor: '#15130E' },
  homePremiumKicker: { color: '#D8BC7A', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  highlightPremium: { backgroundColor: '#11151C', borderColor: '#5B21B6' },
  premiumCardActive: { backgroundColor: '#15130E', borderColor: '#8A6B2D' },
  premiumKickerGold: { color: '#D8BC7A', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  premiumEyebrowGold: { color: '#D8BC7A', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  highlightRecurring: { backgroundColor: '#0D1522', borderColor: '#273A54' },
  highlightTitle: { color: '#F7F8FA', fontSize: 20, fontWeight: '800', marginTop: 7 },
  highlightText: { color: '#929CAA', lineHeight: 19, fontSize: 13, marginTop: 7 },
  button: {
    backgroundColor: '#8B5CF6', borderWidth: 1, borderColor: '#A78BFA',
    borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14
  },
  buttonSecondary: { backgroundColor: '#111720', borderColor: '#293548' },
  buttonPremium: { backgroundColor: '#8A6B2D', borderColor: '#D8BC7A' },
  buttonSecondaryPremium: { backgroundColor: '#15130E', borderColor: '#8A6B2D' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  buttonTextSecondary: { color: '#F2F4F7' },
  pageKicker: { color: '#8B5CF6', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  pageTitle: { color: '#F7F8FA', fontSize: 29, fontWeight: '800', marginBottom: 5 },
  pageSubtitle: { color: '#8F99A8', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alignRight: { alignItems: 'flex-end' },
  assetRowTitle: { color: '#F4F6F8', fontSize: 16, fontWeight: '800' },
  assetRowSymbol: { color: '#717B89', fontSize: 11, marginTop: 4 },
  assetRowAmount: { color: '#F7F8FA', fontSize: 16, fontWeight: '800' },
  assetRowValue: { color: '#939DAC', fontSize: 11, marginTop: 4 },
  walletAddress: { color: '#8B5CF6', fontSize: 11, marginTop: 12, fontWeight: '700' },
  formLabel: { color: '#C5CBD4', fontWeight: '800', fontSize: 12, marginTop: 14, marginBottom: 7 },
  input: {
    backgroundColor: '#080D14', borderWidth: 1, borderColor: '#273141',
    color: '#F7F8FA', borderRadius: 13, padding: 14, fontSize: 15
  },
  quoteBox: { backgroundColor: '#080D14', borderWidth: 1, borderColor: '#273141', borderRadius: 16, padding: 14, marginTop: 12 },
  quoteTitle: { color: '#F7F8FA', fontWeight: '900', fontSize: 14 },
  quoteText: { color: '#929CAA', fontSize: 12, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#1B2432', marginVertical: 18 },
  qrWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 16, marginBottom: 10 },
  codeText: { color: '#929CAA', fontSize: 10, lineHeight: 15, marginTop: 6 },
  previewNotice: { color: '#A78BFA', fontSize: 11, lineHeight: 17, marginTop: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  smallAction: { flex: 1, backgroundColor: '#111720', borderWidth: 1, borderColor: '#293548', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  smallActionText: { color: '#E2E6EC', fontSize: 12, fontWeight: '900' },
  successText: { color: '#6FD0A3', fontWeight: '800', marginTop: 10, fontSize: 12 },
  benefit: { color: '#DEE3E9', lineHeight: 24, fontSize: 13, marginBottom: 5 },
  profileCard: { backgroundColor: '#0E141D', borderColor: '#273243' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#161B23',
    borderWidth: 1, borderColor: '#5B21B6', alignItems: 'center', justifyContent: 'center'
  },
  profileAvatarText: { color: '#C4B5FD', fontSize: 19, fontWeight: '900' },
  profileAvatarPremium: { backgroundColor: '#17140D', borderColor: '#8A6B2D' },
  profileName: { color: '#F7F8FA', fontSize: 21, fontWeight: '800' },
  profileHandle: { color: '#9AA4B2', fontSize: 12, marginTop: 3 },
  profileDivider: { height: 1, backgroundColor: '#202A38', marginVertical: 16 },
  profileLabel: { color: '#737E8D', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 10 },
  profileValue: { color: '#E7EBF0', fontSize: 13, fontWeight: '700', marginTop: 4 },
  profileLine: { color: '#929CAA', fontSize: 13, marginBottom: 8 },
  profileSupportCard: { backgroundColor: '#10141B', borderColor: '#4C1D95' },
  credit: { color: '#6FD0A3', fontWeight: '900', fontSize: 12 },
  debit: { color: '#E58992', fontWeight: '900', fontSize: 12 },
  messageBox: { backgroundColor: '#111720', borderWidth: 1, borderColor: '#293548', borderRadius: 13, padding: 12, marginBottom: 14 },
  messageText: { color: '#E2E6EC', fontSize: 12, lineHeight: 17 },
  bottomNav: {
    position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 70,
    backgroundColor: '#080C12', borderTopWidth: 1, borderTopColor: '#1D2633',
    flexDirection: 'row', paddingTop: 8, paddingHorizontal: 4
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 52, paddingVertical: 4 },
  bottomIcon: { color: '#616C7A', fontSize: 18, fontWeight: '900' },
  bottomLabel: { color: '#616C7A', fontSize: 10, fontWeight: '800', marginTop: 4 },
  bottomActive: { color: '#A78BFA' },
  bottomNavPremium: {
    borderTopColor: '#8A6B2D',
    backgroundColor: '#0A0A08',
  },
  bottomActivePremium: { color: '#D8BC7A' },
};