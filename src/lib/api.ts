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
  if (!accessToken) throw new Error('O login Nexa não retornou uma sessão válida.');
  return { accessToken, refreshToken };
}

export const nexaApi = {
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(accessToken: string) {
    return request<any>('/user/me', { accessToken });
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

  listOrders(accessToken: string) {
    return request<any>('/direct-settlement/orders', { accessToken });
  },

  createEntryOrder(
    accessToken: string,
    data: { amountBrl: number; clientRequestId: string; plan?: 'FREE' | 'PRO' },
  ) {
    return request<any>('/direct-settlement/orders/entry', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(data),
    });
  },

  createExitOrder(
    accessToken: string,
    data: { amountUsdc: number; clientRequestId: string; plan?: 'FREE' | 'PRO' },
  ) {
    return request<any>('/direct-settlement/orders/exit', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(data),
    });
  },

  joinEarlyAccess(data: Record<string, unknown>) {
    return request<any>('/early-access/join', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
