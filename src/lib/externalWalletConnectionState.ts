import { connectExternalProvider } from './externalWalletConnector';
import type { ExternalEip1193Provider } from './externalWalletProviderProof';
import { isActiveExternalWalletAccount } from './activeExternalWalletAccount';

/** In-memory only. The provider is supplied by the user's wallet connector;
 * no wallet or Nexa credential is persisted by this helper. */
export type ExternalWalletSession = {
  provider: ExternalEip1193Provider;
  address: string;
  chainId: 137;
};
export async function establishExternalWalletSession(provider: ExternalEip1193Provider): Promise<ExternalWalletSession> {
  return connectExternalProvider(provider);
}
/** Re-check active account and chain immediately before a proof/signature. */
export async function assertExternalWalletSessionActive(session: ExternalWalletSession) {
  const chain = String(await session.provider.request({ method: 'eth_chainId' })).toLowerCase();
  if (chain !== '0x89' && chain !== '137') throw new Error('POLYGON_REQUIRED');
  const accounts = await session.provider.request({ method: 'eth_accounts' });
  if (!isActiveExternalWalletAccount(accounts, session.address)) {
    throw new Error('EXTERNAL_WALLET_SESSION_CHANGED');
  }
  return session;
}
