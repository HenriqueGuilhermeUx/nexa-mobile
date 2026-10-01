import { Platform } from 'react-native';

import { config } from '@/config';

async function rewardsRequest<T>(
  accessToken: string,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    privyUserJwt?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'X-Nexa-App-Version': config.appVersion,
    'X-Nexa-App-Build': config.appBuild,
    'X-Nexa-Platform': Platform.OS,
  };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.privyUserJwt) {
    headers['x-privy-user-jwt'] = options.privyUserJwt;
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
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
        : String(raw || `Falha no Nexa Rewards (${response.status}).`);
    const error = new Error(message) as Error & { code?: string; details?: any };
    error.code = String(payload?.code || '');
    error.details = payload;
    throw error;
  }

  return payload as T;
}

export function getRewardsVault(accessToken: string) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/vault');
}

export function getRewardsPosition(accessToken: string) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/position');
}

export function getRewardsWalletBalances(accessToken: string) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/wallet-balances');
}

export function getRewardsBridgeQuote(accessToken: string, amountUsdc: number) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/bridge-quote', {
    method: 'POST',
    body: { amountUsdc },
  });
}

export function bridgeRewardsToBase(
  accessToken: string,
  privyUserJwt: string,
  amountUsdc: number,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/bridge-to-base', {
    method: 'POST',
    privyUserJwt,
    body: { amountUsdc },
  });
}

export function depositRewards(
  accessToken: string,
  privyUserJwt: string,
  amountUsdc: number,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/deposit', {
    method: 'POST',
    privyUserJwt,
    body: { amountUsdc },
  });
}

export function withdrawRewardsFull(
  accessToken: string,
  privyUserJwt: string,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/withdraw', {
    method: 'POST',
    privyUserJwt,
    body: { full: true },
  });
}

export function returnRewardsToWallet(
  accessToken: string,
  privyUserJwt: string,
  amountUsdc: number,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/return-to-wallet', {
    method: 'POST',
    privyUserJwt,
    body: { amountUsdc },
  });
}

export function getRewardsAction(accessToken: string, actionId: string) {
  return rewardsRequest<any>(
    accessToken,
    `/rewards/v2/action/${encodeURIComponent(actionId)}`,
  );
}
