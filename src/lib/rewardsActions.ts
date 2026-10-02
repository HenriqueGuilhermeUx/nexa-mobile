import { Platform } from 'react-native';

import { config } from '@/config';

async function rewardsRequest<T>(
  accessToken: string,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
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
    const nested =
      payload?.message && typeof payload.message === 'object'
        ? payload.message
        : null;
    const raw =
      nested?.message ||
      payload?.message ||
      payload?.error?.message ||
      payload?.error ||
      nested?.code ||
      payload?.code;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : typeof raw === 'object'
        ? JSON.stringify(raw)
        : String(raw || `Falha no Nexa Rewards (${response.status}).`);
    const error = new Error(message) as Error & { code?: string; details?: any };
    error.code = String(
      payload?.code ||
        nested?.code ||
        payload?.error?.code ||
        '',
    );
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

export type RewardsAuthorizationAction =
  | 'diagnostic'
  | 'bridge'
  | 'deposit'
  | 'withdraw'
  | 'return';

export type RewardsAuthorizationExecution = {
  idempotencyKey: string;
  nonce: string;
  referenceId: string;
  rawAmount?: string;
};

export type RewardsAuthorizationPrepared = {
  success: boolean;
  action: RewardsAuthorizationAction;
  request: {
    version: 1;
    method: 'POST';
    url: string;
    body: Record<string, unknown>;
    headers: {
      'privy-app-id': string;
      'privy-idempotency-key': string;
    };
  };
  execution: RewardsAuthorizationExecution;
};

export type RewardsAuthorizationProof = RewardsAuthorizationExecution & {
  signature: string;
};

export function prepareRewardsAuthorization(
  accessToken: string,
  action: RewardsAuthorizationAction,
  input: { amountUsdc?: number; full?: boolean } = {},
) {
  return rewardsRequest<RewardsAuthorizationPrepared>(
    accessToken,
    '/rewards/v2/authorization-request',
    {
      method: 'POST',
      body: { action, ...input },
    },
  );
}

export function runRewardsAuthorizationDiagnostic(
  accessToken: string,
  authorization: RewardsAuthorizationProof,
) {
  return rewardsRequest<any>(
    accessToken,
    '/rewards/v2/authorization-diagnostic',
    {
      method: 'POST',
      body: { authorization },
    },
  );
}

export function bridgeRewardsToBase(
  accessToken: string,
  amountUsdc: number,
  authorization: RewardsAuthorizationProof,
  clientOperationId?: string,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/bridge-to-base', {
    method: 'POST',
    body: { amountUsdc, authorization, clientOperationId },
  });
}

export function depositRewards(
  accessToken: string,
  amountUsdc: number,
  authorization: RewardsAuthorizationProof,
  clientOperationId?: string,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/deposit', {
    method: 'POST',
    body: { amountUsdc, authorization, clientOperationId },
  });
}

export function withdrawRewardsFull(
  accessToken: string,
  authorization: RewardsAuthorizationProof,
  clientOperationId?: string,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/withdraw', {
    method: 'POST',
    body: { full: true, authorization, clientOperationId },
  });
}

export function returnRewardsToWallet(
  accessToken: string,
  amountUsdc: number,
  authorization: RewardsAuthorizationProof,
  clientOperationId?: string,
) {
  return rewardsRequest<any>(accessToken, '/rewards/v2/return-to-wallet', {
    method: 'POST',
    body: { amountUsdc, authorization, clientOperationId },
  });
}

export function getRewardsAction(accessToken: string, actionId: string) {
  return rewardsRequest<any>(
    accessToken,
    `/rewards/v2/action/${encodeURIComponent(actionId)}`,
  );
}


export function getRewardsActivity(accessToken: string, limit = 20) {
  return rewardsRequest<any>(
    accessToken,
    `/rewards/v2/activity?limit=${encodeURIComponent(String(limit))}`,
  );
}

export function getRewardsActivityDetail(
  accessToken: string,
  operationId: string,
) {
  return rewardsRequest<any>(
    accessToken,
    `/rewards/v2/activity/${encodeURIComponent(operationId)}`,
  );
}
