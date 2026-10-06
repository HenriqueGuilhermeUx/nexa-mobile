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
import * as Clipboard from 'expo-clipboard';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';

import { config } from '@/config';
import { nexaApi } from '@/lib/api';
import { BrandMark } from '@/components/ui';
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
  { symbol: 'USDC', name: 'USDC', icon: 'U', tone: '#218BFF', description: 'Stablecoin ligada ao valor do dólar.' },
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', tone: '#F59E0B', description: 'Bitcoin disponível dentro da Nexa.' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', tone: '#8FA9FF', description: 'Ethereum disponível dentro da Nexa.' },
  { symbol: 'PAXG', name: 'Ouro Digital', icon: 'Au', tone: '#D5E2EF', description: 'Ouro digital disponível na sua carteira Nexa.' },
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


function NexaIcon({
  name,
  color = '#A9BCD0',
  size = 22,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const common = {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  if (name === 'plus') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" {...common} />
        <Line x1="12" y1="8" x2="12" y2="16" {...common} />
        <Line x1="8" y1="12" x2="16" y2="12" {...common} />
      </Svg>
    );
  }
  if (name === 'swap') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M7 7h11l-3-3" {...common} />
        <Path d="M17 17H6l3 3" {...common} />
        <Path d="M18 7l-3 3M6 17l3-3" {...common} />
      </Svg>
    );
  }
  if (name === 'send') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 12l16-8-6 16-3-6-7-2z" {...common} />
        <Path d="M11 14l4-5" {...common} />
      </Svg>
    );
  }
  if (name === 'withdraw') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 4v11" {...common} />
        <Path d="M8 11l4 4 4-4" {...common} />
        <Path d="M5 20h14" {...common} />
      </Svg>
    );
  }
  if (name === 'receive') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 20V9" {...common} />
        <Path d="M8 13l4-4 4 4" {...common} />
        <Path d="M5 4h14" {...common} />
      </Svg>
    );
  }
  if (name === 'home') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 11l8-7 8 7v9h-6v-6h-4v6H4z" {...common} />
      </Svg>
    );
  }
  if (name === 'assets') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="4" y="6" width="16" height="13" rx="3" {...common} />
        <Path d="M8 6V4h8v2M15 12h5" {...common} />
      </Svg>
    );
  }
  if (name === 'move') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M7 8h10M14 5l3 3-3 3M17 16H7M10 13l-3 3 3 3" {...common} />
      </Svg>
    );
  }
  if (name === 'history') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M5 7V3M5 3H1M5 3a9 9 0 1 1-2 10" {...common} />
        <Path d="M12 7v5l3 2" {...common} />
      </Svg>
    );
  }
  if (name === 'profile') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="8" r="4" {...common} />
        <Path d="M5 21c.6-4.1 3-6 7-6s6.4 1.9 7 6" {...common} />
      </Svg>
    );
  }
  return <View style={{ width: size, height: size }} />;
}

