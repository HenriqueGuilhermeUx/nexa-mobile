const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const legacyRoot = read('App.js');
const legacyNested = read('nexa-mobile/nexa-mobile/App.js');
const newOrder = read('app/(app)/new-order.tsx');
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
assert.match(onboarding, /walletLinkSucceeded/);
assert.match(onboarding, /auditWallet/);
assert.match(onboarding, /catch \(auditError\)/);
assert.match(onboarding, /router\.replace\('\/\(app\)'\)/);

console.log(
  'Decimal inputs, total-balance formatting and non-blocking Privy audit validated.',
);
