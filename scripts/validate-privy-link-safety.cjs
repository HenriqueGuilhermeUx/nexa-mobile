const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app/onboarding-wallet.tsx','utf8');
const routing = fs.readFileSync('src/lib/onboarding.ts','utf8');

assert.match(source,/hasLinkedPrivyWallet\(linkedProfile\)/,'must confirm server-persisted Privy linkage');
assert.match(source,/currentWallet\.address\)\.toLowerCase\(\)/,'must compare confirmed owner wallet address');
assert.match(source,/currentWallet\.id \|\| currentWallet\.walletId \|\| currentWallet\.wallet_id \|\| ''/,'must not substitute blockchain address for Privy wallet ID');
assert.match(source,/if \(!privyWalletId \|\|/,'must fail closed if wallet ID is unavailable');
assert.match(source,/setTimeout\(\(\) => \{/,'must have SDK wallet response timeout');
assert.match(source,/return \(\) => clearTimeout\(timeout\)/,'must clear pending timeout');
assert.match(source,/createAdditional: false/,'must avoid creating a second embedded wallet');
assert.match(routing,/wallet\.privyLinked === true/,'internal managed wallet is never linked Privy');
assert.match(routing,/return '\/onboarding-wallet'/,'legacy and new users must route through wallet activation');
console.log('Privy link-ownership and timeout regression checks passed');
