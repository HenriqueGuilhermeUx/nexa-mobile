import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createPublicClient, formatUnits, getAddress, http, isAddress, type Address } from 'viem';
import { polygon } from 'viem/chains';

/**
 * A watchlist is NOT a wallet connection, signing permission, proof of
 * ownership, custodial account, or transferable balance.
 * Local public addresses remain segregated by authenticated Nexa identity.
 */
export type WatchedExternalWallet = {
  address: Address;
  label: string;
  addedAt: number;
};
export const POLYGON_NATIVE_USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' as const;
const BALANCE_ABI = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;
const RPC_ENDPOINTS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon.drpc.org',
] as const;
const MAX_WALLETS = 5;

export function parseExternalWalletAddress(value: string): Address {
  const candidate = String(value || '').trim();
  if (!isAddress(candidate) || /^0x0{40}$/i.test(candidate)) {
    throw new Error('Informe um endereço público válido (0x…). Nunca informe sua frase-semente.');
  }
  return getAddress(candidate);
}

function parseWatchlist(raw: string | null): WatchedExternalWallet[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const valid: WatchedExternalWallet[] = [];
    for (const record of data.slice(0, MAX_WALLETS)) {
      if (!record || typeof record !== 'object') continue;
      const row = record as Record<string, unknown>;
      if (typeof row.address !== 'string') continue;
      const address = parseExternalWalletAddress(row.address);
      if (seen.has(address.toLowerCase())) continue;
      seen.add(address.toLowerCase());
      valid.push({
        address,
        label: typeof row.label === 'string' ? row.label.slice(0, 45) : 'Carteira externa',
        addedAt: typeof row.addedAt === 'number' && Number.isFinite(row.addedAt)
          ? row.addedAt : 0,
      });
    }
    return valid;
  } catch {
    return [];
  }
}

async function watchlistKey(identityEmail: string) {
  const email = String(identityEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Entre na Nexa para acompanhar uma carteira.');
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email);
  return 'nexa.externalWalletWatch.v1.' + hash;
}

export async function readWatchedWallets(identityEmail: string) {
  const key = await watchlistKey(identityEmail);
  return parseWatchlist(await SecureStore.getItemAsync(key));
}

export async function saveWatchedWallet(identityEmail: string, addressInput: string) {
  const key = await watchlistKey(identityEmail);
  const address = parseExternalWalletAddress(addressInput);
  const current = parseWatchlist(await SecureStore.getItemAsync(key));
  if (current.some(row => row.address.toLowerCase() === address.toLowerCase())) return current;
  if (current.length >= MAX_WALLETS) {
    throw new Error('Limite de 5 carteiras para acompanhar neste aparelho.');
  }
  const next = [...current, { address, label: 'Carteira externa', addedAt: Date.now() }];
  await SecureStore.setItemAsync(key, JSON.stringify(next));
  return next;
}

export async function forgetWatchedWallet(identityEmail: string, addressInput: string) {
  const key = await watchlistKey(identityEmail);
  const address = parseExternalWalletAddress(addressInput);
  const current = parseWatchlist(await SecureStore.getItemAsync(key));
  const next = current.filter(row => row.address.toLowerCase() !== address.toLowerCase());
  await SecureStore.setItemAsync(key, JSON.stringify(next));
  return next;
}

export type ExternalUsdcBalance = {
  address: Address;
  amount: string;
  asset: 'USDC';
  chainId: 137;
  source: 'POLYGON_PUBLIC_RPC_READONLY';
  asOf: number;
};

export async function readExternalUsdcBalance(
  addressInput: string,
): Promise<ExternalUsdcBalance> {
  const address = parseExternalWalletAddress(addressInput);
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const client = createPublicClient({
        chain: polygon,
        transport: http(endpoint, { timeout: 12_000, retryCount: 0 }),
      });
      const chainId = await client.getChainId();
      if (chainId !== 137) throw new Error('RPC respondeu com rede incorreta.');
      const raw = await client.readContract({
        address: POLYGON_NATIVE_USDC,
        abi: BALANCE_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      return {
        address,
        amount: formatUnits(raw, 6),
        asset: 'USDC',
        chainId: 137,
        source: 'POLYGON_PUBLIC_RPC_READONLY',
        asOf: Date.now(),
      };
    } catch {
      // Try a second, independent Polygon RPC. Do not silently report zero.
    }
  }
  throw new Error('A Polygon não respondeu. Tente novamente; nenhum saldo foi alterado.');
}

/**
 * A Wallet V1.5 portfolio address is NOT necessarily a funding address.
 * The backend prefers the user's configured destinationWallet, which may
 * belong to an external wallet. Only display a QR code if independently
 * authenticated /user/me confirms the same Polygon Nexa-managed/Privy address.
 * Fail closed: absence, network/provider mismatch or wallet not ready = no QR.
 */
export function verifiedNexaReceiveAddress(
  userProfile: unknown,
  walletV15Response: unknown,
): Address | null {
  const profile = userProfile as Record<string, any> | null;
  const result = walletV15Response as Record<string, any> | null;
  const identityWallet = profile?.wallet;
  const portfolio = result?.portfolio;
  if (result?.success !== true || portfolio?.walletReady !== true) return null;
  const provider = String(identityWallet?.provider || '').trim().toLowerCase();
  const network = String(identityWallet?.network || '').trim().toLowerCase();
  const portfolioNetwork = String(portfolio?.network || '').trim().toLowerCase();
  if (!['privy', 'nexa-managed'].includes(provider) ||
      network !== 'polygon' || portfolioNetwork !== 'polygon') return null;
  try {
    const owned = parseExternalWalletAddress(String(identityWallet?.address || ''));
    const displayed = parseExternalWalletAddress(String(portfolio?.address || ''));
    return owned.toLowerCase() === displayed.toLowerCase() ? owned : null;
  } catch {
    return null;
  }
}

export function externalWalletFeaturesEnabled() {
  // Public-address monitoring is a read-only feature. The feature is
  // enabled after the 2026-11 rollout but can be disabled via the explicit
  // production kill switch without changing financial execution permissions.
  return process.env.EXPO_PUBLIC_NEXA_EXTERNAL_WALLET_WATCH_ENABLED !== 'false';
}
