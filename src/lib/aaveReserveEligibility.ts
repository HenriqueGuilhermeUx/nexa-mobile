/** Read-only eligibility hints for Aave V3 QA. Not an execution authorization. */
export type AaveAction = 'SUPPLY' | 'BORROW' | 'REPAY' | 'WITHDRAW';

export type AaveReserveFlags = {
  active: boolean;
  paused: boolean;
  frozen: boolean;
  borrowingEnabled: boolean;
};

export function aaveReserveEligibleForPlanning(reserve: AaveReserveFlags, action: AaveAction): boolean {
  if (!reserve.active || reserve.paused) return false;
  if ((action === 'SUPPLY' || action === 'BORROW') && reserve.frozen) return false;
  if (action === 'BORROW' && !reserve.borrowingEnabled) return false;
  return true;
}
