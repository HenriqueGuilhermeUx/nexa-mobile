import { requestExternalWalletChallenge, verifyExternalWalletChallenge } from './externalWalletOwnership';
import { recoverMessageAddress } from 'viem';

/** Provider adapter: the UI must obtain it through an explicit user-initiated wallet connection.
 * No private keys, no background sends, and no transfer authorization.
 */
export interface ExternalEip1193Provider {
  request(input: {method: string; params?: unknown[]}): Promise<unknown>;
}
export async function proveExternalWalletOwnership(input: {
  provider: ExternalEip1193Provider;
  accessToken: string;
  expectedAddress: string;
  market?: 'BR' | 'GLOBAL';
}) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.expectedAddress)) throw new Error('INVALID_WALLET_ADDRESS');
  const chain = String(await input.provider.request({method:'eth_chainId'})).toLowerCase();
  if (chain !== '0x89' && chain !== '137') throw new Error('POLYGON_REQUIRED');
  const accounts = await input.provider.request({method:'eth_accounts'});
  if (!Array.isArray(accounts) || !accounts.some(a=>String(a).toLowerCase()===input.expectedAddress.toLowerCase())) {
    throw new Error('WALLET_ACCOUNT_MISMATCH');
  }
  const challenge = await requestExternalWalletChallenge(input.accessToken,input.expectedAddress,input.market ?? 'BR');
  const now = Date.now();
  if (Date.parse(challenge.expiresAt) <= now) throw new Error('CHALLENGE_EXPIRED');
  const signature = await input.provider.request({method:'personal_sign',params:[challenge.message,input.expectedAddress]});
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error('INVALID_SIGNATURE');
  const recovered = await recoverMessageAddress({ message: challenge.message, signature: signature as `0x${string}` });
  if (recovered.toLowerCase() !== input.expectedAddress.toLowerCase()) throw new Error('SIGNATURE_ACCOUNT_MISMATCH');
  const afterChain = String(await input.provider.request({method:'eth_chainId'})).toLowerCase();
  const afterAccounts = await input.provider.request({method:'eth_accounts'});
  if ((afterChain !== '0x89' && afterChain !== '137') ||
      !Array.isArray(afterAccounts) || !afterAccounts.some(a=>String(a).toLowerCase()===input.expectedAddress.toLowerCase())) {
    throw new Error('WALLET_SESSION_CHANGED_DURING_SIGN');
  }
  return verifyExternalWalletChallenge(input.accessToken,challenge.challengeId,signature,input.market ?? 'BR');
}
