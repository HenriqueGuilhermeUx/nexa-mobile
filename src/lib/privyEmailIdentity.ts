/**
 * Pure, secret-free identity check. The backend remains the authority.
 * A Privy session belonging to a different e-mail must never be reused
 * when a customer signs in to a different Nexa account on this device.
 */
export function privyEmailMatchStatus(
  user: any,
  nexaEmail: string,
): 'match' | 'mismatch' | 'unknown' {
  const normalized = String(nexaEmail || '').trim().toLowerCase();
  if (!normalized) return 'unknown';
  const accounts = [
    ...(Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []),
    ...(Array.isArray(user?.linked_accounts) ? user.linked_accounts : []),
  ].filter((entry: any) => String(entry?.type || '').toLowerCase() === 'email');
  if (!accounts.length) return 'unknown';
  return accounts.some((account: any) =>
    String(account?.address || account?.email || '').trim().toLowerCase() === normalized
  ) ? 'match' : 'mismatch';
}
