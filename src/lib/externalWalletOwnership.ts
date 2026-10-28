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
export async function requestExternalWalletChallenge(accessToken: string, walletAddress: string, market: 'BR' | 'GLOBAL' = 'BR') {
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) throw new Error('INVALID_WALLET_ADDRESS');
  const result = await ownershipRequest<ExternalWalletChallenge>(accessToken, 'challenge', { walletAddress, market });
  if (!result.challengeId || typeof result.message !== 'string' || !result.message.includes('No transfer is authorized.') ||
      result.chainId !== 137 || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error('INVALID_CHALLENGE_RESPONSE');
  return result;
}
export async function verifyExternalWalletChallenge(accessToken: string, challengeId: string, signature: string, market: 'BR' | 'GLOBAL' = 'BR') {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^0x[a-fA-F0-9]{130}$/.test(signature)) throw new Error('INVALID_SIGNATURE_INPUT');
  const result = await ownershipRequest<{bound:boolean;address:string;chainId:number}>(accessToken,'verify',{challengeId,signature,market});
  if (result.bound !== true || result.chainId !== 137 || !/^0x[a-fA-F0-9]{40}$/.test(result.address)) throw new Error('INVALID_VERIFICATION_RESPONSE');
  return result;
}

export type ExternalWalletLink = {
  address: string;
  chainId: 137;
  linkedAt: string;
  authorizedForTransfers: false;
};

export async function listLinkedExternalWallets(accessToken: string): Promise<ExternalWalletLink[]> {
  if (!accessToken) throw new Error('AUTH_REQUIRED');
  const res = await fetch(`${config.apiUrl}/wallet-connect-inbound/ownership/links`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`WALLET_LINK_LIST_UNAVAILABLE_${res.status}`);
  const result: unknown = await res.json();
  if (!result || typeof result !== 'object' || !('wallets' in result) ||
      !Array.isArray(result.wallets) || result.wallets.length > 20) throw new Error('INVALID_LINK_LIST');
  return result.wallets.map((item: any) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(item?.address ?? '') ||
        item.chainId !== 137 || item.authorizedForTransfers !== false ||
        !Number.isFinite(Date.parse(item.linkedAt))) throw new Error('INVALID_LINK_LIST');
    return item as ExternalWalletLink;
  });
}

export async function revokeLinkedExternalWallet(input: {
  accessToken: string;
  walletAddress: string;
}): Promise<void> {
  if (!input.accessToken) throw new Error('AUTH_REQUIRED');
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.walletAddress)) throw new Error('INVALID_WALLET_ADDRESS');
  const res = await fetch(`${config.apiUrl}/wallet-connect-inbound/ownership/link`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({walletAddress: input.walletAddress}),
  });
  if (!res.ok) throw new Error(`WALLET_LINK_REVOKE_FAILED_${res.status}`);
  const result = await res.json() as {revoked?:boolean;address?:string;chainId?:number;financialAction?:boolean};
  if (result.revoked !== true || result.chainId !== 137 ||
      result.financialAction !== false ||
      result.address?.toLowerCase() !== input.walletAddress.toLowerCase()) {
    throw new Error('UNTRUSTED_LINK_REVOKE_RESULT');
  }
}
