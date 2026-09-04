import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
      <Text style={styles.buttonText}>{title}</Text>
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
    ['send', '↑', 'Enviar'],
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
        body: JSON.stringify({}),
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

  async function createPixDeposit() {
    const value = Number(String(depositAmountBrl).replace(',', '.'));
    if (!value || value < 10) return setMessage('Depósito Pix mínimo: R$ 10,00.');
    if (!config.financialExecutionEnabled) {
      return setMessage('Geração de cobrança Pix está bloqueada neste build de preview.');
    }
    try {
      setLoading(true);
      setDepositResult(null);
      const data = await json(`${API}/deposit/woovi-pix`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ amountBrl: value }),
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
      const data = await json(`${API}/withdrawal/pix-quote`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ amountUsdc: value }),
      });
      setWithdrawQuote(data);
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
      const data = await json(`${API}/withdrawal/pix-request`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amountUsdc: value,
          expectedNetBrl: Number(withdrawQuote?.netBrl || 0),
          pixKey: key,
          clientRequestId:
            pixOutRequestId || newClientRequestId('mobile_pixout', user.id),
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

  const contentBottom = 92 + Math.max(insets.bottom, 10);

  function Home() {
    return (
      <>
        <View style={styles.homeTop}>
          <View>
            <Text style={styles.hello}>Olá, {firstName}</Text>
            <Text style={styles.handle}>{handle}</Text>
          </View>
          <TouchableOpacity onPress={() => setPage('menu')} style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.heroCard}>
          <Text style={styles.eyebrow}>SALDO NEXA</Text>
          <Text style={styles.heroAmount}>{amount(balances.USDC, 6)}</Text>
          <Text style={styles.heroUnit}>USDC</Text>
          <Text style={styles.heroHint}>Disponível para Pix, transferências Nexa e uso dentro da plataforma.</Text>
        </Card>

        <View style={styles.quickRow}>
          <MenuTile icon="＋" title="Pix" subtitle="Adicionar" onPress={() => setPage('deposit')} />
          <MenuTile icon="↑" title="Enviar" subtitle="USDC" onPress={() => setPage('send')} />
          <MenuTile icon="◇" title="Ativos" subtitle="BTC · ETH · Ouro" onPress={() => setPage('assets')} accent />
          <MenuTile icon="☰" title="Mais" subtitle="Serviços" onPress={() => setPage('menu')} />
        </View>

        <Text style={styles.sectionTitle}>Ativos disponíveis</Text>
        <View style={styles.assetGrid}>
          {portfolioPositions.map((item) => (
            <TouchableOpacity key={item.symbol} style={styles.assetMini} onPress={() => { setAsset(item.symbol === 'USDC' ? 'BTC' : item.symbol); setPage(item.symbol === 'USDC' ? 'wallet' : 'assets'); }}>
              <Text style={styles.assetIcon}>{item.icon}</Text>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetBalance}>{amount(item.amount, 6)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.highlightPremium}>
          <Text style={styles.premiumEyebrow}>{isPremium ? 'PREMIUM ATIVO' : 'NEXA PREMIUM'}</Text>
          <Text style={styles.highlightTitle}>{isPremium ? 'Sua experiência ampliada.' : 'Mais autonomia dentro e fora da Nexa.'}</Text>
          <Text style={styles.highlightText}>
            {isPremium
              ? 'Taxas menores, carteira individual e recursos adicionais de movimentação.'
              : 'Taxas menores, carteira individual, recebimento externo e recursos on-chain.'}
          </Text>
          <PrimaryButton title={isPremium ? 'Ver meus recursos Premium' : 'Conhecer Nexa Premium'} onPress={() => setPage('premium')} secondary />
        </Card>

        <Card style={styles.highlightRecurring}>
          <Text style={styles.eyebrow}>USDC POR ASSINATURA</Text>
          <Text style={styles.highlightTitle}>{recurring ? 'Sua recorrência está configurada.' : 'USDC todo mês, do seu jeito.'}</Text>
          <Text style={styles.highlightText}>Escolha valor e dia do mês. A Nexa organiza a recorrência via Pix.</Text>
          <PrimaryButton title={recurring ? 'Gerenciar recorrência' : 'Configurar recorrência'} onPress={() => setPage('recurring')} secondary />
        </Card>

        <Card>
          <Text style={styles.eyebrow}>NEXA REWARDS</Text>
          <Text style={styles.highlightTitle}>Benefícios por usar a Nexa.</Text>
          <Text style={styles.highlightText}>Campanhas, vantagens e posições Rewards em uma área própria.</Text>
          <PrimaryButton title="Abrir Rewards" onPress={() => setPage('rewards')} secondary />
        </Card>
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
    return (
      <>
        <Text style={styles.pageTitle}>Nexa Rewards</Text>
        <Text style={styles.pageSubtitle}>Benefícios, campanhas e vantagens vinculadas ao uso da Nexa.</Text>
        <Card>
          <Text style={styles.eyebrow}>STATUS</Text>
          <Text style={styles.highlightTitle}>{rewardPositions.length ? `${rewardPositions.length} posição(ões) ativa(s)` : 'Nenhuma posição ativa'}</Text>
          <Text style={styles.highlightText}>Rewards reúne benefícios e campanhas conforme regras vigentes.</Text>
        </Card>
        <Text style={styles.sectionTitle}>Programas disponíveis</Text>
        {rewardPlans.length ? rewardPlans.map((plan: any, index: number) => (
          <Card key={plan.id || plan.code || index}>
            <Text style={styles.assetRowTitle}>{plan.name || plan.title || plan.plan || 'Rewards'}</Text>
            <Text style={styles.highlightText}>{plan.description || plan.subtitle || 'Benefícios Nexa conforme regras vigentes da campanha.'}</Text>
          </Card>
        )) : <Card><Text style={styles.highlightText}>Nenhum programa publicado no momento.</Text></Card>}
      </>
    );
  }

  function Menu() {
    return (
      <>
        <Text style={styles.pageTitle}>Menu</Text>
        <Text style={styles.pageSubtitle}>Acesse sua conta e os serviços Nexa.</Text>
        <View style={styles.menuGrid}>
          <MenuTile icon="👤" title="Perfil" onPress={() => setPage('profile')} />
          <MenuTile icon="↕" title="Movimentações" onPress={() => setPage('history')} />
          <MenuTile icon="🆔" title="Nexa ID" subtitle={nexaId || handle} onPress={() => setPage('nexaId')} />
          <MenuTile icon="💳" title="Depositar Pix" subtitle="Adicionar saldo" onPress={() => setPage('deposit')} />
          <MenuTile icon="🏦" title="Sacar Pix" subtitle="USDC → BRL" onPress={() => setPage('withdraw')} />
          <MenuTile icon="⭐" title="Premium" subtitle={isPremium ? 'Ativo' : 'Conhecer'} onPress={() => setPage('premium')} accent />
          <MenuTile icon="🔁" title="USDC assinatura" onPress={() => setPage('recurring')} />
          <MenuTile icon="✦" title="Rewards" onPress={() => setPage('rewards')} />
          <MenuTile
            icon="🔐"
            title="Minha Carteira"
            subtitle={canAccessCustody ? (isPremium ? 'Premium' : 'Carteira existente') : 'Recurso Premium'}
            onPress={() => setPage(canAccessCustody ? 'custody' : 'premium')}
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
            onChangeText={setDepositAmountBrl}
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
        <Text style={styles.pageTitle}>Perfil</Text>
        <Card>
          <Text style={styles.profileName}>{user?.fullName}</Text>
          <Text style={styles.profileLine}>{handle}</Text>
          <Text style={styles.profileLine}>{user?.email}</Text>
          <Text style={styles.profileLine}>KYC: {String(user?.kycStatus || 'pending')}</Text>
          <Text style={styles.profileLine}>Plano: {isPremium ? 'Nexa Premium' : 'Nexa'}</Text>
          {walletAddress ? <Text style={styles.profileLine}>Carteira: {walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</Text> : null}
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
          <Text style={styles.brand}>NEXA</Text>
          <Text style={styles.brandTag}>Cripto sem complicação.</Text>
        </View>
        {message ? (
          <TouchableOpacity onPress={() => setMessage('')} style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </TouchableOpacity>
        ) : null}
        {loading && !body ? <ActivityIndicator color="#60a5fa" /> : body}
      </ScrollView>
      <BottomNav page={page} onNavigate={setPage} />
    </View>
  );
}

const styles: any = {
  root: { flex: 1, backgroundColor: '#020617' },
  scroll: { flex: 1, paddingHorizontal: 18 },
  brandRow: { alignItems: 'center', marginBottom: 20 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 2.5 },
  brandTag: { color: '#7c9cc7', fontSize: 12, marginTop: 3 },
  homeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  hello: { color: '#fff', fontSize: 26, fontWeight: '900' },
  handle: { color: '#60a5fa', fontSize: 13, fontWeight: '800', marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#172033', borderWidth: 1, borderColor: '#29364d', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  card: { backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#1e293b', borderRadius: 22, padding: 18, marginBottom: 14 },
  heroCard: { backgroundColor: '#0d1b32', borderColor: '#244980' },
  eyebrow: { color: '#7dd3fc', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  premiumEyebrow: { color: '#c4b5fd', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  heroAmount: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 8 },
  heroUnit: { color: '#94a3b8', fontSize: 15, fontWeight: '800', marginTop: 2 },
  heroHint: { color: '#7c8da3', lineHeight: 18, marginTop: 12, fontSize: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  menuTile: { width: '48%', minHeight: 104, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#1e293b', borderRadius: 20, padding: 15 },
  menuTileAccent: { backgroundColor: '#12213e', borderColor: '#244980' },
  menuTileIcon: { color: '#fff', fontSize: 20, marginBottom: 10 },
  menuTileTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  menuTileSubtitle: { color: '#64748b', fontSize: 10, marginTop: 5 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 12, marginTop: 2 },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 18 },
  assetMini: { width: '48%', backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#1e293b', borderRadius: 20, padding: 15, minHeight: 115 },
  assetSelected: { borderColor: '#3b82f6', backgroundColor: '#12213e' },
  assetIcon: { color: '#fff', fontSize: 22, marginBottom: 8 },
  assetSymbol: { color: '#fff', fontSize: 15, fontWeight: '900' },
  assetBalance: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  assetNameSmall: { color: '#64748b', fontSize: 10, marginTop: 5 },
  highlightPremium: { backgroundColor: '#171225', borderColor: '#5b3f88' },
  highlightRecurring: { backgroundColor: '#0d1b32', borderColor: '#244980' },
  highlightTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 7 },
  highlightText: { color: '#94a3b8', lineHeight: 19, fontSize: 13, marginTop: 7 },
  button: { backgroundColor: '#2563eb', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 15, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14 },
  buttonSecondary: { backgroundColor: '#111c2f', borderColor: '#263650' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  pageTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 5 },
  pageSubtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alignRight: { alignItems: 'flex-end' },
  assetRowTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  assetRowSymbol: { color: '#64748b', fontSize: 11, marginTop: 4 },
  assetRowAmount: { color: '#fff', fontSize: 16, fontWeight: '900' },
  assetRowValue: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  formLabel: { color: '#cbd5e1', fontWeight: '800', fontSize: 12, marginTop: 14, marginBottom: 7 },
  input: { backgroundColor: '#07101e', borderWidth: 1, borderColor: '#263650', color: '#fff', borderRadius: 14, padding: 14, fontSize: 15 },
  quoteBox: { backgroundColor: '#07101e', borderWidth: 1, borderColor: '#263650', borderRadius: 16, padding: 14, marginTop: 12 },
  quoteTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  quoteText: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#1e293b', marginVertical: 18 },
  qrWrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 16, marginBottom: 10 },
  codeText: { color: '#94a3b8', fontSize: 10, lineHeight: 15, marginTop: 6 },
  previewNotice: { color: '#fbbf24', fontSize: 11, lineHeight: 17, marginTop: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  smallAction: { flex: 1, backgroundColor: '#111c2f', borderWidth: 1, borderColor: '#263650', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  smallActionText: { color: '#e2e8f0', fontSize: 12, fontWeight: '900' },
  successText: { color: '#34d399', fontWeight: '800', marginTop: 10, fontSize: 12 },
  benefit: { color: '#e2e8f0', lineHeight: 24, fontSize: 13, marginBottom: 5 },
  profileName: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  profileLine: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  credit: { color: '#34d399', fontWeight: '900', fontSize: 12 },
  debit: { color: '#fb7185', fontWeight: '900', fontSize: 12 },
  messageBox: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#263650', borderRadius: 14, padding: 12, marginBottom: 14 },
  messageText: { color: '#e2e8f0', fontSize: 12, lineHeight: 17 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#1e293b', flexDirection: 'row', paddingTop: 8, paddingHorizontal: 4 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 52, paddingVertical: 4 },
  bottomIcon: { color: '#64748b', fontSize: 19, fontWeight: '900' },
  bottomLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', marginTop: 4 },
  bottomActive: { color: '#60a5fa' },
};