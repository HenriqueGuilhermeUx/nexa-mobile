/**
 * EIP-1193 eth_accounts lists authorized accounts; the first is the selected
 * account. Merely finding an address anywhere in the list is not proof that
 * it is still the active account after a wallet/account switch.
 */
export function isActiveExternalWalletAccount(accounts: unknown, expectedAddress: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(expectedAddress) ||
      !Array.isArray(accounts) ||
      typeof accounts[0] !== 'string' ||
      !/^0x[0-9a-fA-F]{40}$/.test(accounts[0])) {
    return false;
  }
  return accounts[0].toLowerCase() === expectedAddress.toLowerCase();
}