function QuickAction({
  icon,
  title,
  onPress,
  primary = false,
}: {
  icon: string;
  title: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.quickAction}>
      <View style={[styles.quickActionIcon, primary ? styles.quickActionIconPrimary : null]}>
        <NexaIcon name={icon} color={primary ? '#06111F' : '#31D7FF'} size={22} />
      </View>
      <Text style={styles.quickActionLabel}>{title}</Text>
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


function BottomNav({ page, onNavigate }: any) {
  const insets = useSafeAreaInsets();
  const items = [
    ['home', 'home', 'Início'],
    ['assets', 'assets', 'Ativos'],
    ['move', 'move', 'Movimentar'],
    ['history', 'history', 'Histórico'],
    ['profile', 'profile', 'Perfil'],
  ];
  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map(([target, icon, label]) => {
        const active = page === target;
        const center = target === 'move';
        return (
          <TouchableOpacity
            key={target}
            style={styles.bottomItem}
            onPress={() => onNavigate(target)}
            activeOpacity={0.8}
          >
            <View
              style={[
                center ? styles.bottomCenterIcon : styles.bottomIconWrap,
                active && !center ? styles.bottomIconWrapActive : null,
              ]}
            >
              <NexaIcon
                name={icon}
                color={center ? '#06111F' : active ? '#31D7FF' : '#70879F'}
                size={center ? 23 : 21}
              />
            </View>
            <Text
              style={[
                styles.bottomLabel,
                active ? styles.bottomActive : null,
                center ? styles.bottomCenterLabel : null,
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

export default function AlignedLegacyApp({ initialUser, token, onLogout, initialPage = 'home' }: any) {
  const insets = useSafeAreaInsets();
  const privy = usePrivy() as any;
  const embedded = useEmbeddedEthereumWallet() as any;
  const wallets = (embedded.wallets || []) as any[];
  const embeddedWallet = useMemo(
    () => wallets.find((candidate) => /^0x[a-fA-F0-9]{40}$/.test(String(candidate?.address || ''))) || null,
    [wallets],
  );

  const [page, setPage] = useState(initialPage || 'home');
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
    const recent = statement.slice(0, 3);
    const totalLabel =
      portfolioTotalUsd > 0
        ? 'US$ ' + amount(portfolioTotalUsd, 2)
        : amount(balances.USDC, 2) + ' USDC';

    return (
      <>
        <View style={styles.homeTop}>
          <View>
            <Text style={styles.welcomeLabel}>NEXA WALLET</Text>
            <Text style={styles.hello}>Olá, {firstName}</Text>
            <Text style={styles.handle}>{handle || 'Sua wallet Nexa'}</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <View style={styles.heroLabelRow}>
                <Text style={styles.eyebrow}>VALOR DA CARTEIRA</Text>
                <Text style={styles.heroEye}>◉</Text>
              </View>
              <Text style={styles.heroAmount}>{totalLabel}</Text>
              <Text style={styles.heroUnit}>
                {portfolioTotalUsd > 0
                  ? amount(balances.USDC, 4) + ' USDC disponível'
                  : 'Saldo principal em USDC'}
              </Text>
            </View>
            {isPremium ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroHint}>
            Sua wallet individual, com a complexidade técnica ficando por trás da experiência.
          </Text>
        </Card>

        <View style={styles.quickActionsRow}>
          <QuickAction icon="plus" title="Adicionar" onPress={openWalletFirstDeposit} primary />
          <QuickAction icon="swap" title="Converter" onPress={openWalletFirstAssets} />
          <QuickAction icon="send" title="Enviar" onPress={openWalletFirstSend} />
          <QuickAction icon="withdraw" title="Sacar" onPress={openWalletFirstWithdraw} />
        </View>

        {config.assistantEnabled ? (
          <TouchableOpacity
            style={styles.assistantHomeCard}
            activeOpacity={0.84}
            onPress={() => router.push('/assistant' as any)}
          >
            <View style={styles.assistantHomeIcon}>
              <Text style={styles.assistantHomeIconText}>N</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assistantHomeKicker}>ASSISTENTE NEXA</Text>
              <Text style={styles.assistantHomeTitle}>Posso te ajudar?</Text>
              <Text style={styles.assistantHomeText}>
                Tire dúvidas, entenda seus ativos e encontre o que precisa.
              </Text>
            </View>
            <Text style={styles.assistantHomeArrow}>›</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>MINHA WALLET</Text>
            <Text style={styles.sectionTitle}>Meus ativos</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('assets')}>
            <Text style={styles.inlineAction}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.assetList}>
          {portfolioPositions.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={styles.assetListRow}
              activeOpacity={0.82}
              onPress={() => {
                if (item.symbol === 'USDC') setPage('wallet');
                else {
                  setAsset(item.symbol);
                  setPage('assets');
                }
              }}
            >
              <View style={[styles.assetTokenIcon, { borderColor: item.tone }]}>
                <Text style={[styles.assetTokenMark, { color: item.tone }]}>{item.icon}</Text>
              </View>
              <View style={styles.assetListIdentity}>
                <Text style={styles.assetListName}>{item.name}</Text>
                <Text style={styles.assetRowSymbol}>{item.symbol}</Text>
              </View>
              <View style={styles.alignRight}>
                <Text style={styles.assetListAmount}>
                  {amount(item.amount, item.symbol === 'USDC' ? 2 : 6)} {item.symbol}
                </Text>
                <Text style={styles.assetRowValue}>
                  {item.valueUsd > 0 ? 'US$ ' + amount(item.valueUsd, 2) : '—'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>ATIVIDADE</Text>
            <Text style={styles.sectionTitle}>Movimentações recentes</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('history')}>
            <Text style={styles.inlineAction}>Ver histórico</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.activityCard}>
          {recent.length ? (
            recent.map((item: any, index: number) => (
              <View
                key={item.id || String(item.description || 'movement') + '-' + index}
                style={[
                  styles.activityRow,
                  index === recent.length - 1 ? styles.activityRowLast : null,
                ]}
              >
                <View style={styles.activityIcon}>
                  <NexaIcon
                    name={item.direction === 'credit' ? 'receive' : 'send'}
                    color={item.direction === 'credit' ? '#35D69A' : '#31D7FF'}
                    size={18}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{item.description || 'Movimentação'}</Text>
                  <Text style={styles.activityDate}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : item.asset || 'Nexa'}
                  </Text>
                </View>
                <Text
                  style={
                    item.direction === 'credit'
                      ? styles.activityCredit
                      : styles.activityDebit
                  }
                >
                  {item.direction === 'credit' ? '+' : '-'}
                  {amount(item.amount, 6)} {item.asset || ''}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <NexaIcon name="history" color="#70879F" size={24} />
              </View>
              <Text style={styles.emptyStateTitle}>Sua wallet está pronta.</Text>
              <Text style={styles.emptyStateText}>
                Suas movimentações aparecerão aqui quando você começar a usar a Nexa.
              </Text>
            </View>
          )}
        </Card>
      </>
    );
  }

  function Wallet() {
    const walletReady =
      walletFirst?.portfolio?.walletReady === true || Boolean(walletAddress);

    async function copyWalletAddress() {
      if (!walletAddress) return;
      await Clipboard.setStringAsync(walletAddress);
      setMessage('Endereço da wallet copiado.');
    }

    return (
      <>
        <Text style={styles.pageKicker}>MINHA WALLET</Text>
        <Text style={styles.pageTitle}>Sua wallet, seu controle</Text>
        <Text style={styles.pageSubtitle}>
          Sua carteira é individual. A Nexa simplifica a experiência sem custodiar sua chave.
        </Text>

        <Card style={styles.heroCard}>
          <Text style={styles.eyebrow}>SALDO DISPONÍVEL</Text>
          <Text style={styles.heroAmount}>{amount(balances.USDC, 6)} USDC</Text>
          <Text style={styles.highlightText}>
            {walletReady
              ? 'Wallet conectada e pronta para as funcionalidades disponíveis.'
              : 'Sua wallet está sendo preparada.'}
          </Text>
        </Card>

        {walletAddress ? (
          <Card>
            <Text style={styles.sectionKicker}>RECEBER USDC</Text>
            <Text style={styles.highlightTitle}>Seu endereço da wallet</Text>
            <Text style={styles.highlightText}>
              Use este endereço para receber USDC diretamente na sua wallet.
            </Text>
            <View style={styles.walletQrWrap}>
              <QRCode value={walletAddress} size={186} />
            </View>
            <Text selectable style={styles.walletAddressFull}>{walletAddress}</Text>
            <Text style={styles.walletNetwork}>Rede compatível: Polygon</Text>
            <PrimaryButton title="Copiar endereço" onPress={copyWalletAddress} secondary />
          </Card>
        ) : null}

        <View style={styles.quickActionsRow}>
          <QuickAction icon="plus" title="Adicionar" onPress={openWalletFirstDeposit} primary />
          <QuickAction icon="swap" title="Converter" onPress={openWalletFirstAssets} />
          <QuickAction icon="send" title="Enviar" onPress={openWalletFirstSend} />
          <QuickAction icon="withdraw" title="Sacar" onPress={openWalletFirstWithdraw} />
        </View>

        <Text style={styles.sectionTitle}>Ativos na sua wallet</Text>
        <View style={styles.assetList}>
          {portfolioPositions.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={styles.assetListRow}
              onPress={() => {
                if (item.symbol === 'USDC') return;
                router.push({
                  pathname: '/(app)/buy-crypto',
                  params: { asset: item.symbol },
                } as any);
              }}
            >
              <View style={[styles.assetTokenIcon, { borderColor: item.tone }]}>
                <Text style={[styles.assetTokenMark, { color: item.tone }]}>{item.icon}</Text>
              </View>
              <View style={styles.assetListIdentity}>
                <Text style={styles.assetListName}>{item.name}</Text>
                <Text style={styles.assetRowSymbol}>{item.symbol}</Text>
              </View>
              <View style={styles.alignRight}>
                <Text style={styles.assetListAmount}>{amount(item.amount, 8)} {item.symbol}</Text>
                {item.valueUsd > 0 ? (
                  <Text style={styles.assetRowValue}>US$ {amount(item.valueUsd, 2)}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Card>
          <Text style={styles.sectionKicker}>AUTONOMIA</Text>
          <Text style={styles.highlightTitle}>A wallet é sua.</Text>
          <Text style={styles.highlightText}>
            Autorizações sensíveis continuam sob seu controle. A Nexa nunca pede sua chave privada ou frase-semente.
          </Text>
          <PrimaryButton
            title="Segurança"
            onPress={() => router.push('/security')}
            secondary
          />
          <PrimaryButton
            title="Opções avançadas da wallet"
            onPress={() => setPage('custody')}
            secondary
          />
        </Card>
      </>
    );
  }

  function Assets() {
    return (
      <>
        <Text style={styles.pageKicker}>ATIVOS</Text>
        <Text style={styles.pageTitle}>Seus ativos</Text>
        <Text style={styles.pageSubtitle}>
          Acompanhe o que está na sua wallet e use USDC para converter entre os ativos disponíveis.
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
          <Text style={styles.sectionKicker}>CONVERTER</Text>
          <Text style={styles.highlightTitle}>USDC primeiro. Outros ativos depois.</Text>
          <Text style={styles.highlightText}>
            O dinheiro novo entra em USDC. A partir dele, você pode converter para Bitcoin, Ethereum ou Ouro Digital quando disponíveis.
          </Text>
          <PrimaryButton title="Converter ativos" onPress={openWalletFirstAssets} />
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


  function Move() {
    return (
      <>
        <Text style={styles.pageKicker}>MOVIMENTAR</Text>
        <Text style={styles.pageTitle}>O que você quer fazer?</Text>
        <Text style={styles.pageSubtitle}>
          Escolha uma ação. A Nexa mantém as etapas técnicas fora do caminho e mostra o que importa antes de você confirmar.
        </Text>

        <View style={styles.moveGrid}>
          <TouchableOpacity style={styles.moveCard} onPress={openWalletFirstDeposit} activeOpacity={0.82}>
            <View style={styles.moveIcon}><NexaIcon name="plus" color="#31D7FF" size={24} /></View>
            <Text style={styles.moveTitle}>Adicionar</Text>
            <Text style={styles.moveText}>Comece com Pix e receba USDC na sua wallet.</Text>
          </TouchableOpacity>
          {config.efiOpenFinanceEnabled ? (
            <TouchableOpacity style={styles.moveCard} onPress={openUsdcSubscription} activeOpacity={0.82}>
              <View style={styles.moveIcon}><NexaIcon name="receive" color="#31D7FF" size={24} /></View>
              <Text style={styles.moveTitle}>Adicionar automaticamente</Text>
              <Text style={styles.moveText}>Programe um valor mensal via Open Finance.</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.moveCard} onPress={openWalletFirstAssets} activeOpacity={0.82}>
            <View style={styles.moveIcon}><NexaIcon name="swap" color="#31D7FF" size={24} /></View>
            <Text style={styles.moveTitle}>Converter</Text>
            <Text style={styles.moveText}>Use USDC para acessar ativos disponíveis na Nexa.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moveCard} onPress={openWalletFirstSend} activeOpacity={0.82}>
            <View style={styles.moveIcon}><NexaIcon name="send" color="#31D7FF" size={24} /></View>
            <Text style={styles.moveTitle}>Enviar</Text>
            <Text style={styles.moveText}>Envie a partir da sua própria wallet.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moveCard} onPress={() => setPage('wallet')} activeOpacity={0.82}>
            <View style={styles.moveIcon}><NexaIcon name="receive" color="#31D7FF" size={24} /></View>
            <Text style={styles.moveTitle}>Receber</Text>
            <Text style={styles.moveText}>Veja endereço e informações da sua wallet.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.moveCard, styles.moveCardWide]} onPress={openWalletFirstWithdraw} activeOpacity={0.82}>
            <View style={styles.moveIcon}><NexaIcon name="withdraw" color="#31D7FF" size={24} /></View>
            <Text style={styles.moveTitle}>Sacar</Text>
            <Text style={styles.moveText}>Solicite o resgate de USDC para o Pix configurado.</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.pageTitle}>Adicionar automaticamente</Text>
        <Text style={styles.pageSubtitle}>
          Escolha um valor e um dia do mês. Você autoriza uma vez no seu banco via Open Finance e a Nexa atualiza sua wallet em USDC a cada parcela confirmada.
        </Text>
        <Card style={styles.highlightRecurring}>
          <Text style={[styles.eyebrow, isPremium ? styles.premiumAccentText : null]}>AUTORIZAÇÃO BANCÁRIA</Text>
          <Text style={styles.highlightTitle}>Configure uma vez.</Text>
          <Text style={styles.highlightText}>
            A Nexa nunca pede sua senha bancária. A recorrência só é criada depois da sua confirmação e autorização no banco via Open Finance.
          </Text>
          <PrimaryButton
            title="Configurar recorrência"
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
        <Text style={styles.sectionKicker}>CONTA E PREFERÊNCIAS</Text>
        <View style={styles.profileMenu}>
          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setPage('wallet')}>
            <View>
              <Text style={styles.profileMenuTitle}>Minha Wallet</Text>
              <Text style={styles.profileMenuText}>Endereço, receber e autonomia</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileMenuRow} onPress={() => router.push('/security')}>
            <View>
              <Text style={styles.profileMenuTitle}>Segurança</Text>
              <Text style={styles.profileMenuText}>Biometria e proteção do aparelho</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setPage('nexaId')}>
            <View>
              <Text style={styles.profileMenuTitle}>Nexa ID</Text>
              <Text style={styles.profileMenuText}>Sua identidade no ecossistema</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileMenuRow} onPress={() => setPage('premium')}>
            <View>
              <Text style={styles.profileMenuTitle}>Premium</Text>
              <Text style={styles.profileMenuText}>{isPremium ? 'Plano ativo' : 'Conhecer benefícios'}</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
          {config.efiOpenFinanceEnabled ? (
            <TouchableOpacity style={styles.profileMenuRow} onPress={openUsdcSubscription}>
              <View>
                <Text style={styles.profileMenuTitle}>Adicionar automaticamente</Text>
                <Text style={styles.profileMenuText}>Open Finance · recorrência mensal</Text>
              </View>
              <Text style={styles.profileMenuArrow}>›</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.profileMenuRow} onPress={openNexaSupport}>
            <View>
              <Text style={styles.profileMenuTitle}>Ajuda</Text>
              <Text style={styles.profileMenuText}>Falar com a equipe Nexa</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.profileMenuRow, styles.profileMenuRowLast]}
            onPress={() => Linking.openURL('https://trynexa.com.br/termos')}
          >
            <View>
              <Text style={styles.profileMenuTitle}>Termos e privacidade</Text>
              <Text style={styles.profileMenuText}>Documentos e políticas da Nexa</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.profileSupportCard}>
          <Text style={[styles.staffEyebrow, isPremium ? styles.premiumAccentText : null]}>ATENDIMENTO</Text>
          <Text style={styles.highlightTitle}>Precisa de ajuda?</Text>
          <Text style={styles.highlightText}>Fale com a Nexa pelo WhatsApp ou peça ajuda ao seu Assistente.</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.staffPrimaryAction,
                isPremium ? styles.staffPrimaryActionPremium : null,
              ]}
              onPress={openNexaSupport}
            >
              <Text style={styles.staffPrimaryActionText}>WhatsApp</Text>
            </TouchableOpacity>
            {config.assistantEnabled ? (
              <TouchableOpacity
                style={[
                  styles.staffSecondaryAction,
                  isPremium ? styles.premiumBorder : null,
                ]}
                onPress={() => router.push('/assistant')}
              >
                <Text style={styles.staffSecondaryActionText}>Assistente Nexa</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
      </>
    );
  }

  function History() {
    const items = statement.slice(0, 40);

    return (
      <>
        <Text style={styles.pageKicker}>HISTÓRICO</Text>
        <Text style={styles.pageTitle}>Histórico</Text>
        <Text style={styles.pageSubtitle}>
          Entradas e saídas da sua wallet organizadas de forma simples.
        </Text>

        {items.length ? (
          <View style={styles.historySimpleList}>
            {items.map((item: any, index: number) => (
              <View
                key={item.id || String(item.description || 'movement') + '-' + index}
                style={[
                  styles.historySimpleRow,
                  index === items.length - 1 ? styles.historySimpleRowLast : null,
                ]}
              >
                <View style={styles.historySimpleIcon}>
                  <NexaIcon
                    name={item.direction === 'credit' ? 'receive' : 'send'}
                    color={item.direction === 'credit' ? '#35D69A' : '#31D7FF'}
                    size={18}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historySimpleTitle}>
                    {item.description || (item.direction === 'credit' ? 'Entrada' : 'Saída')}
                  </Text>
                  <Text style={styles.historySimpleDate}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : item.asset || 'Nexa'}
                  </Text>
                </View>
                <Text
                  style={
                    item.direction === 'credit'
                      ? styles.activityCredit
                      : styles.activityDebit
                  }
                >
                  {item.direction === 'credit' ? '+' : '-'}
                  {amount(item.amount, 8)} {item.asset || ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Card>
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <NexaIcon name="history" color="#70879F" size={24} />
              </View>
              <Text style={styles.emptyStateTitle}>Suas movimentações aparecerão aqui.</Text>
              <Text style={styles.emptyStateText}>
                Quando você adicionar, converter, enviar ou sacar, o histórico será organizado nesta tela.
              </Text>
            </View>
          </Card>
        )}

        <PrimaryButton
          title="Histórico detalhado"
          onPress={() => router.push('/(app)/activity' as any)}
          secondary
        />
      </>
    );
  }

  let body: React.ReactNode = null;
  if (page === 'home') body = <Home />;
  else if (page === 'wallet') body = <Wallet />;
  else if (page === 'assets') body = <Assets />;
  else if (page === 'send') body = <Send />;
  else if (page === 'move') body = <Move />;
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
            tintColor="#31D7FF"
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <BrandMark size={38} />
            <View>
              <Text style={styles.brand}>NEXA</Text>
              <Text style={styles.brandTag}>WALLET · Cripto sem complicação.</Text>
            </View>
          </View>
          {isPremium ? <Text style={styles.brandEditionPremium}>PREMIUM</Text> : null}
        </View>
        {message ? (
          <TouchableOpacity onPress={() => setMessage('')} style={[styles.messageBox, isPremium ? styles.premiumBorder : null]}>
            <Text style={styles.messageText}>{message}</Text>
          </TouchableOpacity>
        ) : null}
        {loading && !body ? <ActivityIndicator color="#31D7FF" /> : body}
      </ScrollView>
      <BottomNav page={page} onNavigate={setPage} premium={isPremium} />
    </View>
    </PremiumThemeContext.Provider>
  );
}

const styles: any = {
  root: { flex: 1, backgroundColor: '#06111F' },
  scroll: { flex: 1, paddingHorizontal: 18 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 26,
    paddingHorizontal: 2,
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: '#F4F8FC', fontSize: 21, fontWeight: '850', letterSpacing: 3.1 },
  brandTag: { color: '#70879F', fontSize: 11, marginTop: 3 },
  brandEditionPremium: { color: '#D5E2EF', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  homeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  welcomeLabel: { color: '#218BFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  hello: { color: '#F4F8FC', fontSize: 28, fontWeight: '800' },
  handle: { color: '#A9BCD0', fontSize: 12, fontWeight: '700', marginTop: 4 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#111722',
    borderWidth: 1, borderColor: '#284B68', alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { color: '#A9EAF4', fontSize: 18, fontWeight: '900' },
  avatarPremium: { backgroundColor: '#10263D', borderColor: '#315C78' },
  avatarTextPremium: { color: '#D5E2EF' },
  premiumAccentText: { color: '#D5E2EF' },
  card: {
    backgroundColor: '#0E2138', borderWidth: 1, borderColor: '#203B59',
    borderRadius: 20, padding: 18, marginBottom: 14
  },
  cardPremiumTheme: {
    backgroundColor: '#0E2138',
    borderColor: '#315C78',
  },
  premiumSurface: {
    backgroundColor: '#0E2138',
    borderColor: '#315C78',
  },
  premiumBorder: { borderColor: '#315C78' },
  heroCard: { backgroundColor: '#0A192B', borderColor: '#265A7C', padding: 20 },
  heroCardPremium: { backgroundColor: '#10263D', borderColor: '#315C78' },
  heroMark: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#132A45',
    borderWidth: 1, borderColor: '#218BFF', alignItems: 'center', justifyContent: 'center'
  },
  heroMarkText: { color: '#31D7FF', fontSize: 20, fontWeight: '900' },
  heroMarkPremium: { backgroundColor: '#132A45', borderColor: '#3E6D8A' },
  eyebrow: { color: '#218BFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  premiumEyebrow: { color: '#31D7FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroAmount: { color: '#F4F8FC', fontSize: 40, fontWeight: '800', marginTop: 8 },
  heroUnit: { color: '#A3ADBA', fontSize: 13, fontWeight: '700', marginTop: 1 },
  portfolioValue: { color: '#31D7FF', fontSize: 12, fontWeight: '800', marginTop: 16 },
  portfolioValuePremium: { color: '#D5E2EF' },
  heroHint: { color: '#70879F', lineHeight: 18, marginTop: 9, fontSize: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  menuTile: {
    width: '48%', minHeight: 100, backgroundColor: '#0E2138', borderWidth: 1,
    borderColor: '#203B59', borderRadius: 18, padding: 15
  },
  menuTileAccent: { backgroundColor: '#132A45', borderColor: '#218BFF' },
  menuTilePremium: { backgroundColor: '#10263D', borderColor: '#315C78' },
  menuTileIconPremium: { color: '#D5E2EF' },
  menuTileIcon: { color: '#31D7FF', fontSize: 18, marginBottom: 12, fontWeight: '900' },
  menuTileTitle: { color: '#F4F8FC', fontSize: 14, fontWeight: '800' },
  menuTileSubtitle: { color: '#70879F', fontSize: 10, marginTop: 5 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 },
  menuSectionLabel: { color: '#70879F', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 9, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionKicker: { color: '#70879F', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 4 },
  sectionTitle: { color: '#F4F8FC', fontSize: 21, fontWeight: '800', marginBottom: 12, marginTop: 2 },
  inlineAction: { color: '#218BFF', fontSize: 11, fontWeight: '800', marginBottom: 12 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 18 },
  assetMini: {
    width: '48%', backgroundColor: '#0E2138', borderWidth: 1, borderColor: '#203B59',
    borderRadius: 18, padding: 15, minHeight: 112
  },
  assetSelected: { borderColor: '#218BFF', backgroundColor: '#132A45' },
  assetIcon: { color: '#31D7FF', fontSize: 21, marginBottom: 8 },
  assetSymbol: { color: '#F4F8FC', fontSize: 15, fontWeight: '900' },
  assetBalance: { color: '#A9BCD0', fontSize: 12, marginTop: 6 },
  assetNameSmall: { color: '#70879F', fontSize: 10, marginTop: 5 },
  staffCard: { backgroundColor: '#0E2138', borderColor: '#218BFF' },
  staffEyebrow: { color: '#31D7FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  staffOrb: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#132A45',
    borderWidth: 1, borderColor: '#218BFF', alignItems: 'center', justifyContent: 'center'
  },
  staffOrbText: { color: '#A9EAF4', fontSize: 22, fontWeight: '900' },
  staffPrimaryAction: {
    flex: 1, backgroundColor: '#218BFF', borderRadius: 13, paddingVertical: 12,
    paddingHorizontal: 12, alignItems: 'center'
  },
  staffPrimaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  staffPrimaryActionPremium: {
    backgroundColor: '#315C78',
    borderWidth: 1,
    borderColor: '#D5E2EF',
  },
  staffSecondaryAction: {
    flex: 1, backgroundColor: '#132A45', borderWidth: 1, borderColor: '#284B68',
    borderRadius: 13, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center'
  },
  staffSecondaryActionText: { color: '#D5E2EF', fontSize: 12, fontWeight: '800' },
  cryptoCard: { backgroundColor: '#0A192B', borderColor: '#203B59' },
  homeSecondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  homeSecondaryCard: {
    flex: 1, minHeight: 126, backgroundColor: '#0E2138', borderWidth: 1,
    borderColor: '#203B59', borderRadius: 18, padding: 15
  },
  homeSecondaryKicker: { color: '#218BFF', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  homeSecondaryTitle: { color: '#F4F8FC', fontSize: 15, fontWeight: '800', marginTop: 8 },
  homeSecondaryText: { color: '#70879F', fontSize: 11, lineHeight: 16, marginTop: 6 },
  homeWideCard: {
    backgroundColor: '#0E2138', borderWidth: 1, borderColor: '#203B59',
    borderRadius: 18, padding: 15, minHeight: 94, marginBottom: 6
  },
  homePremiumCardActive: { borderColor: '#315C78', backgroundColor: '#10263D' },
  homePremiumKicker: { color: '#D5E2EF', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  highlightPremium: { backgroundColor: '#0E2138', borderColor: '#218BFF' },
  premiumCardActive: { backgroundColor: '#10263D', borderColor: '#315C78' },
  premiumKickerGold: { color: '#D5E2EF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  premiumEyebrowGold: { color: '#D5E2EF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  highlightRecurring: { backgroundColor: '#0A192B', borderColor: '#284B68' },
  highlightTitle: { color: '#F4F8FC', fontSize: 20, fontWeight: '800', marginTop: 7 },
  highlightText: { color: '#A9BCD0', lineHeight: 19, fontSize: 13, marginTop: 7 },
  button: {
    backgroundColor: '#218BFF', borderWidth: 1, borderColor: '#31D7FF',
    borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14
  },
  buttonSecondary: { backgroundColor: '#132A45', borderColor: '#284B68' },
  buttonPremium: { backgroundColor: '#315C78', borderColor: '#D5E2EF' },
  buttonSecondaryPremium: { backgroundColor: '#10263D', borderColor: '#315C78' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  buttonTextSecondary: { color: '#F2F4F7' },
  pageKicker: { color: '#218BFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  pageTitle: { color: '#F4F8FC', fontSize: 29, fontWeight: '800', marginBottom: 5 },
  pageSubtitle: { color: '#A9BCD0', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alignRight: { alignItems: 'flex-end' },
  assetRowTitle: { color: '#F4F8FC', fontSize: 16, fontWeight: '800' },
  assetRowSymbol: { color: '#70879F', fontSize: 11, marginTop: 4 },
  assetRowAmount: { color: '#F4F8FC', fontSize: 16, fontWeight: '800' },
  assetRowValue: { color: '#A9BCD0', fontSize: 11, marginTop: 4 },
  walletAddress: { color: '#218BFF', fontSize: 11, marginTop: 12, fontWeight: '700' },
  formLabel: { color: '#C5CBD4', fontWeight: '800', fontSize: 12, marginTop: 14, marginBottom: 7 },
  input: {
    backgroundColor: '#081726', borderWidth: 1, borderColor: '#284B68',
    color: '#F4F8FC', borderRadius: 13, padding: 14, fontSize: 15
  },
  quoteBox: { backgroundColor: '#081726', borderWidth: 1, borderColor: '#284B68', borderRadius: 16, padding: 14, marginTop: 12 },
  quoteTitle: { color: '#F4F8FC', fontWeight: '900', fontSize: 14 },
  quoteText: { color: '#A9BCD0', fontSize: 12, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#203B59', marginVertical: 18 },
  qrWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 16, marginBottom: 10 },
  codeText: { color: '#A9BCD0', fontSize: 10, lineHeight: 15, marginTop: 6 },
  previewNotice: { color: '#31D7FF', fontSize: 11, lineHeight: 17, marginTop: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  smallAction: { flex: 1, backgroundColor: '#132A45', borderWidth: 1, borderColor: '#284B68', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  smallActionText: { color: '#D5E2EF', fontSize: 12, fontWeight: '900' },
  successText: { color: '#35D69A', fontWeight: '800', marginTop: 10, fontSize: 12 },
  benefit: { color: '#D5E2EF', lineHeight: 24, fontSize: 13, marginBottom: 5 },
  profileCard: { backgroundColor: '#0E2138', borderColor: '#284B68' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#161B23',
    borderWidth: 1, borderColor: '#218BFF', alignItems: 'center', justifyContent: 'center'
  },
  profileAvatarText: { color: '#A9EAF4', fontSize: 19, fontWeight: '900' },
  profileAvatarPremium: { backgroundColor: '#10263D', borderColor: '#315C78' },
  profileName: { color: '#F4F8FC', fontSize: 21, fontWeight: '800' },
  profileHandle: { color: '#A9BCD0', fontSize: 12, marginTop: 3 },
  profileDivider: { height: 1, backgroundColor: '#203B59', marginVertical: 16 },
  profileLabel: { color: '#70879F', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 10 },
  profileValue: { color: '#E7EBF0', fontSize: 13, fontWeight: '700', marginTop: 4 },
  profileLine: { color: '#A9BCD0', fontSize: 13, marginBottom: 8 },
  profileSupportCard: { backgroundColor: '#0E2138', borderColor: '#265A7C' },
  credit: { color: '#35D69A', fontWeight: '900', fontSize: 12 },
  debit: { color: '#FF6B7A', fontWeight: '900', fontSize: 12 },
  messageBox: { backgroundColor: '#132A45', borderWidth: 1, borderColor: '#284B68', borderRadius: 13, padding: 12, marginBottom: 14 },
  messageText: { color: '#D5E2EF', fontSize: 12, lineHeight: 17 },
  bottomNav: {
    position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 70,
    backgroundColor: '#071522', borderTopWidth: 1, borderTopColor: '#203B59',
    flexDirection: 'row', paddingTop: 8, paddingHorizontal: 4
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 52, paddingVertical: 4 },
  bottomIcon: { color: '#70879F', fontSize: 18, fontWeight: '900' },
  bottomLabel: { color: '#70879F', fontSize: 10, fontWeight: '800', marginTop: 4 },
  bottomActive: { color: '#31D7FF' },
  bottomNavPremium: {
    borderTopColor: '#315C78',
    backgroundColor: '#0A0A08',
  },
  bottomPremiumIdle: { color: '#8FA8BB' },
  bottomActivePremium: { color: '#D5E2EF' },

  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEye: { color: '#70879F', fontSize: 11, marginTop: 1 },
  premiumBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#416982',
    backgroundColor: '#10263D',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  premiumBadgeText: {
    color: '#D5E2EF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 28,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    minWidth: 68,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#102A42',
    borderWidth: 1,
    borderColor: '#275475',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionIconPrimary: {
    backgroundColor: '#31D7FF',
    borderColor: '#76E7FF',
  },
  quickActionLabel: {
    color: '#D5E2EF',
    fontSize: 10,
    fontWeight: '700',
  },

  assistantHomeCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#203B59',
    backgroundColor: '#0E2138',
    padding: 14,
    marginBottom: 26,
  },
  assistantHomeIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102A42',
    borderWidth: 1,
    borderColor: '#2A5877',
  },
  assistantHomeIconText: {
    color: '#31D7FF',
    fontSize: 20,
    fontWeight: '900',
  },
  assistantHomeKicker: {
    color: '#31D7FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  assistantHomeTitle: {
    color: '#F4F8FC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  assistantHomeText: {
    color: '#70879F',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  assistantHomeArrow: {
    color: '#31D7FF',
    fontSize: 24,
    fontWeight: '500',
  },
  assetList: {
    backgroundColor: '#0A192B',
    borderWidth: 1,
    borderColor: '#203B59',
    borderRadius: 20,
    paddingHorizontal: 14,
    marginBottom: 26,
  },
  assetListRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#17344E',
    gap: 12,
  },
  assetTokenIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    backgroundColor: '#0D2034',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetTokenMark: { fontSize: 15, fontWeight: '900' },
  assetListIdentity: { flex: 1 },
  assetListName: { color: '#F4F8FC', fontSize: 14, fontWeight: '800' },
  assetListAmount: { color: '#D5E2EF', fontSize: 12, fontWeight: '800' },
  activityCard: { paddingVertical: 4, paddingHorizontal: 14 },
  activityRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#17344E',
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#102A42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { color: '#F4F8FC', fontSize: 13, fontWeight: '800' },
  activityDate: { color: '#70879F', fontSize: 10, marginTop: 4 },
  activityCredit: { color: '#35D69A', fontSize: 11, fontWeight: '900' },
  activityDebit: { color: '#D5E2EF', fontSize: 11, fontWeight: '900' },
  emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 14 },
  emptyStateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#102A42',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: { color: '#D5E2EF', fontSize: 15, fontWeight: '800' },
  emptyStateText: {
    color: '#70879F',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moveCard: {
    width: '48%',
    minHeight: 152,
    borderRadius: 20,
    backgroundColor: '#0E2138',
    borderWidth: 1,
    borderColor: '#203B59',
    padding: 16,
  },
  moveCardWide: { width: '100%', minHeight: 130 },
  moveIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#102A42',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  moveTitle: { color: '#F4F8FC', fontSize: 16, fontWeight: '800' },
  moveText: { color: '#70879F', fontSize: 11, lineHeight: 17, marginTop: 6 },
  bottomIconWrap: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIconWrapActive: {
    borderRadius: 14,
    backgroundColor: '#0C2B43',
  },
  bottomCenterIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginTop: -18,
    backgroundColor: '#31D7FF',
    borderWidth: 4,
    borderColor: '#06111F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCenterLabel: { marginTop: 0 },
  profileMenu: {
    borderRadius: 20,
    backgroundColor: '#0E2138',
    borderWidth: 1,
    borderColor: '#203B59',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  profileMenuRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#17344E',
  },
  profileMenuRowLast: { borderBottomWidth: 0 },
  profileMenuTitle: { color: '#F4F8FC', fontSize: 14, fontWeight: '800' },
  profileMenuText: { color: '#70879F', fontSize: 10, marginTop: 4 },
  profileMenuArrow: { color: '#31D7FF', fontSize: 24, fontWeight: '500' },
  walletQrWrap: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 20,
    marginBottom: 14,
  },
  walletAddressFull: {
    color: '#D5E2EF',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  walletNetwork: {
    color: '#70879F',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  historySimpleList: {
    borderRadius: 20,
    backgroundColor: '#0E2138',
    borderWidth: 1,
    borderColor: '#203B59',
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  historySimpleRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#17344E',
  },
  historySimpleRowLast: { borderBottomWidth: 0 },
  historySimpleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#102A42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySimpleTitle: { color: '#F4F8FC', fontSize: 13, fontWeight: '800' },
  historySimpleDate: { color: '#70879F', fontSize: 10, marginTop: 4 },
};