import { config } from '@/config';

export const NEXA_EARN = {
  vaultId: config.earnVaultId,
  name: 'Nexa Rewards',
  providerLabel: 'Steakhouse Prime USDC',
  asset: 'USDC',
  chain: 'base',
  chainId: 8453,
  appYieldSharePercent: 30,
  userYieldSharePercent: 70,
} as const;

export function formatEarnUsdc(rawAmount: unknown, decimals = 6) {
  const raw = BigInt(String(rawAmount || '0'));
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = (raw % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function earnedYieldRaw(position: {
  assets_in_vault?: string;
  total_deposited?: string;
  total_withdrawn?: string;
}) {
  const assets = BigInt(position.assets_in_vault || '0');
  const deposited = BigInt(position.total_deposited || '0');
  const withdrawn = BigInt(position.total_withdrawn || '0');
  return assets - (deposited - withdrawn);
}
