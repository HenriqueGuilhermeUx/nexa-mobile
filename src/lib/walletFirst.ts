import { Platform } from 'react-native';

import { config } from '@/config';

type Options = RequestInit & { accessToken: string };

async function walletFirstRequest<T>(path: string, options: Options): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${options.accessToken}`);
  headers.set('X-Nexa-App-Version', config.appVersion);
  headers.set('X-Nexa-App-Build', config.appBuild);
  headers.set('X-Nexa-Platform', Platform.OS);

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
    const raw = payload?.message || payload?.error || payload?.code;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'object'
        ? JSON.stringify(raw)
        : String(raw || `Falha na API (${response.status}).`);
    const error = new Error(message) as Error & {
      status?: number;
      code?: string;
      details?: unknown;
    };
    error.status = response.status;
    error.code = payload?.code;
    error.details = payload;
    throw error;
  }

  return payload as T;
}

export const walletFirstApi = {
  createOwnershipChallenge(accessToken: string) {
    return walletFirstRequest<any>('/wallet-v15/wallet-ownership/challenge', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({}),
    });
  },

  verifyOwnershipSignature(accessToken: string, signature: string) {
    return walletFirstRequest<any>('/wallet-v15/wallet-ownership/verify', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ signature }),
    });
  },

  readiness(accessToken: string) {
    return walletFirstRequest<any>(
      '/direct-settlement/wallet-first/usdc-pilot/readiness',
      { method: 'GET', accessToken },
    );
  },
};
