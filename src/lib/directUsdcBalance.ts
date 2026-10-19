import { config } from '@/config';
import { isAddress } from 'viem';

export type DirectUsdcOnchainBalance = {
  walletAddress: string;
  balanceRaw: string;
  balanceUsdc: string;
  chainId: 137;
  asset: 'USDC';
  contractAddress: string;
  decimals: 6;
  source: 'POLYGON_NATIVE_USDC_BALANCE_OF';
  walletLocation: 'privy';
  ledgerCredited: false;
  reconciledDeposit: false;
  financialAction: false;
  readOnly: true;
};

const USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';

/**
 * Read on-chain USDC belonging to the authenticated user's verified Privy wallet.
 * No Reown, wallet signature, transfer, ledger credit or customer-supplied target.
 */
export async function loadDirectUsdcOnchainBalance(input: {
  accessToken: string;
  verifiedReceivingWallet: string;
}): Promise<DirectUsdcOnchainBalance> {
  if (!input.accessToken) throw new Error('AUTH_REQUIRED');
  if (!isAddress(input.verifiedReceivingWallet)) throw new Error('INVALID_RECEIVING_WALLET');
  const response = await fetch(`${config.apiUrl}/wallet-connect-inbound/receive/balance`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`USDC_BALANCE_UNAVAILABLE_${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('UNTRUSTED_USDC_BALANCE');
  }
  const data = body as Partial<DirectUsdcOnchainBalance>;
  if (typeof data.walletAddress !== 'string' ||
      !isAddress(data.walletAddress) ||
      data.walletAddress.toLowerCase() !== input.verifiedReceivingWallet.toLowerCase() ||
      data.chainId !== 137 || data.asset !== 'USDC' ||
      typeof data.contractAddress !== 'string' ||
      data.contractAddress.toLowerCase() !== USDC ||
      data.decimals !== 6 || data.source !== 'POLYGON_NATIVE_USDC_BALANCE_OF' ||
      data.walletLocation !== 'privy' || data.ledgerCredited !== false ||
      data.reconciledDeposit !== false || data.financialAction !== false ||
      data.readOnly !== true || typeof data.balanceRaw !== 'string' ||
      !/^(0|[1-9][0-9]*)$/.test(data.balanceRaw) ||
      typeof data.balanceUsdc !== 'string' ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(data.balanceUsdc)) {
    throw new Error('UNTRUSTED_USDC_BALANCE');
  }
  return data as DirectUsdcOnchainBalance;
}
