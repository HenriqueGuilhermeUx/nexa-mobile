const fs = require('fs');
const path = require('path');

const recoveryPath = path.join(process.cwd(), 'app/wallet-recovery.tsx');
const buyPath = path.join(process.cwd(), 'app/(app)/buy-crypto.tsx');
const authHandoffPath = path.join(process.cwd(), 'src/lib/privyPurchaseAuthorization.ts');
const layoutPath = path.join(process.cwd(), 'app/_layout.tsx');

for (const file of [recoveryPath, buyPath, authHandoffPath, layoutPath]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Wallet recovery safety file missing: ${file}`);
  }
}

const recovery = fs.readFileSync(recoveryPath, 'utf8');
const buy = fs.readFileSync(buyPath, 'utf8');
const authHandoff = fs.readFileSync(authHandoffPath, 'utf8');
const layout = fs.readFileSync(layoutPath, 'utf8');

const requiredRecoveryTokens = [
  'useLoginWithEmail',
  'useEmbeddedEthereumWallet',
  'loadNexaSession',
  'nexaApi.directProfile',
  'nexaApi.me',
  'disableSignup: true',
  'emailLogin.sendCode',
  'emailLogin.loginWithCode',
  'expectedWallet',
  'localAddresses.includes(normalizeAddress(expectedWallet))',
  'Nenhuma nova carteira foi criada',
  'Recupere a mesma carteira',
];
for (const token of requiredRecoveryTokens) {
  if (!recovery.includes(token)) {
    throw new Error(`Cross-device wallet recovery safety contract missing: ${token}`);
  }
}

const requiredPurchaseAuthTokens = [
  'useIdentityToken',
  'returnToPurchase',
  'waitForIdentityToken',
  'stashPurchaseIdentityToken',
  'router.back()',
  "pathname: '/wallet-recovery'",
  'consumePurchaseIdentityToken',
  'getIdentityToken',
];
for (const token of requiredPurchaseAuthTokens) {
  if (!recovery.includes(token) && !buy.includes(token) && !authHandoff.includes(token)) {
    throw new Error(`Sponsored purchase authorization contract missing: ${token}`);
  }
}

if (!recovery.includes("if (!returnToPurchase && typeof privy?.logout === 'function'")) {
  throw new Error('Sponsored purchase authorization must not log out the active Privy session.');
}

const forbiddenRecoveryTokens = [
  'embedded.create(',
  'createAdditional',
  'linkWallet(',
  'nexaApi.linkWallet',
  'walletAddress:',
];
for (const token of forbiddenRecoveryTokens) {
  if (recovery.includes(token)) {
    throw new Error(`Wallet recovery must never create or relink a wallet: ${token}`);
  }
}

if (!layout.includes('name="wallet-recovery"')) {
  throw new Error('Wallet recovery route is not registered in the app stack.');
}

console.log(
  'Wallet recovery safety validated: exact wallet match remains for cross-device recovery; sponsored purchase uses Privy identity JWT without local-wallet gating or wallet creation/relink.',
);
