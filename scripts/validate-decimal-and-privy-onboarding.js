const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const legacyRoot = read('App.js');
const legacyNested = read('nexa-mobile/nexa-mobile/App.js');
const newOrder = read('app/(app)/new-order.tsx');
const signIn = read('app/sign-in.tsx');
const signUp = read('app/sign-up.tsx');
const welcome = read('app/index.tsx');
const kyc = read('app/kyc.tsx');
const onboarding = read('app/onboarding-wallet.tsx');
const appConfig = JSON.parse(read('app.json')).expo;

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

assert.doesNotMatch(signIn, /useLoginWithEmail|sendCode|loginWithCode|directProfile/);
assert.match(signIn, /kycStatus/);
assert.match(signIn, /router\.replace\('\/legacy'/);
assert.match(signIn, /router\.replace\('\/kyc'/);
assert.doesNotMatch(signIn, /onboarding-wallet/);

assert.doesNotMatch(signUp, /useLoginWithEmail|sendCode|loginWithCode/);
assert.match(signUp, /nexaApi\.register/);
assert.match(signUp, /router\.replace\('\/kyc'/);
assert.doesNotMatch(signUp, /router\.replace\('\/legacy'/);
assert.match(signUp, /CPF[\s\S]*selfie|selfie[\s\S]*CPF/i);
assert.doesNotMatch(signUp, /onboarding-wallet/);

assert.match(welcome, /nexaApi\.me/);
assert.match(welcome, /'\/legacy'/);
assert.match(welcome, /'\/kyc'/);
assert.doesNotMatch(welcome, /usePrivy|onboarding-wallet|directProfile/);

assert.match(kyc, /Consentimento biométrico/);
assert.match(kyc, /startBrazilKyc/);
assert.match(kyc, /getMyKycStatus/);
assert.match(kyc, /document_fallback/);
assert.match(kyc, /manual_review/);
assert.match(kyc, /retry_selfie/);

// A tela da carteira continua no pacote para uso voluntário, mas não aparece
// em nenhum redirecionamento obrigatório de login, cadastro ou KYC.
assert.match(onboarding, /Criar Minha Carteira/);
assert.match(onboarding, /Vincular carteira/);
assert.match(onboarding, /Premium/);
assert.equal(appConfig.extra.privyOptional, true);
assert.equal(appConfig.extra.balanceSource, 'ledger');
assert.equal(appConfig.extra.ledgerOperationsEnabled, true);

console.log(
  'Decimal inputs, Brazil KYC routing, full ledger access and optional non-blocking Privy validated.',
);
