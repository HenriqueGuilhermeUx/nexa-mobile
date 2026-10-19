import { config } from '@/config';

/**
 * Authenticated ownership proof client for an externally controlled EOA wallet.
 * Only creates and verifies signatures. Does not execute transfers.
 * The server controls trusted origin and destination wallet.
 */
async function ownershipRequest<T>(accessToken: string, path: string, body: object): Promise<T> {
  if (!accessToken) throw new Error('AUTH_REQUIRED');
  const res = await fetch(`${config.apiUrl}/wallet-connect-inbound/ownership/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OWNERSHIP_REQUEST_FAILED_${res.status}`);
  return await res.json() as T;
}
export type ExternalWalletChallenge = {
  challengeId: string;
  message: string;
  expiresAt: string;
  chainId: 137;
};
export async function requestExternalWalletChallenge(accessToken: string, walletAddress: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) throw new Error('INVALID_WALLET_ADDRESS');
  const result = await ownershipRequest<ExternalWalletChallenge>(accessToken, 'challenge', { walletAddress });
  if (!result.challengeId || typeof result.message !== 'string' || !result.message.includes('No transfer is authorized.') ||
      result.chainId !== 137 || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error('INVALID_CHALLENGE_RESPONSE');
  return result;
}
export async function verifyExternalWalletChallenge(accessToken: string, challengeId: string, signature: string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^0x[a-fA-F0-9]{130}$/.test(signature)) throw new Error('INVALID_SIGNATURE_INPUT');
  const result = await ownershipRequest<{bound:boolean;address:string;chainId:number}>(accessToken,'verify',{challengeId,signature});
  if (result.bound !== true || result.chainId !== 137 || !/^0x[a-fA-F0-9]{40}$/.test(result.address)) throw new Error('INVALID_VERIFICATION_RESPONSE');
  return result;
}
