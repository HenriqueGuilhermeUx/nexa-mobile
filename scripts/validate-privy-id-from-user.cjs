const assert = require('node:assert/strict');
const fs = require('node:fs');
const content = fs.readFileSync('app/onboarding-wallet.tsx', 'utf8');
for (const fragment of [
  'walletIdentifierFromVerifiedPrivyUser',
  'privyUser?.linkedAccounts',
  'privyUser?.linked_accounts',
  'privyUserRef.current',
  'resolvedWalletIdentifier(currentWallet, privyUserRef.current)',
  'if (!privyWalletId)',
  'hasLinkedPrivyWallet(linkedProfile)',
]) {
  assert.ok(content.includes(fragment), 'Missing Privy linked-account safety guard: '+fragment);
}
assert.ok(!/currentWallet\.wallet_id \|\|\s*currentWallet\.address/.test(content),'Wallet address must never masquerade as wallet ID');
console.log('Privy wallet ID lookup safety checks PASSED');
