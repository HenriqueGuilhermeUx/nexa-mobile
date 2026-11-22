import { walletFirstApi } from '@/lib/walletFirst';
import { nexaApi } from '@/lib/api';

export type NexaAuthenticatedRoute =
  | '/kyc'
  | '/onboarding-pix'
  | '/onboarding-wallet'
  | '/wallet-ownership'
  | '/legacy';

function normalizedPixType(profile: any) {
  return String(profile?.pixKeyType || '').trim().toUpperCase();
}

/** The Nexa signup-managed address is never a verified Privy wallet. */
export function hasLinkedPrivyWallet(profile: any): boolean {
  const wallet = profile?.wallet || {};
  const address = String(wallet.address || profile?.walletAddress || '').trim();
  return String(wallet.provider || profile?.walletProvider || '').toLowerCase() === 'privy' &&
    wallet.privyLinked === true &&
    /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function resolveAuthenticatedRoute(
  profile: any,
  accessToken: string,
): Promise<NexaAuthenticatedRoute> {
  // Automatic user-owned wallet creation precedes KYC; KYC still gates
  // financial transactions on the backend.
  if (!hasLinkedPrivyWallet(profile)) {
    return '/onboarding-wallet';
  }
  if (String(profile?.kycStatus || '').toLowerCase() !== 'approved') {
    return '/kyc';
  }

  const countryCode = String(profile?.residenceCountry || 'BR')
    .trim()
    .toUpperCase();

  // Legacy customers with an existing linked wallet must not be sent through
  // new Pix/direct-settlement onboarding. This only changes navigation;
  // server-side financial eligibility and settlement gates stay unchanged.
  if (hasLinkedPrivyWallet(profile)) {
    // Existing Beta/Legacy customers keep their linked wallet and original
    // settlement permissions. Ownership proof for direct settlement must not
    // become a prerequisite for opening the current app.
    try {
      const response = await nexaApi.directProfile(accessToken);
      const directProfile = response?.profile || response;
      const settlementProfile = String(directProfile?.settlementProfile || '').toLowerCase();
      if (directProfile?.isLegacyBeta === true || settlementProfile === 'legacy_beta') {
        return '/legacy';
      }
    } catch {
      // Never grant new financial permissions if profile lookup fails.
      // Existing wallet ownership routing remains unchanged.
    }
  }

  // Pix CPF is exclusively a withdrawal destination for Woovi D+1.
  // Do not force cash-out subaccount enrollment before a customer's first
  // inbound Pix. Keep CPF/subaccount checks in the cash-out backend gates.
  // The next customer-owned proof is the wallet signature, not a Pix choice.
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
