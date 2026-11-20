import { walletFirstApi } from '@/lib/walletFirst';

export type NexaAuthenticatedRoute =
  | '/kyc'
  | '/onboarding-pix'
  | '/onboarding-wallet'
  | '/wallet-ownership'
  | '/legacy';

function normalizedPixType(profile: any) {
  return String(profile?.pixKeyType || '').trim().toUpperCase();
}

/** The registration service creates an internal nexa-managed address.
 * Only the verified Privy binding may skip the embedded-wallet onboarding.
 * Never treat a non-empty EVM address as evidence of Privy activation. */
export function hasLinkedPrivyWallet(profile: any): boolean {
  const wallet = profile?.wallet || {};
  const provider = String(wallet?.provider || profile?.walletProvider || '').trim().toLowerCase();
  const address = String(wallet?.address || profile?.walletAddress || '').trim();
  return provider === 'privy' &&
    /^0x[a-fA-F0-9]{40}$/.test(address) &&
    wallet?.privyLinked === true;
}

export async function resolveAuthenticatedRoute(
  profile: any,
  accessToken: string,
): Promise<NexaAuthenticatedRoute> {
  if (String(profile?.kycStatus || '').toLowerCase() !== 'approved') {
    return '/kyc';
  }

  const countryCode = String(profile?.residenceCountry || 'BR')
    .trim()
    .toUpperCase();

  // The Nexa app provisions and links the Privy wallet automatically as
  // part of the authenticated onboarding. Never require payout Pix setup
  // before this step; payout destination is unrelated to wallet ownership.
  if (!hasLinkedPrivyWallet(profile)) {
    return '/onboarding-wallet';
  }

  if (countryCode === 'BR') {
    const pixType = normalizedPixType(profile);
    const hasSelfBoundPayoutPix =
      profile?.pixWithdrawEnabled === true &&
      Boolean(String(profile?.pixKey || '').trim()) &&
      pixType === 'CPF';

    if (!hasSelfBoundPayoutPix) {
      return '/onboarding-pix';
    }
  }

  try {
    const readiness = await walletFirstApi.readiness(accessToken);
    if (readiness?.pilotProfile?.userControlledWalletConfirmed !== true) {
      return '/wallet-ownership';
    }
  } catch {
    // A carteira já vinculada não deve impedir o usuário de abrir o app por
    // indisponibilidade transitória de um provider. Execuções financeiras
    // continuam fail-closed no backend.
  }

  return '/legacy';
}
