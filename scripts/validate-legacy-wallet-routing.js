const fs = require('node:fs');
const assert = require('node:assert/strict');

const routing = fs.readFileSync('src/lib/onboarding.ts', 'utf8');
const ownership = fs.readFileSync('app/wallet-ownership.tsx', 'utf8');
const legacy = fs.readFileSync('app/legacy.js', 'utf8');

const legacyCheck = routing.indexOf('directProfile?.isLegacyBeta === true');
const pixOnboarding = routing.indexOf("return '/onboarding-pix'");
const walletOnboarding = routing.indexOf("return '/onboarding-wallet'");
assert(legacyCheck !== -1 && legacyCheck < pixOnboarding && legacyCheck < walletOnboarding,
  'Linked legacy accounts must be recognized before new Pix/wallet onboarding');
assert(routing.includes("settlementProfile === 'legacy_beta'"), 'Legacy settlement profile must be supported');
assert(routing.includes('if (walletAddress(profile)) {'), 'Legacy routing must require an existing linked wallet');
assert(ownership.includes("?.code === 'LEGACY_BETA_USER'"), 'Legacy audit rejection must be handled');
assert(ownership.includes("router.replace('/legacy' as any)"), 'Legacy audit rejection must open existing app');
assert(legacy.includes('loadNexaSession()') && legacy.includes('AlignedLegacyApp'),
  'Existing app must restore the session rather than create a new wallet');
console.log('PASS legacy wallet routing and existing-session regression contracts');
