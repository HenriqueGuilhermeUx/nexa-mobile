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

function walletAddress(profile: any) {
  return String(
    profile?.wallet?.address ||
      profile?.walletAddress ||
      '',
  ).trim();
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

  // Legacy customers with an existing linked wallet must not be sent through
  // new Pix/direct-settlement onboarding. This only changes navigation;
  // server-side financial eligibility and settlement gates stay unchanged.
  if (walletAddress(profile)) {
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

  if (countryCode === 'BR') {
    const pixType = normalizedPixType(profile);
    const hasSelfBoundPayoutPix =
      profile?.pixWithdrawEnabled === true &&
      Boolean(String(profile?.pixKey || '').trim()) &&
      ['CPF', 'EMAIL', 'PHONE'].includes(pixType);

    if (!hasSelfBoundPayoutPix) {
      return '/onboarding-pix';
    }
  }

  if (!walletAddress(profile)) {
    return '/onboarding-wallet';
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
