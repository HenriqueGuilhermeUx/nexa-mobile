const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const screen = read('app/(app)/cash-out.tsx');
const client = read('src/lib/walletFirstExit.ts');
const home = read('app/(app)/index.tsx');

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

const checks = [
  [
    'cash-out customer surface uses only Nexa quote language',
    screen.includes('Cotação Nexa') &&
      screen.includes('Você recebe aproximadamente') &&
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
    'quote call is read-only from the customer perspective and has no execution endpoints',
    client.includes('/direct-settlement/wallet-first/usdc-pilot/exit/quote') &&
      !client.includes('/sell/submit') &&
      !client.includes('/pix/approve') &&
      !client.includes('/intents'),
  ],
  [
    'Wallet-First home exposes Sacar separately from Add money and Activity',
    home.includes('label={legacy ? \'Atividade\' : \'Sacar\'}') &&
      home.includes("'/(app)/cash-out'") &&
      home.includes('label="Atividade"'),
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
