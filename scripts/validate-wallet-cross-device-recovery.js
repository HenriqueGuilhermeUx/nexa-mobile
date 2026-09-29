const fs = require('fs');
const path = require('path');

const recoveryPath = path.join(process.cwd(), 'app/wallet-recovery.tsx');
const buyPath = path.join(process.cwd(), 'app/(app)/buy-crypto.tsx');
const layoutPath = path.join(process.cwd(), 'app/_layout.tsx');

for (const file of [recoveryPath, buyPath, layoutPath]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Wallet recovery safety file missing: ${file}`);
  }
}

const recovery = fs.readFileSync(recoveryPath, 'utf8');
const buy = fs.readFileSync(buyPath, 'utf8');
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

if (!buy.includes("router.push('/wallet-recovery' as any)")) {
  throw new Error('Missing-wallet signer must route to the recovery screen.');
}
if (!buy.includes('Nenhuma nova carteira será criada')) {
  throw new Error('Buy flow must explicitly preserve the already-linked wallet.');
}
if (!layout.includes('name="wallet-recovery"')) {
  throw new Error('Wallet recovery route is not registered in the app stack.');
}

console.log(
  'Cross-device wallet recovery safety validated: existing identity only, disableSignup enforced, exact linked address match, no wallet creation/relink.',
);
