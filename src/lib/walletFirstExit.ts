import { Platform } from 'react-native';

import { config } from '@/config';

export interface WalletFirstExitQuote {
  label: string;
  asset: 'USDC' | string;
  settlementCurrency: 'BRL' | string;
  amountUsdc: number;
  nexaRateBrl: number;
  estimatedPayoutBrl: number;
  validForSeconds: number;
  expiresAt: string;
  indicative: boolean;
}

export type WalletFirstExitSponsorshipCredentials = {
  success: true;
  chainId: 137;
  wallet: string;
  mode: 'client_sponsored_eip7702';
  gasSponsoredByNexa: true;
  jwt: string;
  policyId: string;
  expiresAt: string;
};

function headers(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'X-Nexa-App-Version': config.appVersion,
    'X-Nexa-App-Build': config.appBuild,
    'X-Nexa-Platform': Platform.OS,
  };
}

function apiError(payload: any, status: number, fallback: string) {
  // Exit rollout readiness must never expose pilot configuration or technical
  // flags to a customer. Funds remain in the customer's own Privy wallet.
  const code = String(payload?.code || payload?.error?.code || payload?.message || '');
  const blockers = Array.isArray(payload?.blockers) ? payload.blockers.map(String) : [];
  if (
    code.includes('WALLET_FIRST_EXIT_WALLET_READINESS_BLOCKED') ||
    blockers.includes('USER_NOT_IN_PILOT_ALLOWLIST') ||
    blockers.includes('PILOT_ALLOWLIST_EMPTY') ||
    code.includes('WALLET_FIRST_EXIT_INTAKE_DISABLED') ||
    code.includes('WALLET_FIRST_EXIT_CUSTOMER_SIGNING_DISABLED')
  ) {
    return 'O resgate em Pix ainda não está disponível para sua conta. Seus USDC continuam na sua carteira. Nenhum valor foi movimentado.';
  }
  if (code.includes('PIX_KEY_REQUIRED') || code.includes('PIX_KEY_DOES_NOT_MATCH_KYC_USER')) {
    return 'Confira sua chave Pix de recebimento. Ela precisa pertencer ao mesmo titular da conta Nexa.';
  }
  if (status >= 500) {
    return 'O resgate Pix está temporariamente indisponível. Seus USDC continuam na carteira. Tente novamente mais tarde.';
  }
  const raw = payload?.message || payload?.error || payload?.code;
  const base = Array.isArray(raw)
    ? raw.join(', ')
    : typeof raw === 'object'
      ? JSON.stringify(raw)
      : String(raw || fallback || `Falha na API (${status}).`);
  const blockers = Array.isArray(payload?.blockers)
    ? payload.blockers.filter(Boolean).join(', ')
    : '';
  return blockers ? `${base} (${blockers})` : base;
}

async function requestJson<T>(
  accessToken: string,
  path: string,
  options?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> },
): Promise<T> {
  const method = options?.method || 'POST';
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: headers(accessToken),
    body:
      method === 'POST'
        ? JSON.stringify(options?.body || {})
        : undefined,
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      apiError(payload, response.status, 'Operação Nexa indisponível no momento.'),
    );
  }
  return payload as T;
}

const EXIT_BASE = '/direct-settlement/wallet-first/usdc-pilot/exit';

export async function getWalletFirstExitQuote(
  accessToken: string,
  amountUsdc: number,
): Promise<WalletFirstExitQuote> {
  const payload = await requestJson<any>(accessToken, `${EXIT_BASE}/quote`, {
    body: { amountUsdc },
  });
  if (!payload?.quote) {
    throw new Error('A Nexa não retornou uma cotação válida.');
  }
  return payload.quote as WalletFirstExitQuote;
}

export function getWalletFirstActiveExit(accessToken: string) {
  return requestJson<any>(accessToken, `${EXIT_BASE}/active`, {
    method: 'GET',
  });
}

export function createWalletFirstExitIntent(
  accessToken: string,
  amountUsdc: number,
  clientRequestId: string,
) {
  return requestJson<any>(accessToken, `${EXIT_BASE}/intents`, {
    body: { amountUsdc, clientRequestId },
  });
}

export function prepareWalletFirstExitUsdtSwap(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/swap/prepare`,
    { body: {} },
  );
}

export function getWalletFirstExitSwapSponsorshipCredentials(
  accessToken: string,
  orderId: string,
  intentToken: string,
) {
  return requestJson<WalletFirstExitSponsorshipCredentials>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/swap/sponsorship-credentials`,
    { body: { intentToken } },
  );
}

export function confirmWalletFirstExitUsdtSwap(
  accessToken: string,
  orderId: string,
  intentToken: string,
  txHash: string,
  executionMode: 'direct_eoa' | 'client_sponsored_eip7702' = 'direct_eoa',
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/swap/confirm`,
    { body: { intentToken, txHash, executionMode } },
  );
}

export function prepareWalletFirstExitTransfer(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/onchain/prepare`,
    { body: {} },
  );
}

export function getWalletFirstExitTransferSponsorshipCredentials(
  accessToken: string,
  orderId: string,
) {
  return requestJson<WalletFirstExitSponsorshipCredentials>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/onchain/sponsorship-credentials`,
    { body: {} },
  );
}

export function verifyWalletFirstExitTransfer(
  accessToken: string,
  orderId: string,
  txHash: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/onchain/verify`,
    { body: { txHash } },
  );
}

export function reconcileWalletFirstExitProvider(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/provider/reconcile`,
    { body: {} },
  );
}

export function submitWalletFirstExitSell(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/sell/submit`,
    { body: { confirmation: 'EXECUTE_WALLET_FIRST_USDC_SELL' } },
  );
}

export function reconcileWalletFirstExitSell(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/sell/reconcile`,
    { body: {} },
  );
}

export function createWalletFirstExitPix(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/pix/create`,
    { body: { confirmation: 'CREATE_WALLET_FIRST_PIX_PAYOUT' } },
  );
}

export function approveWalletFirstExitPix(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/pix/approve`,
    { body: { confirmation: 'EXECUTE_WALLET_FIRST_PIX_PAYOUT' } },
  );
}

export function reconcileWalletFirstExitPix(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}/pix/reconcile`,
    { body: {} },
  );
}

export function getWalletFirstExitStatus(
  accessToken: string,
  orderId: string,
) {
  return requestJson<any>(
    accessToken,
    `${EXIT_BASE}/intents/${encodeURIComponent(orderId)}`,
    { method: 'GET' },
  );
}
