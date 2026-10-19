import { config } from '@/config';
import { isAddress, getAddress } from 'viem';

export type DirectUsdcReceivingDetails = {
  walletAddress: string;
  chainId: 137;
  chain: 'polygon';
  asset: 'USDC';
  contractAddress: string;
  decimals: 6;
  feeBps: 0;
  networkGasPaidBySender: true;
  source: 'LIVE_PRIVY_USER_AND_WALLET_AUDIT';
  financialAction: false;
  ledgerCredited: false;
};

const NATIVE_POLYGON_USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
const EMPTY_ADDRESS = /^0x0{40}$/i;

/**
 * Direct receive does NOT use WalletConnect/Reown.
 * Authenticate to Nexa and retrieve only a fresh, server-verified Privy address.
 * No client-selected destination and no implicit ledger credit.
 */
export async function loadDirectUsdcReceivingDetails(accessToken: string): Promise<DirectUsdcReceivingDetails> {
  if (!accessToken) throw new Error('AUTH_REQUIRED');
  const response = await fetch(`${config.apiUrl}/wallet-connect-inbound/receive`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`DIRECT_USDC_RECEIVE_UNAVAILABLE_${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') throw new Error('UNTRUSTED_RECEIVING_DETAILS');
  const data = body as Partial<DirectUsdcReceivingDetails>;
  if (typeof data.walletAddress !== 'string' || !isAddress(data.walletAddress) ||
      EMPTY_ADDRESS.test(data.walletAddress) ||
      data.chainId !== 137 || data.chain !== 'polygon' || data.asset !== 'USDC' ||
      typeof data.contractAddress !== 'string' ||
      data.contractAddress.toLowerCase() !== NATIVE_POLYGON_USDC ||
      data.decimals !== 6 || data.feeBps !== 0 || data.networkGasPaidBySender !== true ||
      data.source !== 'LIVE_PRIVY_USER_AND_WALLET_AUDIT' ||
      data.financialAction !== false || data.ledgerCredited !== false) {
    throw new Error('UNTRUSTED_RECEIVING_DETAILS');
  }
  return { ...data, walletAddress: getAddress(data.walletAddress) } as DirectUsdcReceivingDetails;
}
