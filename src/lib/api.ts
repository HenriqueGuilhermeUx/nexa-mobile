import { Platform } from 'react-native';
import { router } from 'expo-router';

import { config } from '@/config';
import { notifyForceUpdateRequired } from '@/lib/forceUpdate';
import {
  parseRecurringFundingIntent,
  recurringIntentSummary,
} from '@/lib/nexaRecurringIntent';

interface ApiOptions extends RequestInit {
  accessToken?: string;
  privyAccessToken?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function messageFromPayload(payload: any, status: number) {
  const raw = payload?.message || payload?.error || payload?.code;
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw && typeof raw === 'object') return JSON.stringify(raw);
  return String(raw || `Falha na API (${status}).`);
}

async function request<T>(
  path: string,
  options: ApiOptions = {},
  baseUrl = config.apiUrl,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('X-Nexa-App-Version', config.appVersion);
  headers.set('X-Nexa-App-Build', config.appBuild);
  headers.set('X-Nexa-Platform', Platform.OS);

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }
  if (options.privyAccessToken) {
    headers.set('x-privy-access-token', `Bearer ${options.privyAccessToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    if (
      response.status === 426 &&
      String(payload?.code || '') === 'APP_UPDATE_REQUIRED'
    ) {
      notifyForceUpdateRequired(payload);
    }

    throw new ApiError(
      messageFromPayload(payload, response.status),
      response.status,
      payload?.code,
      payload,
    );
  }
  return payload as T;
}

export interface NexaUserSummary {
  id?: string;
  email?: string;
  cpf?: string | null;
  residenceCountry?: string;
  fullName?: string;
  phone?: string | null;
  username?: string | null;
  handle?: string | null;
  nexaId?: string | null;
  kycStatus?: 'pending' | 'in_review' | 'approved' | 'rejected' | string;
  kycVerifiedAt?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixWithdrawEnabled?: boolean;
  wallet?: {
    address?: string | null;
    provider?: string | null;
    network?: string | null;
  };
}

export interface LoginResponse {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  token?: string;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
  user?: NexaUserSummary;
}

export interface RegistrationData {
  fullName: string;
  email: string;
  cpf?: string;
  countryCode?: string;
  phone?: string;
  password: string;
}

export interface CountryCapabilities {
  countryCode: string;
  market?: string;
  onboarding?: {
    status?: 'active' | 'preview' | 'unavailable' | string;
    registrationEnabled?: boolean;
    kycProvider?: string;
    documentModel?: string;
  };
  wallet?: {
    status?: 'active' | 'preview' | 'unavailable' | string;
    provider?: string;
    sourceOfTruth?: string;
  };
  funding?: Record<string, string>;
  payout?: Record<string, string>;
  globalAccount?: string;
  cards?: string;
  stablecoins?: Record<string, string>;
}

export interface BrazilKycStatus {
  success: boolean;
  provider?: string;
  flow?: string | null;
  kycStatus: 'pending' | 'in_review' | 'approved' | 'rejected' | string;
  diditSessionId?: string | null;
  diditSessionStatus?: string | null;
  outcomeCode?: string | null;
  matchType?: string | null;
  documentFallbackRequired?: boolean;
  manualReviewRequired?: boolean;
  verificationUrl?: string | null;
  nextAction?:
    | 'approved'
    | 'start_verification'
    | 'resume_verification'
    | 'document_fallback'
    | 'manual_review'
    | 'retry_selfie'
    | 'wait'
    | string;
  kycVerifiedAt?: string | null;
  alreadyApproved?: boolean;
}

export interface PixRedemption {
  id: string;
  userId: string;
  amountBrl: number | string;
  amountUsdc: number | string;
  exchangeRate: number | string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  payoutModel?: 'actual_sale_net' | 'fixed_brl_legacy' | string;
  estimatedAmountBrl?: number | string | null;
  settledAmountBrl?: number | string | null;
  saleProceedsBrl?: number | string | null;
  nexaFeeBrl?: number | string | null;
  pixOutFeeBrl?: number | string | null;
  pixKey?: string | null;
  pixReference?: string | null;
  externalId?: string | null;
  endToEndId?: string | null;
  failureReason?: string | null;
  settlementMetadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  completedAt?: string | null;
}

export interface AssistantCapabilities {
  enabled: boolean;
  mode?: string;
  brandSurface?: string;
  engine?: string;
  scopes?: string[];
  financialContext?: string;
  financialExecution?: boolean;
  paymentPreparation?: boolean;
  paymentExecution?: boolean;
  embeddedExperience?: boolean;
}

export interface StaffAttentionItem {
  id: string;
  source: 'docwallet' | 'healthwallet';
  kind: string;
  title: string;
  summary: string;
  dueAt?: string | null;
  count?: number | null;
  action?: 'open_docwallet' | 'open_healthwallet';
}

export interface StaffAttentionResponse {
  success: boolean;
  enabled: boolean;
  mode?: string;
  items: StaffAttentionItem[];
  sources?: Array<{
    source: 'docwallet' | 'healthwallet';
    status: string;
    itemCount: number;
  }>;
  sensitivePayloadIncluded?: boolean;
}

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatResponse {
  success: boolean;
  mode?: string;
  response: string;
  capabilities?: AssistantCapabilities;
  engineMetadata?: {
    bridgeVersion?: string | null;
    memoryMode?: string | null;
  };
}

export interface NexaIdAccessTokenResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  message?: string;
}

export function tokensFromLogin(response: LoginResponse) {
  const accessToken =
    response.accessToken ||
    response.access_token ||
    response.token ||
    response.tokens?.accessToken;
  const refreshToken =
    response.refreshToken ||
    response.refresh_token ||
    response.tokens?.refreshToken ||
    null;
  if (!accessToken) throw new Error('A Nexa não retornou uma sessão válida.');
  return { accessToken, refreshToken };
}

function normalizeDirectProfile(response: any) {
  const profile = response?.profile || response || {};
  const status = String(profile?.status || '').trim().toLowerCase();

  if (status !== 'pilot') return response;

  const normalizedProfile = {
    ...profile,
    isLegacyBeta: false,
    settlementProfile: 'wallet_first_pilot',
  };

  if (response?.profile) {
    return {
      ...response,
      profile: normalizedProfile,
    };
  }

  return normalizedProfile;
}

export const nexaApi = {
  countryCapabilities(countryCode: string) {
    return request<CountryCapabilities>(
      `/nexa-rails/v1/capabilities/${encodeURIComponent(countryCode)}`,
    );
  },

  register(data: RegistrationData) {
    return request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  refresh(refreshToken: string) {
    return request<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  me(accessToken: string) {
    return request<any>('/user/me', { accessToken });
  },

  createNexaIdAccessToken(accessToken: string) {
    return request<NexaIdAccessTokenResponse>('/nexa-id/access-token-secure', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({}),
    });
  },

  assistantCapabilities(accessToken: string) {
    return request<AssistantCapabilities>('/staff/capabilities', {
      accessToken,
    });
  },

  assistantAttention(accessToken: string) {
    return request<StaffAttentionResponse>('/staff/attention', {
      accessToken,
    });
  },

  assistantChat(
    accessToken: string,
    message: string,
    conversationHistory: AssistantChatMessage[] = [],
  ) {
    const recurringIntent = config.efiOpenFinanceEnabled
      ? parseRecurringFundingIntent(message)
      : null;

    if (recurringIntent) {
      const summary = recurringIntentSummary(recurringIntent);
      const bankCopy = recurringIntent.bankHint
        ? ` do ${recurringIntent.bankHint}`
        : '';

      setTimeout(() => {
        router.push({
          pathname: '/open-finance-recurring',
          params: {
            amount: String(recurringIntent.amountBrl),
            day: String(recurringIntent.dayOfMonth),
            bank: recurringIntent.bankHint || '',
          },
        });
      }, 500);

      return Promise.resolve<AssistantChatResponse>({
        success: true,
        mode: 'local-financial-preparation',
        response:
          `Entendi: ${summary}${bankCopy}. Vou abrir a preparação dessa recorrência para você revisar. ` +
          'Nenhuma movimentação será feita agora; a criação só acontece depois da sua confirmação na Nexa e autorização no seu banco.',
      });
    }

    return request<AssistantChatResponse>('/staff/chat', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({
        message,
        conversationHistory,
      }),
    });
  },

  startBrazilKyc(accessToken: string, consent = true) {
    return request<BrazilKycStatus>('/kyc/didit/brazil/start', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ consent }),
    });
  },

  startGlobalKyc(accessToken: string, consent = true) {
    return request<BrazilKycStatus>('/kyc/didit/global/start', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ consent }),
    });
  },

  getMyKycStatus(accessToken: string) {
    return request<BrazilKycStatus>('/kyc/didit/me', { accessToken });
  },

  getMyGlobalKycStatus(accessToken: string) {
    return request<BrazilKycStatus>('/kyc/didit/global/me', { accessToken });
  },

  configurePayoutOnboarding(
    accessToken: string,
    pixKeyType: 'CPF' | 'EMAIL' | 'PHONE',
  ) {
    return request<any>('/d1-payout/onboarding', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ pixKeyType }),
    });
  },

  payoutSubaccountStatus(accessToken: string) {
    return request<any>('/d1-payout/subaccount/me', { accessToken });
  },

  async directProfile(accessToken: string) {
    const response = await request<any>('/direct-settlement/profile', { accessToken });
    return normalizeDirectProfile(response);
  },

  linkWallet(
    accessToken: string,
    privyAccessToken: string,
    wallet: { privyWalletId: string; walletAddress: string },
  ) {
    return request<any>('/direct-settlement/wallet/link', {
      method: 'POST',
      accessToken,
      privyAccessToken,
      body: JSON.stringify(wallet),
    });
  },

  auditWallet(accessToken: string) {
    return request<any>('/direct-settlement/wallet/audit', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({}),
    });
  },

  listOrders(accessToken: string) {
    return request<any>('/direct-settlement/orders', { accessToken });
  },

  listPixRedemptions(accessToken: string) {
    return request<PixRedemption[]>('/payment/user', { accessToken });
  },

  listFiatDeposits(accessToken: string) {
    return request<any[]>('/fiat-deposit/list', { accessToken });
  },

  createWalletFirstPixCharge(accessToken: string, amountBrl: number) {
    return request<any>('/fiat-deposit/woovi/create-charge', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ amountBrl }),
    });
  },

  reconcileWalletFirstPixCharge(accessToken: string, correlationID: string) {
    return request<any>('/fiat-deposit/woovi/reconcile-controlled-charge', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ correlationID }),
    });
  },

  getWalletFirstPixStatus(accessToken: string, correlationID: string) {
    return request<any>(
      `/fiat-deposit/wallet-first/status/${encodeURIComponent(correlationID)}`,
      { accessToken },
    );
  },

  getPixRedemption(accessToken: string, paymentId: string) {
    return request<PixRedemption>(
      `/payment/status/${encodeURIComponent(paymentId)}`,
      { accessToken },
    );
  },

  createEntryOrder(
    accessToken: string,
    data: { grossBrl: number; clientRequestId: string },
  ) {
    return request<any>('/direct-settlement/orders/entry', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(data),
    });
  },

  createExitOrder(
    accessToken: string,
    data: { amountUsdc: number; clientRequestId: string },
  ) {
    return request<any>('/direct-settlement/orders/exit', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(data),
    });
  },

  nexaPayPremiumPreview(
    accessToken: string,
    data: {
      instrument: 'BARCODE' | 'PIX_QR' | 'PIX_COPY_PASTE';
      payload: string;
      amountBrl?: number;
      scheduledFor: string;
    },
  ) {
    return request<any>(
      '/nexa-pay/v1/premium/preview',
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify(data),
      },
      config.nexaPayApiUrl,
    );
  },

  nexaPayPremiumSchedule(
    accessToken: string,
    data: {
      instrument: 'BARCODE' | 'PIX_QR' | 'PIX_COPY_PASTE';
      payload: string;
      amountBrl?: number;
      scheduledFor: string;
      maximumUsdcApproved: number;
      clientRequestId: string;
    },
  ) {
    return request<any>(
      '/nexa-pay/v1/premium/schedule',
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify(data),
      },
      config.nexaPayApiUrl,
    );
  },

  nexaPayPremiumMine(accessToken: string) {
    return request<any[]>(
      '/nexa-pay/v1/premium/mine',
      { accessToken },
      config.nexaPayApiUrl,
    );
  },

  nexaPayPremiumConfirmWalletTransfer(
    accessToken: string,
    paymentId: string,
    txHash: string,
  ) {
    return request<any>(
      `/nexa-pay/v1/premium/${encodeURIComponent(paymentId)}/wallet-transfer`,
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ txHash }),
      },
      config.nexaPayApiUrl,
    );
  },

  nexaPayPremiumCancel(accessToken: string, paymentId: string) {
    return request<any>(
      `/nexa-pay/v1/premium/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({}),
      },
      config.nexaPayApiUrl,
    );
  },

  requestPixRedemption(
    accessToken: string,
    data: { amountUsdc: number; pixKey: string },
  ) {
    return request<any>('/payment/pix/redemption', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(data),
    });
  },
};
