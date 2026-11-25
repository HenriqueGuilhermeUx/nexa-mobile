'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const signup = fs.readFileSync('app/sign-up.tsx', 'utf8');
const wallet = fs.readFileSync('app/onboarding-wallet.tsx', 'utf8');
const session = fs.readFileSync('app/wallet-session.tsx', 'utf8');
const routing = fs.readFileSync('src/lib/onboarding.ts', 'utf8');
const kyc = fs.readFileSync('app/kyc.tsx', 'utf8');

// Keep the existing three independent, default-off marketing consent choices.
for (const token of [
  "const [consentEmail,setConsentEmail] = useState(false)",
  "const [consentWhatsApp,setConsentWhatsApp] = useState(false)",
  "const [consentTelegram,setConsentTelegram] = useState(false)",
  'communicationConsents:{',
  'accessibilityRole="checkbox"',
  'await nexaApi.register(',
  'await saveNexaSession(',
]) assert.ok(signup.includes(token), 'Signup lost consent, accessibility or account creation: ' + token);

// The same device must not reuse a different account's authenticated Privy user.
for (const token of [
  "usePrivy",
  "if (!privy?.isReady)",
  "const previousPrivyToken",
  "await privy.logout()",
  "router.replace('/onboarding-wallet' as any)",
]) assert.ok(signup.includes(token), 'Privy-first signup guard missing: ' + token);
assert.ok(signup.indexOf('await privy.logout()') < signup.indexOf('await nexaApi.register('));
assert.ok(signup.indexOf('await saveNexaSession(') < signup.indexOf("router.replace('/onboarding-wallet' as any)"));
assert.doesNotMatch(signup, /router\.replace\('\/kyc' as any\)/);

// Link an actual embedded wallet ID only, never the 0x address substituted as an ID.
for (const token of [
  'walletIdentifierFromVerifiedPrivyUser',
  'resolvedWalletIdentifier',
  'privyUserRef.current',
  '!/^0x[a-fA-F0-9]{40}$/.test',
  'createAdditional: false',
  'await nexaApi.linkWallet(',
  'const linkedProfile = await nexaApi.me(',
  'hasLinkedPrivyWallet(linkedProfile)',
  'linkedProfile?.wallet?.address',
  "await nexaApi.auditWallet(session.accessToken).catch(() => null)",
  "setTimeout(() => {",
]) assert.ok(wallet.includes(token), 'Safe Privy wallet binding missing: ' + token);
assert.doesNotMatch(wallet, /currentWallet\.wallet_id\s*\|\|\s*currentWallet\.address/);
assert.doesNotMatch(wallet, /createAdditional:\s*true/);
assert.ok(wallet.indexOf('resolvedWalletIdentifier(') < wallet.indexOf('await nexaApi.linkWallet('));
assert.ok(wallet.indexOf('await nexaApi.linkWallet(') < wallet.indexOf('hasLinkedPrivyWallet(linkedProfile)'));

// OTP login must use the Nexa account email; KYC remains an independent requirement.
for (const token of ['emailLogin.sendCode(', 'emailLogin.loginWithCode(', 'disableSignup: !walletOnboarding']) {
  assert.ok(session.includes(token), 'Privy OTP flow missing: ' + token);
}
assert.ok(routing.includes("return '/onboarding-wallet'"));
assert.ok(kyc.includes('startBrazilKyc('));
assert.ok(kyc.includes('startGlobalKyc('));

console.log('NEXA_PRIVY_MAIN_PRESERVE_CONSENTS_WALLET_ID_KYC=PASS');
