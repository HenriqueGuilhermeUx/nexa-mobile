import { Platform } from 'react-native';

import { config } from '@/config';

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

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
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

  const response = await fetch(`${config.apiUrl}${path}`, {
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
  cpf?: string;
  fullName?: string;
  phone?: string | null;
  username?: string | null;
  handle?: string | null;
  nexaId?: string | null;
  kycStatus?: 'pending' | 'in_review' | 'approved' | 'rejected' | string;
  kycVerifiedAt?: string | null;
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
  cpf: string;
  phone?: string;
  password: string;
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

export interface WalletV15OwnershipChallenge {
  success: boolean;
  proofVersion: 'eip191_v1' | string;
  destinationWallet: string;
  chainId: number;
  signingMethod: string;
  message: string;
  messageHash: string;
  expiresAt: string;
  financialAction: false;
}

export interface WalletV15OwnershipVerification {
  success: boolean;
  confirmed: boolean;
  proofVersion: string;
  chainId: number;
  destinationWallet: string;
  recoveredAddress: string;
  financialAction: false;
  profile?: any;
}

export interface WalletV15Snapshot {
  success: boolean;
  status?: any;
  balances?: {
    operationalUsdc?: number | string;
    pendingSettlementUsdc?: number | string;
    settledOnchainJournalUsdc?: number | string;
    [key: string]: unknown;
  };
  portfolio?: any;
}

export interface WooviPixCharge {
  success: boolean;
  provider?: string;
  correlationID?: string;
  amountBrl?: number;
  valueInCents?: number;
  charge?: any;
  message?: any;
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

export const nexaApi = {
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

  me(accessToken: string) {
    return request<any>('/user/me', { accessToken });
  },

  startBrazilKyc(accessToken: string, consent = true) {
    return request<BrazilKycStatus>('/kyc/didit/brazil/start', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ consent }),
    });
  },

  getMyKycStatus(accessToken: string) {
    return request<BrazilKycStatus>('/kyc/didit/me', { accessToken });
  },

  directProfile(accessToken: string) {
    return request<any>('/direct-settlement/profile', { accessToken });
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

  prepareWalletV15Me(accessToken: string) {
    return request<any>('/wallet-v15/prepare-me', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({}),
    });
  },

  walletV15Me(accessToken: string) {
    return request<WalletV15Snapshot>('/wallet-v15/me', { accessToken });
  },

  setWalletV15Destination(accessToken: string, destinationWallet: string) {
    return request<any>('/wallet-v15/destination-wallet', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ destinationWallet }),
    });
  },

  createWalletV15OwnershipChallenge(accessToken: string) {
    return request<WalletV15OwnershipChallenge>(
      '/wallet-v15/wallet-ownership/challenge',
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({}),
      },
    );
  },

  verifyWalletV15Ownership(accessToken: string, signature: string) {
    return request<WalletV15OwnershipVerification>(
      '/wallet-v15/wallet-ownership/verify',
      {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ signature }),
      },
    );
  },

  createWalletV15WooviCharge(accessToken: string, amountBrl: number) {
    return request<WooviPixCharge>('/fiat-deposit/woovi/create-charge', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ amountBrl }),
    });
  },

  listWalletV15FiatDeposits(accessToken: string) {
    return request<any[]>('/fiat-deposit/list', { accessToken });
  },

  listOrders(accessToken: string) {
    return request<any>('/direct-settlement/orders', { accessToken });
  },

  listPixRedemptions(accessToken: string) {
    return request<PixRedemption[]>('/payment/user', { accessToken });
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
