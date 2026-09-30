import { Platform } from 'react-native';

import { config } from '@/config';

async function postJson<T>(
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Nexa-App-Version': config.appVersion,
      'X-Nexa-App-Build': config.appBuild,
      'X-Nexa-Platform': Platform.OS,
    },
    body: JSON.stringify(body),
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
    throw new Error(message);
  }

  return payload as T;
}

export type PreparedWalletTransaction = {
  chainId: number;
  from: string;
  to: string;
  data: string;
  value?: string;
  gas?: string | null;
  gasPrice?: string | null;
};

export function prepareDirectTransfer(
  accessToken: string,
  receiverUsername: string,
  amountUsdc: number,
) {
  return postJson<any>(
    accessToken,
    '/wallet-v15/transfer/onchain-direct/prepare',
    { receiverUsername, amountUsdc },
  );
}

export function confirmDirectTransfer(
  accessToken: string,
  receiverUsername: string,
  amountUsdc: number,
  txHash: string,
) {
  return postJson<any>(
    accessToken,
    '/wallet-v15/transfer/onchain-direct/confirm',
    { receiverUsername, amountUsdc, txHash },
  );
}

export function getWalletFirstSwapQuote(
  accessToken: string,
  toAsset: 'BTC' | 'ETH',
  amountUsdc: number,
) {
  return postJson<any>(accessToken, '/wallet-v15/swap/quote', {
    toAsset,
    amountUsdc,
  });
}

export function prepareWalletFirstSwap(
  accessToken: string,
  toAsset: 'BTC' | 'ETH',
  amountUsdc: number,
) {
  return postJson<any>(accessToken, '/wallet-v15/swap/prepare', {
    toAsset,
    amountUsdc,
  });
}

export function ensureWalletFirstGas(accessToken: string) {
  return postJson<any>(accessToken, '/wallet-v15/swap/ensure-gas', {});
}

export function confirmWalletFirstSwap(
  accessToken: string,
  intentToken: string,
  txHash: string,
) {
  return postJson<any>(accessToken, '/wallet-v15/swap/confirm', {
    intentToken,
    txHash,
  });
}

export function normalizeWalletAddress(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export async function assertPolygonProvider(provider: any) {
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('A carteira não está pronta para assinar transações.');
  }

  const chainId = String(
    (await provider.request({ method: 'eth_chainId' }).catch(() => '')) || '',
  ).toLowerCase();
  if (chainId === '0x89' || chainId === '137') return;

  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x89' }],
  });

  const switched = String(
    (await provider.request({ method: 'eth_chainId' }).catch(() => '')) || '',
  ).toLowerCase();
  if (switched !== '0x89' && switched !== '137') {
    throw new Error('Não foi possível preparar a rede da sua carteira.');
  }
}

export async function sendPreparedWalletTransaction(
  provider: any,
  transaction: PreparedWalletTransaction,
) {
  await assertPolygonProvider(provider);

  const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => []);
  const expectedFrom = normalizeWalletAddress(transaction.from);
  if (
    !Array.isArray(accounts) ||
    !accounts.some((account: unknown) => normalizeWalletAddress(account) === expectedFrom)
  ) {
    throw new Error('A carteira ativa não corresponde à carteira vinculada à Nexa.');
  }

  const request: Record<string, string> = {
    from: transaction.from,
    to: transaction.to,
    data: transaction.data,
    value: transaction.value || '0x0',
  };

  if (transaction.gas) request.gas = transaction.gas;
  if (transaction.gasPrice) request.gasPrice = transaction.gasPrice;

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [request],
  });
  const normalized = String(txHash || '').trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error('A carteira não retornou um comprovante de transação válido.');
  }
  return normalized;
}
