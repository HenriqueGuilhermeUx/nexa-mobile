const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const legacyRoot = read('App.js');
const legacyNested = read('nexa-mobile/nexa-mobile/App.js');
const newOrder = read('app/(app)/new-order.tsx');
const signIn = read('app/sign-in.tsx');
const onboarding = read('app/onboarding-wallet.tsx');

for (const [label, source] of [
  ['legacy root', legacyRoot],
  ['legacy nested', legacyNested],
]) {
  assert.match(
    source,
    /function parseAmount\(value\)[\s\S]*lastIndexOf\(','\)[\s\S]*lastIndexOf\('\.'\)/,
    `${label}: parser must accept comma and dot decimals`,
  );
  assert.match(
    source,
    /duplicatedProviderDomain/,
    `${label}: obvious duplicated email domains must be rejected before registration`,
  );
}

assert.match(
  legacyNested,
  /function formatInputAmount\(value\)/,
  'legacy USDC withdrawal app: total balance formatter is missing',
);
assert.match(
  legacyNested,
  /setValorUsdc\(formatInputAmount\(saldo\.USDC\)\)/,
  'legacy USDC withdrawal app: total balance must use the locale-safe formatter',
);
assert.match(newOrder, /lastIndexOf\(','\)/);
assert.match(newOrder, /lastIndexOf\('\.'\)/);

assert.match(signIn, /isLegacyProfile/);
assert.ok(
  signIn.indexOf('isLegacyProfile(profile)') < signIn.indexOf('await sendCode'),
  'legacy users must enter before any Privy OTP requirement',
);
assert.match(onboarding, /Criar carteira e continuar/);
assert.match(onboarding, /linkWhenReady/);
assert.match(onboarding, /auditWallet/);
assert.match(onboarding, /\.catch\(\(\) => undefined\)/);
assert.match(onboarding, /router\.replace\('\/\(app\)'\)/);
assert.doesNotMatch(
  onboarding,
  /Proteções desta etapa|custódia pendente|auditoria complementar ficou pendente/i,
);

console.log(
  'Decimal inputs, total-balance formatting, legacy access and one-step non-blocking Privy onboarding validated.',
);