/**
 * Nexa Invest & Credit: isolated, read-only mobile integration.
 * Intentionally NOT imported by app routes until the complete feature
 * is approved. Uses caller-provided authenticated API URL/JWT.
 * No signing, wallet creation, approvals, borrowing or transfers.
 */
export interface AaveReserve {
  asset: string;
  decimals: number;
  ltvBps: number;
  liquidationThresholdBps: number;
  active: boolean;
  frozen: boolean;
  paused: boolean;
  borrowingEnabled: boolean;
  informationalOnly: true;
}
export interface AaveMarketsResponse {
  success: true;
  informationalOnly: true;
  executionEnabled: false;
  chainId: number;
  reserves: AaveReserve[];
}
export interface AavePosition {
  chainId: number;
  walletAddress: string;
  totalCollateralBase: string;
  totalDebtBase: string;
  healthFactor: string | null;
  executableQuote: false;
}
function trustedApiBase(apiUrl: string) {
  const trimmed = apiUrl.trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[^?#]*)?$/i.test(trimmed)) {
    throw new Error('Nexa Invest & Credit requires an HTTPS API');
  }
  return trimmed;
}
async function read<T>(apiUrl: string, token: string, route: string): Promise<T> {
  if (!token.trim()) throw new Error('Authentication required');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(trustedApiBase(apiUrl) + '/invest-credit/' + route, {
      headers: {Authorization: 'Bearer ' + token, Accept: 'application/json'},
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Invest & Credit unavailable');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' ||
        (result as {informationalOnly?: unknown}).informationalOnly !== true) {
      throw new Error('Unexpected Invest & Credit response');
    }
    return result as T;
  } finally {
    clearTimeout(timeout);
  }
}
export async function getAaveMarketsReadOnly(apiUrl: string, jwt: string): Promise<AaveMarketsResponse> {
  const response = await read<AaveMarketsResponse>(apiUrl, jwt, 'aave/markets');
  if (response.executionEnabled !== false || !Array.isArray(response.reserves)) {
    throw new Error('Aave market execution is not supported');
  }
  return response;
}
export async function getAavePositionReadOnly(apiUrl: string, jwt: string): Promise<AavePosition | null> {
  const response = await read<{position: AavePosition}>(apiUrl, jwt, 'aave/me');
  if (!response.position || response.position.executableQuote !== false) {
    throw new Error('Unexpected Aave position');
  }
  return response.position;
}
