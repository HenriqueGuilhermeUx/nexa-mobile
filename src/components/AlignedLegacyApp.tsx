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
  { symbol: 'XAUT', name: 'Ouro Digital', icon: '◈', description: 'Exposição digital ao ouro por Tether Gold (XAUT).' },
];

function premiumActive(user: any) {
  const status = String(
    user?.premiumStatus || user?.subscriptionStatus || user?.plan || user?.premium?.status || '',
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

function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function PrimaryButton({ title, onPress, disabled, secondary }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.84}
      style={[
        styles.button,
        secondary ? styles.buttonSecondary : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : null]}>{title}</Text>
    </TouchableOpacity>
  );
}

function MenuTile({ icon, title, subtitle, onPress, accent }: any) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={[styles.menuTile, accent ? styles.menuTileAccent : null]}
    >
      <Text style={styles.menuTileIcon}>{icon}</Text>
      <Text style={styles.menuTileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.menuTileSubtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

function BottomNav({ page, onNavigate }: any) {
  const insets = useSafeAreaInsets();
  const items = [
    ['home', '⌂', 'Início'],
    ['wallet', '◫', 'Carteira'],
    ['assets', '◇', 'Ativos'],
    ['assistant', '✦', 'Assistente'],
    ['menu', '☰', 'Menu'],
  ];
  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}> 
      {items.map(([target, icon, label]) => {
        const active = page === target;
        return (
          <TouchableOpacity
            key={target}
            style={styles.bottomItem}
            onPress={() => onNavigate(target)}
            activeOpacity={0.8}
          >
            <Text style={[styles.bottomIcon, active ? styles.bottomActive : null]}>{icon}</Text>
            <Text style={[styles.bottomLabel, active ? styles.bottomActive : null]}>{label}</Text>
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
  const [balances, setBalances] = useState<any>({ BRL: 0, USDC: 0, BTC: 0, ETH: 0, XAUT: 0 });
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
  const [walletWorking, setWalletWorking] = useState(false);
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
  const walletAddress = user?.wallet?.address || user?.walletAddress || embeddedWallet?.address || '';
  const hasExistingWallet = Boolean(walletAddress);
  const canAccessCustody = isPremium || hasExistingWallet;
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
      const [me, balanceData, portfolioData, statementData] = await Promise.all([
        json(`${API}/user/me`, { headers: authHeaders }),
        json(`${API}/ledger/balance?userId=${encodeURIComponent(user.id)}&mode=portfolio&_=${cache}`, { headers: authHeaders }),
        json(`${API}/swap/portfolio?_=${cache}`, { headers: authHeaders }),
        json(`${API}/ledger/statement?userId=${encodeURIComponent(user.id)}&limit=40&mode=portfolio&_=${cache}`, { headers: authHeaders }),
      ]);
      const currentUser = me?.user || me || user;
      setUser(currentUser);
      setBalances({
        BRL: Number(balanceData?.balances?.BRL || 0),
        USDC: Number(balanceData?.balances?.USDC || 0),
        BTC: Number(balanceData?.balances?.BTC || 0),
        ETH: Number(balanceData?.balances?.ETH || 0),
        XAUT: Number(balanceData?.balances?.XAUT || 0),
      });
      setPortfolio(portfolioData?.success ? portfolioData : null);
      setStatement(statementData?.statement || []);

      const [recurringData, plansData, positionsData] = await Promise.allSettled([
        json(`${API}/recurring-pix/me`, { headers: authHeaders }),
        json(`${API}/rewards/plans`),
        json(`${API}/rewards/positions?userId=${encodeURIComponent(user.id)}`),
      ]);
      if (recurringData.status === 'fulfilled') {
        const d: any = recurringData.value;
        setRecurring(d?.recurringPix || d?.plan || d?.recurring || d?.data || null);
      }
      if (plansData.status === 'fulfilled') setRewardPlans((plansData.value as any)?.plans || []);
      if (positionsData.status === 'fulfilled') setRewardPositions((positionsData.value as any)?.positions || []);
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

      const data = await json(`${API}/deposit/woovi-pix`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amountBrl: value,
          clientRequestId: requestId,
        }),
      });
      setDepositResult(data);
      setMessage(data?.message || 'Pix criado. Pague usando o QR Code ou copia e cola.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPixDeposit() {
    if (!depositResult?.depositId) return setMessage('Gere um Pix primeiro.');
    try {
      setLoading(true);
      const data = await json(
        `${API}/deposit/${encodeURIComponent(depositResult.depositId)}/status`,
        { headers: authHeaders },
      );
      setDepositResult((current: any) => ({ ...current, ...data }));
      setMessage(
        String(data?.status || '').toLowerCase() === 'completed'
          ? 'Pix confirmado e processado.'
          : `Status do Pix: ${String(data?.status || 'pendente')}`,
      );
      if (String(data?.status || '').toLowerCase() === 'completed') await loadAll();
    } catch (error: any) {
      setMessage(error.message);
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
      throw new Error('Carteira Privy não está disponível neste dispositivo.');
    }

    const linkedAddress = String(walletAddress || '').toLowerCase();
    const deviceAddress = String(embeddedWallet.address || '').toLowerCase();
    if (linkedAddress && linkedAddress !== deviceAddress) {
      throw new Error(
        'A carteira Privy deste dispositivo não corresponde à carteira vinculada à sua conta Nexa.',
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

  async function createPremiumWallet() {
    if (!isPremium) return setMessage('A carteira individual é um recurso Nexa Premium.');
    if (walletAddress) return setMessage('Sua carteira individual já está vinculada.');
    if (!privy?.isReady) return setMessage('A carteira ainda está sendo preparada.');
    try {
      setWalletWorking(true);
      setMessage('Criando sua carteira individual...');
      if (!embeddedWallet) {
        if (!embedded?.create) throw new Error('Criação de carteira indisponível neste dispositivo.');
        await embedded.create({ createAdditional: false });
        setMessage('Carteira criada. Aguarde alguns segundos e toque novamente para concluir o vínculo.');
        return;
      }
      const privyToken = await privy.getAccessToken?.();
      if (!privyToken) throw new Error('Sessão Privy expirada. Entre novamente.');
      await nexaApi.linkWallet(token, privyToken, {
        privyWalletId: String(embeddedWallet.id || embeddedWallet.walletId || embeddedWallet.address),
        walletAddress: embeddedWallet.address,
      });
      setUser((current: any) => ({ ...current, walletAddress: embeddedWallet.address }));
      setMessage('Carteira Premium vinculada com sucesso.');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setWalletWorking(false);
    }
  }

  const portfolioPositions = useMemo(() => {
    const byAsset: Record<string, any> = {};
    for (const item of portfolio?.positions || []) byAsset[String(item.asset || '').toUpperCase()] = item;
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

  const contentBottom = 92 + Math.max(insets.bottom, 10);

  function Home() {
    return (
      <>
        <View style={styles.homeTop}>
          <View>
            <Text style={styles.welcomeLabel}>PRIVATE DIGITAL BANKING</Text>
            <Text style={styles.hello}>Olá, {firstName}</Text>
            <Text style={styles.handle}>{handle || 'Conta Nexa'}</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.eyebrow}>PATRIMÔNIO DIGITAL</Text>
              <Text style={styles.heroAmount}>{amount(balances.USDC, 6)}</Text>
              <Text style={styles.heroUnit}>USDC disponível</Text>
            </View>
            <View style={styles.heroMark}>
              <Text style={styles.heroMarkText}>N</Text>
            </View>
          </View>
          {portfolioTotalUsd > 0 ? (
            <Text style={styles.portfolioValue}>
              Carteira estimada: US$ {amount(portfolioTotalUsd, 2)}
            </Text>
          ) : null}
          <Text style={styles.heroHint}>
            Liquidez, ativos e serviços financeiros organizados em uma única experiência.
          </Text>
        </Card>

        <View style={styles.quickRow}>
          <MenuTile icon="＋" title="Adicionar" subtitle="Pix" onPress={openWalletFirstDeposit} />
          <MenuTile icon="↓" title="Sacar" subtitle="Pix" onPress={openWalletFirstWithdraw} />
          <MenuTile icon="↑" title="Enviar" subtitle="Nexa" onPress={openWalletFirstSend} />
          <MenuTile icon="◇" title="Investir" subtitle="Ativos" onPress={openWalletFirstAssets} accent />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>CARTEIRA</Text>
            <Text style={styles.sectionTitle}>Seus ativos</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('assets')}>
            <Text style={styles.inlineAction}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.assetGrid}>
          {portfolioPositions.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={styles.assetMini}
              onPress={() => {
                setAsset(item.symbol === 'USDC' ? 'BTC' : item.symbol);
                setPage(item.symbol === 'USDC' ? 'wallet' : 'assets');
              }}
            >
              <Text style={styles.assetIcon}>{item.icon}</Text>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetBalance}>{amount(item.amount, 6)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {config.assistantEnabled ? (
          <Card style={styles.staffCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={styles.staffEyebrow}>ASSISTENTE NEXA</Text>
                <Text style={styles.highlightTitle}>Seu assistente pessoal e financeiro.</Text>
                <Text style={styles.highlightText}>
                  Organize o dia, acompanhe prioridades e use seu contexto financeiro quando precisar.
                </Text>
              </View>
              <View style={styles.staffOrb}>
                <Text style={styles.staffOrbText}>✦</Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.staffPrimaryAction} onPress={() => router.push('/assistant')}>
                <Text style={styles.staffPrimaryActionText}>Abrir Assistente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.staffSecondaryAction} onPress={openNexaSupport}>
                <Text style={styles.staffSecondaryActionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        <Card style={styles.investmentCard}>
          <Text style={styles.sectionKicker}>OPORTUNIDADES</Text>
          <Text style={styles.highlightTitle}>Invista sem lidar com a complexidade técnica.</Text>
          <Text style={styles.highlightText}>
            Bitcoin, Ethereum, Ouro Digital e Rewards, com a Nexa cuidando da experiência.
          </Text>
          <PrimaryButton title="Explorar ativos" onPress={() => setPage('assets')} secondary />
        </Card>

        <View style={styles.homeSecondaryRow}>
          <TouchableOpacity style={styles.homeSecondaryCard} onPress={() => setPage('rewards')}>
            <Text style={styles.homeSecondaryKicker}>REWARDS</Text>
            <Text style={styles.homeSecondaryTitle}>Turbinar USDC</Text>
            <Text style={styles.homeSecondaryText}>Acompanhe suas posições e benefícios.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeSecondaryCard} onPress={() => setPage('recurring')}>
            <Text style={styles.homeSecondaryKicker}>RECORRÊNCIA</Text>
            <Text style={styles.homeSecondaryTitle}>Aportes mensais</Text>
            <Text style={styles.homeSecondaryText}>Organize compras recorrentes de USDC.</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function Wallet() {
    return (
      <>
        <Text style={styles.pageTitle}>Carteira Nexa</Text>
        <Text style={styles.pageSubtitle}>Seu saldo operacional e seus ativos em um só lugar.</Text>
        <Card>
          <Text style={styles.eyebrow}>SALDO DISPONÍVEL</Text>
          <Text style={styles.heroAmount}>{amount(balances.USDC, 6)} USDC</Text>
          <Text style={styles.highlightText}>Transferências Nexa entre usuários são feitas somente em USDC.</Text>
        </Card>
        <Text style={styles.sectionTitle}>Meus ativos</Text>
        {portfolioPositions.map((item) => (
          <Card key={item.symbol}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.assetRowTitle}>{item.icon} {item.name}</Text>
                <Text style={styles.assetRowSymbol}>{item.symbol}</Text>
              </View>
              <View style={styles.alignRight}>
                <Text style={styles.assetRowAmount}>{amount(item.amount, 8)}</Text>
                {item.valueUsd > 0 ? <Text style={styles.assetRowValue}>US$ {amount(item.valueUsd, 2)}</Text> : null}
              </View>
            </View>
          </Card>
        ))}
        <Card style={canAccessCustody ? styles.highlightPremium : undefined}>
          <Text style={styles.eyebrow}>CARTEIRA INDIVIDUAL</Text>
          <Text style={styles.highlightTitle}>
            {hasExistingWallet
              ? isPremium
                ? 'Seu recurso Premium on-chain.'
                : 'Sua carteira existente continua acessível.'
              : 'Disponível no Nexa Premium.'}
          </Text>
          <Text style={styles.highlightText}>
            {walletAddress
              ? `Carteira vinculada: ${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
              : 'Crie e vincule uma carteira individual para recursos externos.'}
          </Text>
          <PrimaryButton
            title={canAccessCustody ? 'Abrir Minha Carteira' : 'Conhecer Premium'}
            onPress={() => setPage(canAccessCustody ? 'custody' : 'premium')}
          />
        </Card>
      </>
    );
  }

  function Assets() {
    return (
      <>
        <Text style={styles.pageTitle}>Ativos</Text>
        <Text style={styles.pageSubtitle}>USDC, Bitcoin, Ethereum e Ouro Digital. Disponíveis para todos os clientes Nexa.</Text>
        <View style={styles.assetGrid}>
          {ASSETS.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={[styles.assetMini, asset === item.symbol ? styles.assetSelected : null]}
              onPress={() => {
                if (item.symbol === 'USDC') return setPage('wallet');
                setAsset(item.symbol);
                setAssetQuote(null);
                setSellQuote(null);
                setAssetBuyRequestId('');
                setAssetSellRequestId('');
              }}
            >
              <Text style={styles.assetIcon}>{item.icon}</Text>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetNameSmall}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {asset !== 'USDC' ? (
          <Card>
            <Text style={styles.assetRowTitle}>{ASSETS.find((item) => item.symbol === asset)?.name}</Text>
            <Text style={styles.highlightText}>{ASSETS.find((item) => item.symbol === asset)?.description}</Text>
            <Text style={styles.formLabel}>Comprar usando USDC</Text>
            <TextInput style={styles.input} placeholder="Valor em USDC" placeholderTextColor="#64748b" value={assetAmountUsdc} onChangeText={(v) => { setAssetAmountUsdc(v); setAssetQuote(null); setAssetBuyRequestId(''); }} keyboardType="decimal-pad" />
            <PrimaryButton title="Ver cotação" onPress={quoteAsset} disabled={loading} />
            {assetQuote?.allowed ? (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteTitle}>Cotação Nexa</Text>
                <Text style={styles.quoteText}>Estimativa: {amount(assetQuote.estimatedToAmount || assetQuote.netToAmount, 8)} {asset}</Text>
                <Text style={styles.quoteText}>Condição Nexa: {Number(assetQuote?.fees?.nexaConversionFeePercent || 0).toFixed(2)}%</Text>
                <PrimaryButton title={config.financialExecutionEnabled ? `Confirmar ${asset}` : 'Execução desativada neste build'} onPress={executeAssetBuy} disabled={!config.financialExecutionEnabled || loading} />
              </View>
            ) : null}
            <View style={styles.divider} />
            <Text style={styles.formLabel}>Converter {asset} para USDC</Text>
            <TextInput style={styles.input} placeholder={`Quantidade de ${asset}`} placeholderTextColor="#64748b" value={sellAmount} onChangeText={(v) => { setSellAmount(v); setSellQuote(null); setAssetSellRequestId(''); }} keyboardType="decimal-pad" />
            <PrimaryButton title="Ver cotação de saída" onPress={quoteSell} disabled={loading} secondary />
            {sellQuote?.allowed ? (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteTitle}>Cotação de saída</Text>
                <Text style={styles.quoteText}>Estimativa: {amount(sellQuote.estimatedUsdc || sellQuote.netUsdc, 8)} USDC</Text>
                <PrimaryButton title={config.financialExecutionEnabled ? 'Confirmar conversão' : 'Execução desativada neste build'} onPress={executeSell} disabled={!config.financialExecutionEnabled || loading} />
              </View>
            ) : null}
          </Card>
        ) : null}
      </>
    );
  }

  function Send() {
    return (
      <>
        <Text style={styles.pageTitle}>Enviar USDC</Text>
        <Text style={styles.pageSubtitle}>Entre clientes Nexa, as transferências são instantâneas no saldo interno e somente em USDC.</Text>
        <Card>
          <Text style={styles.formLabel}>Destinatário Nexa</Text>
          <TextInput style={styles.input} placeholder="@username" placeholderTextColor="#64748b" value={username} onChangeText={(v) => { setUsername(v); setRecipient(null); setInternalTransferRequestId(''); }} autoCapitalize="none" />
          <PrimaryButton title="Verificar usuário" onPress={findRecipient} secondary />
          {recipient ? <Text style={styles.successText}>✓ {recipient.fullName} · {recipient.handle || `@${recipient.username}`}</Text> : null}
          <Text style={styles.formLabel}>Valor</Text>
          <TextInput style={styles.input} placeholder="USDC" placeholderTextColor="#64748b" value={sendAmount} onChangeText={(v) => { setSendAmount(v); setInternalTransferRequestId(''); }} keyboardType="decimal-pad" />
          <PrimaryButton title="Enviar USDC" onPress={sendInternal} disabled={!recipient || loading} />
        </Card>
        <Card style={canAccessCustody ? styles.highlightPremium : undefined}>
          <Text style={styles.eyebrow}>MOVIMENTAÇÃO EXTERNA</Text>
          <Text style={styles.highlightTitle}>
            {canAccessCustody ? 'Use sua carteira individual.' : 'Recurso Nexa Premium.'}
          </Text>
          <Text style={styles.highlightText}>
            Recebimento externo e movimentação entre Saldo Nexa e sua carteira individual ficam organizados em Minha Carteira.
            {hasExistingWallet && !isPremium ? ' Sua carteira já criada permanece acessível.' : ''}
          </Text>
          <PrimaryButton
            title={canAccessCustody ? 'Abrir Minha Carteira' : 'Conhecer Premium'}
            onPress={() => setPage(canAccessCustody ? 'custody' : 'premium')}
            secondary
          />
        </Card>
      </>
    );
  }

  function Premium() {
    return (
      <>
        <Text style={styles.pageTitle}>Nexa Premium</Text>
        <Text style={styles.pageSubtitle}>Mais autonomia, taxas menores e recursos adicionais dentro e fora da Nexa.</Text>
        <Card style={styles.highlightPremium}>
          <Text style={styles.premiumEyebrow}>{isPremium ? 'PREMIUM ATIVO' : 'CONDIÇÕES PREMIUM'}</Text>
          <Text style={styles.highlightTitle}>Condições melhores para usar a Nexa</Text>
          <Text style={styles.highlightText}>Taxas menores em operações elegíveis, carteira individual e recursos adicionais de movimentação.</Text>
        </Card>
        <Card>
          <Text style={styles.benefit}>✓ USDC, BTC, ETH e Ouro Digital disponíveis para todos</Text>
          <Text style={styles.benefit}>✓ Carteira individual Privy no Premium</Text>
          <Text style={styles.benefit}>✓ Recebimento externo na carteira individual</Text>
          <Text style={styles.benefit}>✓ Movimentação Saldo Nexa ↔ carteira individual</Text>
          <Text style={styles.benefit}>✓ Condições Premium em operações elegíveis</Text>
          <Text style={styles.benefit}>✓ Atendimento prioritário</Text>
        </Card>
        {isPremium ? (
          <Card>
            <Text style={styles.highlightTitle}>Minha carteira Premium</Text>
            <Text style={styles.highlightText}>{walletAddress ? 'Sua carteira já está vinculada.' : 'Crie sua carteira individual em poucos segundos.'}</Text>
            <PrimaryButton title={walletAddress ? 'Abrir Minha Carteira' : walletWorking ? 'Preparando...' : 'Criar Minha Carteira'} onPress={walletAddress ? () => setPage('custody') : createPremiumWallet} disabled={walletWorking} />
          </Card>
        ) : null}
      </>
    );
  }

  function Recurring() {
    return (
      <>
        <Text style={styles.pageTitle}>USDC por assinatura</Text>
        <Text style={styles.pageSubtitle}>Escolha valor e dia do mês. A recorrência é somente em USDC.</Text>
        {recurring ? (
          <Card>
            <Text style={styles.eyebrow}>RECORRÊNCIA ATUAL</Text>
            <Text style={styles.highlightTitle}>{money(recurring.monthlyAmountBrl || recurring.amountBrl || recurring.amount || 0)}</Text>
            <Text style={styles.highlightText}>
              Dia {Number(recurring.preferredDay || recurring.dayOfMonth || recurring.day || 5)} · status {String(recurring.status || 'ativo')}
            </Text>
            {recurring.wooviSubscriptionId ? (
              <>
                <Text style={styles.successText}>✓ Pix Automático vinculado</Text>
                <Text style={styles.highlightText}>Status Woovi: {String(recurring.wooviSubscriptionStatus || 'ativo')}</Text>
                {recurring.wooviBrCode ? (
                  <View style={styles.qrWrap}>
                    <QRCode value={String(recurring.wooviBrCode)} size={172} />
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.highlightText}>Pix Automático ainda não vinculado.</Text>
            )}
            {!recurring.wooviSubscriptionId ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.formLabel}>
                  Endereço exigido para autorização do Pix Automático
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="CEP"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.zipcode}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({ ...current, zipcode: value }))
                  }
                  keyboardType="number-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Rua"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.street}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({ ...current, street: value }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Número"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.number}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({ ...current, number: value }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Bairro"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.neighborhood}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({ ...current, neighborhood: value }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Cidade"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.city}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({ ...current, city: value }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="UF"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.state}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({
                      ...current,
                      state: value.toUpperCase().slice(0, 2),
                    }))
                  }
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Complemento (opcional)"
                  placeholderTextColor="#64748b"
                  value={recurringAddress.complement}
                  onChangeText={(value) =>
                    setRecurringAddress((current) => ({ ...current, complement: value }))
                  }
                />
              </View>
            ) : null}
            <PrimaryButton
              title={config.financialExecutionEnabled ? 'Ativar Pix Automático' : 'Pix Automático bloqueado no preview'}
              onPress={linkRecurringWoovi}
              disabled={!config.financialExecutionEnabled || loading}
              secondary
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.smallAction} onPress={pauseRecurring} disabled={loading}>
                <Text style={styles.smallActionText}>Pausar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallAction} onPress={cancelRecurring} disabled={loading}>
                <Text style={styles.smallActionText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}
        <Card>
          <Text style={styles.formLabel}>Valor mensal</Text>
          <TextInput style={styles.input} placeholder="R$ 100,00" placeholderTextColor="#64748b" value={recurringAmount} onChangeText={setRecurringAmount} keyboardType="decimal-pad" />
          <Text style={styles.formLabel}>Dia do mês (1 a 28)</Text>
          <TextInput style={styles.input} placeholder="5" placeholderTextColor="#64748b" value={recurringDay} onChangeText={setRecurringDay} keyboardType="number-pad" />
          <PrimaryButton title="Salvar recorrência" onPress={saveRecurring} disabled={loading} />
        </Card>
      </>
    );
  }

  function Rewards() {
    const activePositions = rewardPositions.filter(
      (position: any) => String(position?.status || '').toLowerCase() === 'active',
    );

    return (
      <>
        <Text style={styles.pageTitle}>Nexa Rewards</Text>
        <Text style={styles.pageSubtitle}>
          Separe uma parte do seu USDC para participar do programa Rewards.
        </Text>

        <Card>
          <Text style={styles.eyebrow}>COMO FUNCIONA</Text>
          <Text style={styles.highlightTitle}>
            Benefícios sobre recompensas efetivamente geradas.
          </Text>
          <Text style={styles.highlightText}>
            O saldo escolhido fica reservado enquanto participa. Quando houver
            recompensa efetivamente realizada, 80% fica com o cliente e 20% com
            a Nexa. O principal continua identificado separadamente.
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Programa disponível</Text>
        {rewardPlans.length ? (
          rewardPlans.map((plan: any, index: number) => (
            <Card key={plan.id || plan.code || plan.plan || index}>
              <Text style={styles.assetRowTitle}>
                {plan.name || plan.title || plan.plan || 'Nexa Rewards'}
              </Text>
              <Text style={styles.highlightText}>
                {plan.label ||
                  plan.description ||
                  plan.subtitle ||
                  'Programa Rewards para clientes Premium.'}
              </Text>

              {isPremium ? (
                <>
                  <Text style={styles.formLabel}>USDC para participar</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Valor em USDC"
                    placeholderTextColor="#64748b"
                    value={rewardAmountUsdc}
                    onChangeText={(value) => {
                      setRewardAmountUsdc(value);
                      setRewardJoinRequestId('');
                    }}
                    keyboardType="decimal-pad"
                  />
                  <PrimaryButton
                    title={
                      config.financialExecutionEnabled
                        ? 'Participar do Rewards'
                        : 'Rewards bloqueado no preview'
                    }
                    onPress={joinRewards}
                    disabled={!config.financialExecutionEnabled || loading}
                  />
                </>
              ) : (
                <PrimaryButton
                  title="Conhecer Nexa Premium"
                  onPress={() => setPage('premium')}
                  secondary
                />
              )}
            </Card>
          ))
        ) : (
          <Card>
            <Text style={styles.highlightText}>
              Não foi possível carregar o programa Rewards agora. Atualize a
              conta; se persistir, a operação permanece bloqueada por segurança.
            </Text>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Minhas posições</Text>
        {activePositions.length ? (
          activePositions.map((position: any) => (
            <Card key={position.id}>
              <Text style={styles.eyebrow}>SALDO RESERVADO</Text>
              <Text style={styles.highlightTitle}>
                {amount(position.principalUsdc, 8)} USDC
              </Text>
              <Text style={styles.highlightText}>
                Status: {String(position.status || 'active')}
              </Text>
              <PrimaryButton
                title={
                  config.financialExecutionEnabled
                    ? 'Resgatar Rewards'
                    : 'Resgate bloqueado no preview'
                }
                onPress={() => withdrawReward(position.id)}
                disabled={!config.financialExecutionEnabled || loading}
                secondary
              />
            </Card>
          ))
        ) : (
          <Card>
            <Text style={styles.highlightText}>Nenhuma posição ativa.</Text>
          </Card>
        )}
      </>
    );
  }

  function Menu() {
    return (
      <>
        <Text style={styles.pageKicker}>CONTA & SERVIÇOS</Text>
        <Text style={styles.pageTitle}>Menu</Text>
        <Text style={styles.pageSubtitle}>Sua conta, investimentos, atendimento e segurança.</Text>

        <Text style={styles.menuSectionLabel}>CONTA</Text>
        <View style={styles.menuGrid}>
          <MenuTile icon="◎" title="Perfil" subtitle={handle || 'Dados pessoais'} onPress={() => setPage('profile')} />
          <MenuTile icon="↕" title="Movimentações" subtitle="Histórico" onPress={() => setPage('history')} />
          <MenuTile icon="ID" title="Nexa ID" subtitle={nexaId || handle} onPress={() => setPage('nexaId')} />
          <MenuTile icon="◈" title="Carteira" subtitle="Ativos e custódia" onPress={() => setPage('wallet')} />
        </View>

        <Text style={styles.menuSectionLabel}>MOVIMENTAR</Text>
        <View style={styles.menuGrid}>
          <MenuTile icon="＋" title="Adicionar" subtitle="Via Pix" onPress={openWalletFirstDeposit} />
          <MenuTile icon="↓" title="Sacar" subtitle="Para seu Pix" onPress={openWalletFirstWithdraw} />
          <MenuTile icon="↑" title="Enviar" subtitle="Nexa para Nexa" onPress={openWalletFirstSend} />
          <MenuTile icon="◇" title="Investir" subtitle="BTC · ETH · Ouro" onPress={openWalletFirstAssets} accent />
        </View>

        <Text style={styles.menuSectionLabel}>SERVIÇOS</Text>
        <View style={styles.menuGrid}>
          <MenuTile icon="★" title="Premium" subtitle={isPremium ? 'Ativo' : 'Benefícios'} onPress={() => setPage('premium')} />
          <MenuTile icon="↻" title="Aportes" subtitle="USDC recorrente" onPress={() => setPage('recurring')} />
          <MenuTile icon="✦" title="Rewards" subtitle="Posições e benefícios" onPress={() => setPage('rewards')} />
          <MenuTile icon="⌁" title="Segurança" subtitle="Biometria e proteção" onPress={() => router.push('/security')} />
        </View>

        <Text style={styles.menuSectionLabel}>ATENDIMENTO</Text>
        <View style={styles.menuGrid}>
          {config.assistantEnabled ? (
            <MenuTile
              icon="✦"
              title="Assistente Nexa"
              subtitle="IA para vida e dinheiro"
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
            style={styles.input}
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
            <Text style={styles.previewNotice}>
              Preview seguro: esta tela está conectada ao contrato real, mas não cria cobrança Woovi.
            </Text>
          ) : null}
        </Card>
        {depositResult ? (
          <Card style={styles.highlightRecurring}>
            <Text style={styles.eyebrow}>PIX NEXA</Text>
            <Text style={styles.highlightTitle}>{money(depositResult.amountBrl || 0)}</Text>
            <Text style={styles.highlightText}>Status: {String(depositResult.status || 'pendente')}</Text>
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
            style={styles.input}
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
            <View style={styles.quoteBox}>
              <Text style={styles.quoteTitle}>Cotação Nexa</Text>
              <Text style={styles.quoteText}>USDC: {amount(withdrawQuote.amountUsdc, 8)}</Text>
              <Text style={styles.quoteText}>Pix estimado: {money(withdrawQuote.netBrl || 0)}</Text>
              <Text style={styles.quoteText}>
                Taxas e proteção de liquidez já consideradas conforme a cotação apresentada.
              </Text>
              <Text style={styles.formLabel}>Chave Pix</Text>
              <TextInput
                style={styles.input}
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
            <Text style={styles.previewNotice}>
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
          <Text style={styles.eyebrow}>NEXA ID</Text>
          <Text style={styles.highlightTitle}>{nexaId || 'Nexa ID em criação'}</Text>
          <Text style={styles.highlightText}>{handle || 'Username ainda não definido'}</Text>
          {nexaPassportQrValue ? (
            <View style={styles.qrWrap}>
              <QRCode value={nexaPassportQrValue} size={210} />
            </View>
          ) : (
            <Text style={styles.previewNotice}>O QR Code aparecerá assim que seu Nexa ID estiver disponível.</Text>
          )}
          <Text style={styles.profileLine}>Nome: {user?.fullName || '-'}</Text>
          <Text style={styles.profileLine}>KYC: {String(user?.kycStatus || 'pending')}</Text>
          <Text style={styles.profileLine}>Rede da carteira: {walletNetwork}</Text>
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
        <Text style={styles.pageKicker}>CLIENTE NEXA</Text>
        <Text style={styles.pageTitle}>Perfil</Text>
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{firstName.charAt(0).toUpperCase()}</Text>
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
          {walletAddress ? (
            <>
              <Text style={styles.profileLabel}>Carteira vinculada</Text>
              <Text style={styles.profileValue}>{walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</Text>
            </>
          ) : null}
        </Card>
        <Card style={styles.profileSupportCard}>
          <Text style={styles.staffEyebrow}>ATENDIMENTO</Text>
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
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 18) + 10, paddingBottom: contentBottom }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} tintColor="#60a5fa" />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>NEXA</Text>
            <Text style={styles.brandTag}>Cripto sem complicação.</Text>
          </View>
          <Text style={styles.brandEdition}>PRIVATE</Text>
        </View>
        {message ? (
          <TouchableOpacity onPress={() => setMessage('')} style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </TouchableOpacity>
        ) : null}
        {loading && !body ? <ActivityIndicator color="#60a5fa" /> : body}
      </ScrollView>
      <BottomNav
        page={page}
        onNavigate={(target: string) =>
          target === 'assistant' ? router.push('/assistant') : setPage(target)
        }
      />
    </View>
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
  brandEdition: { color: '#C8A968', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  homeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  welcomeLabel: { color: '#C8A968', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  hello: { color: '#F7F8FA', fontSize: 28, fontWeight: '800' },
  handle: { color: '#8F9AAC', fontSize: 12, fontWeight: '700', marginTop: 4 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#111722',
    borderWidth: 1, borderColor: '#2B3442', alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { color: '#E9D7A8', fontSize: 18, fontWeight: '900' },
  card: {
    backgroundColor: '#0C1119', borderWidth: 1, borderColor: '#1B2432',
    borderRadius: 20, padding: 18, marginBottom: 14
  },
  heroCard: { backgroundColor: '#0D1522', borderColor: '#5F5133', padding: 20 },
  heroMark: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#171D27',
    borderWidth: 1, borderColor: '#6B5A36', alignItems: 'center', justifyContent: 'center'
  },
  heroMarkText: { color: '#D8BC7A', fontSize: 20, fontWeight: '900' },
  eyebrow: { color: '#C8A968', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  premiumEyebrow: { color: '#D8BC7A', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroAmount: { color: '#F7F8FA', fontSize: 40, fontWeight: '800', marginTop: 8 },
  heroUnit: { color: '#A3ADBA', fontSize: 13, fontWeight: '700', marginTop: 1 },
  portfolioValue: { color: '#D8BC7A', fontSize: 12, fontWeight: '800', marginTop: 16 },
  heroHint: { color: '#7F8A9B', lineHeight: 18, marginTop: 9, fontSize: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  menuTile: {
    width: '48%', minHeight: 100, backgroundColor: '#0C1119', borderWidth: 1,
    borderColor: '#1B2432', borderRadius: 18, padding: 15
  },
  menuTileAccent: { backgroundColor: '#111720', borderColor: '#655735' },
  menuTileIcon: { color: '#D8BC7A', fontSize: 18, marginBottom: 12, fontWeight: '900' },
  menuTileTitle: { color: '#F3F5F7', fontSize: 14, fontWeight: '800' },
  menuTileSubtitle: { color: '#788393', fontSize: 10, marginTop: 5 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 },
  menuSectionLabel: { color: '#778292', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 9, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  sectionKicker: { color: '#7D8795', fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 4 },
  sectionTitle: { color: '#F7F8FA', fontSize: 21, fontWeight: '800', marginBottom: 12, marginTop: 2 },
  inlineAction: { color: '#C8A968', fontSize: 11, fontWeight: '800', marginBottom: 12 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 18 },
  assetMini: {
    width: '48%', backgroundColor: '#0C1119', borderWidth: 1, borderColor: '#1B2432',
    borderRadius: 18, padding: 15, minHeight: 112
  },
  assetSelected: { borderColor: '#7A6740', backgroundColor: '#121821' },
  assetIcon: { color: '#D8BC7A', fontSize: 21, marginBottom: 8 },
  assetSymbol: { color: '#F7F8FA', fontSize: 15, fontWeight: '900' },
  assetBalance: { color: '#9AA4B2', fontSize: 12, marginTop: 6 },
  assetNameSmall: { color: '#6E7887', fontSize: 10, marginTop: 5 },
  staffCard: { backgroundColor: '#11151C', borderColor: '#655735' },
  staffEyebrow: { color: '#D8BC7A', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  staffOrb: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1B1A17',
    borderWidth: 1, borderColor: '#7A6740', alignItems: 'center', justifyContent: 'center'
  },
  staffOrbText: { color: '#E6C985', fontSize: 22, fontWeight: '900' },
  staffPrimaryAction: {
    flex: 1, backgroundColor: '#C8A968', borderRadius: 13, paddingVertical: 12,
    paddingHorizontal: 12, alignItems: 'center'
  },
  staffPrimaryActionText: { color: '#0B0F15', fontSize: 12, fontWeight: '900' },
  staffSecondaryAction: {
    flex: 1, backgroundColor: '#121821', borderWidth: 1, borderColor: '#2B3442',
    borderRadius: 13, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center'
  },
  staffSecondaryActionText: { color: '#E5E9EF', fontSize: 12, fontWeight: '800' },
  investmentCard: { backgroundColor: '#0D131D', borderColor: '#273243' },
  homeSecondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  homeSecondaryCard: {
    flex: 1, minHeight: 126, backgroundColor: '#0C1119', borderWidth: 1,
    borderColor: '#1B2432', borderRadius: 18, padding: 15
  },
  homeSecondaryKicker: { color: '#C8A968', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  homeSecondaryTitle: { color: '#F3F5F7', fontSize: 15, fontWeight: '800', marginTop: 8 },
  homeSecondaryText: { color: '#788393', fontSize: 11, lineHeight: 16, marginTop: 6 },
  highlightPremium: { backgroundColor: '#11151C', borderColor: '#655735' },
  highlightRecurring: { backgroundColor: '#0D1522', borderColor: '#273A54' },
  highlightTitle: { color: '#F7F8FA', fontSize: 20, fontWeight: '800', marginTop: 7 },
  highlightText: { color: '#929CAA', lineHeight: 19, fontSize: 13, marginTop: 7 },
  button: {
    backgroundColor: '#C8A968', borderWidth: 1, borderColor: '#D8BC7A',
    borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14
  },
  buttonSecondary: { backgroundColor: '#111720', borderColor: '#293548' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#0A0E14', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  buttonTextSecondary: { color: '#F2F4F7' },
  pageKicker: { color: '#C8A968', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  pageTitle: { color: '#F7F8FA', fontSize: 29, fontWeight: '800', marginBottom: 5 },
  pageSubtitle: { color: '#8F99A8', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alignRight: { alignItems: 'flex-end' },
  assetRowTitle: { color: '#F4F6F8', fontSize: 16, fontWeight: '800' },
  assetRowSymbol: { color: '#717B89', fontSize: 11, marginTop: 4 },
  assetRowAmount: { color: '#F7F8FA', fontSize: 16, fontWeight: '800' },
  assetRowValue: { color: '#939DAC', fontSize: 11, marginTop: 4 },
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
  previewNotice: { color: '#D8BC7A', fontSize: 11, lineHeight: 17, marginTop: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  smallAction: { flex: 1, backgroundColor: '#111720', borderWidth: 1, borderColor: '#293548', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  smallActionText: { color: '#E2E6EC', fontSize: 12, fontWeight: '900' },
  successText: { color: '#6FD0A3', fontWeight: '800', marginTop: 10, fontSize: 12 },
  benefit: { color: '#DEE3E9', lineHeight: 24, fontSize: 13, marginBottom: 5 },
  profileCard: { backgroundColor: '#0E141D', borderColor: '#273243' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#161B23',
    borderWidth: 1, borderColor: '#655735', alignItems: 'center', justifyContent: 'center'
  },
  profileAvatarText: { color: '#E5C57E', fontSize: 19, fontWeight: '900' },
  profileName: { color: '#F7F8FA', fontSize: 21, fontWeight: '800' },
  profileHandle: { color: '#9AA4B2', fontSize: 12, marginTop: 3 },
  profileDivider: { height: 1, backgroundColor: '#202A38', marginVertical: 16 },
  profileLabel: { color: '#737E8D', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 10 },
  profileValue: { color: '#E7EBF0', fontSize: 13, fontWeight: '700', marginTop: 4 },
  profileLine: { color: '#929CAA', fontSize: 13, marginBottom: 8 },
  profileSupportCard: { backgroundColor: '#10141B', borderColor: '#4E452E' },
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
  bottomActive: { color: '#D8BC7A' },
};