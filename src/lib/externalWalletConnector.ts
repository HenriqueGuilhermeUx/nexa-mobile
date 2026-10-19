import type { ExternalEip1193Provider } from './externalWalletProviderProof';

/**
 * Connects a user-selected EIP-1193 provider already supplied by a trusted
 * wallet connector. Does not discover or fabricate providers, store secrets,
 * sign messages, or send transactions. Use only from a direct user gesture.
 */
export async function connectExternalProvider(provider: ExternalEip1193Provider) {
  if (!provider || typeof provider.request !== 'function') throw new Error('WALLET_PROVIDER_UNAVAILABLE');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(accounts) || accounts.length === 0 ||
      typeof accounts[0] !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(accounts[0])) {
    throw new Error('WALLET_CONNECTION_REJECTED');
  }
  const address = accounts[0] as string;
  const chain = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
  if (chain !== '0x89' && chain !== '137') throw new Error('POLYGON_REQUIRED');
  return { provider, address, chainId: 137 as const };
}
