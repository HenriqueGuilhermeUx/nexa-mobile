'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const signup=fs.readFileSync('app/sign-up.tsx','utf8');
const wallet=fs.readFileSync('app/onboarding-wallet.tsx','utf8');
const api=fs.readFileSync('src/lib/api.ts','utf8');
const session=fs.readFileSync('app/wallet-session.tsx','utf8');
const routing=fs.readFileSync('src/lib/onboarding.ts','utf8');

// Critical fields of the real Android production release must be retained.
for(const check of [
 "router.replace('/onboarding-wallet'",
 'await privy.logout()',
])assert.ok(signup.includes(check),'Privy-first new signup lost: '+check);
for(const check of [
 'createAdditional: false',
 'walletIdentifierFromVerifiedPrivyUser',
 'resolvedWalletIdentifier(currentWallet, privyUserRef.current)',
 'await nexaApi.linkWallet(',
 'hasLinkedPrivyWallet(linkedProfile)',
 'linkedProfile?.wallet?.address',
 'await nexaApi.auditWallet(session.accessToken).catch(() => null)',
])assert.ok(wallet.includes(check),'Existing wallet safety condition lost: '+check);
assert.doesNotMatch(wallet,/A carteira foi localizada, mas a Privy ainda não mostrou seu identificador/);
assert.doesNotMatch(wallet,/privyWalletId\s*=\s*currentWallet\.address/);
assert.match(api,/wallet:\s*\{\s*privyWalletId\?: string; walletAddress: string\s*\}/);
assert.match(session,/emailLogin\.sendCode/);
assert.match(session,/emailLogin\.loginWithCode/);
assert.ok(routing.includes("return '/onboarding-wallet'"));
assert.ok(wallet.includes("returnTo: 'onboarding-wallet'"));

// No funds, security flags, provider keys, KYC, deposits or release channel changed.
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.dependencies['@privy-io/expo'],'0.70.4');
assert.ok(!wallet.includes('createAdditional: true'));
console.log('NEXA_LIVE_PRIVY_PROVIDER_ID_RECOVERY_SAFE=PASS');
