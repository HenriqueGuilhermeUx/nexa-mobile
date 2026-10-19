import type { ExternalEip1193Provider } from './externalWalletProviderProof';
import { isActiveExternalWalletAccount } from './activeExternalWalletAccount';

/**
 * Bridge for a connection explicitly opened by the Reown UI.
 * Only consumes a connected EIP-1193 provider returned by the initialized
 * AppKit instance. Never guesses an address, requests private keys, or sends.
 */
export function asExternalEip1193Provider(value: unknown): ExternalEip1193Provider {
  if (!value || typeof value !== 'object' || !('request' in value) ||
      typeof (value as {request?: unknown}).request !== 'function') {
    throw new Error('REOWN_CONNECTED_PROVIDER_UNAVAILABLE');
  }
  return value as ExternalEip1193Provider;
}
export type ReownExternalConnection = {
  address: string;
  provider: ExternalEip1193Provider;
};
export async function validateReownExternalConnection(input: {
  address: unknown;
  provider: unknown;
}): Promise<ReownExternalConnection> {
  if (typeof input.address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(input.address)) {
    throw new Error('REOWN_CONNECTED_ADDRESS_INVALID');
  }
  const address = input.address as string;
  const provider = asExternalEip1193Provider(input.provider);
  const [chainId, accounts] = await Promise.all([
    provider.request({method:'eth_chainId'}),
    provider.request({method:'eth_accounts'}),
  ]);
  if (String(chainId).toLowerCase() !== '0x89' &&
      String(chainId) !== '137') throw new Error('POLYGON_REQUIRED');
  if (!isActiveExternalWalletAccount(accounts, address)) {
    throw new Error('REOWN_CONNECTED_ACCOUNT_MISMATCH');
  }
  return {address, provider};
}
