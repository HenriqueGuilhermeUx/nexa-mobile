const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const screen = read('app/(app)/cash-out.tsx');
const client = read('src/lib/walletFirstExit.ts');
const home = read('app/(app)/index.tsx');
const premiumShell = read('src/components/AlignedLegacyApp.tsx');

const customerSurface = `${screen}\n${client}`.toLowerCase();
const forbiddenCustomerTerms = [
  'foxbit',
  'slippage',
  'spread',
  'providerbid',
  'provider fee',
  'trading fee',
  'taxa foxbit',
];

const quoteStart = client.indexOf('export async function getWalletFirstExitQuote');
const executionStart = client.indexOf('export function createWalletFirstExitIntent');
const quoteFunction =
  quoteStart >= 0 && executionStart > quoteStart
    ? client.slice(quoteStart, executionStart)
    : '';

const checks = [
  [
    'cash-out customer surface uses only Nexa quote language',
    screen.includes('Cotação Nexa') &&
      screen.includes('Você recebe') &&
      screen.includes('nexaRateBrl') &&
      screen.includes('estimatedPayoutBrl'),
  ],
  [
    'customer surface does not expose provider or pricing internals',
    forbiddenCustomerTerms.every((term) => !customerSurface.includes(term)),
  ],
  [
    'quote request is authenticated and sends required app identity headers',
    client.includes("Authorization: `Bearer ${accessToken}`") &&
      client.includes("'X-Nexa-App-Version': config.appVersion") &&
      client.includes("'X-Nexa-App-Build': config.appBuild") &&
      client.includes("'X-Nexa-Platform': Platform.OS"),
  ],
  [
    'quote function itself remains read-only and isolated from execution endpoints',
    quoteFunction.includes('`${EXIT_BASE}/quote`') &&
      !quoteFunction.includes('/sell/submit') &&
      !quoteFunction.includes('/pix/approve') &&
      !quoteFunction.includes('/intents'),
  ],
  [
    'unified premium shell exposes Wallet-First cash-out without a second home',
    premiumShell.includes('title="Sacar"') &&
      premiumShell.includes("router.push('/(app)/cash-out'") &&
      premiumShell.includes('Movimentações') &&
      premiumShell.includes('Assistente Nexa'),
  ],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`PASS ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed) {
  console.error(`\n${failed} Wallet-First exit quote UI check(s) failed.`);
  process.exit(1);
}

console.log('\nWallet-First sanitized exit quote UI validated.');
