import { config } from '@/config';
import { nexaApi } from '@/lib/api';

let installed = false;

function normalizeWalletFirstProfile(directResponse: any, walletV15Response: any) {
  const walletV15Profile = walletV15Response?.status?.profile || null;
  const status = String(walletV15Profile?.status || '').trim().toLowerCase();

  if (!['pilot', 'active'].includes(status)) return null;

  const directProfile = directResponse?.profile || directResponse || {};
  const destinationWallet = String(
    walletV15Profile?.destinationWallet || directProfile?.wallet?.address || '',
  ).trim();

  return {
    ...directProfile,
    ...walletV15Profile,
    status,
    isLegacyBeta: false,
    settlementProfile: `wallet_first_${status}`,
    wallet: {
      ...(directProfile?.wallet || {}),
      address: destinationWallet || null,
      linked: Boolean(destinationWallet),
    },
  };
}

export function installWalletFirstProfilePatch() {
  if (installed) return;
  installed = true;

  const originalDirectProfile = nexaApi.directProfile.bind(nexaApi);

  nexaApi.directProfile = async (accessToken: string) => {
    let directResponse: any = null;
    let directError: unknown = null;

    try {
      directResponse = await originalDirectProfile(accessToken);
    } catch (error) {
      directError = error;
    }

    try {
      const response = await fetch(`${config.apiUrl}/wallet-v15/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const walletV15Response = await response.json();
        const walletFirstProfile = normalizeWalletFirstProfile(
          directResponse,
          walletV15Response,
        );

        if (walletFirstProfile) {
          if (directResponse?.profile) {
            return {
              ...directResponse,
              profile: walletFirstProfile,
              walletV15: walletV15Response,
            };
          }

          return {
            ...(directResponse || {}),
            ...walletFirstProfile,
            walletV15: walletV15Response,
          };
        }
      }
    } catch {
      // Fail closed: if Wallet V1.5 cannot be confirmed, preserve the
      // existing direct-settlement decision instead of guessing.
    }

    if (directError) throw directError;
    return directResponse;
  };
}

installWalletFirstProfilePatch();
