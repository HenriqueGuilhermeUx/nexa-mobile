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

// Cross-device recovery remains fail-closed: authenticate an existing Privy
// identity and accept only the exact wallet already linked to the Nexa account.
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

if (!layout.includes('name="wallet-recovery"')) {
  throw new Error('Wallet recovery route is not registered in the app stack.');
}

// v127 purchase recovery is intentionally inline. The purchase must find the
// exact wallet returned by the backend, use login-only OTP (no signup/new user),
// refresh the Privy session and force a fresh swap authorization after recovery.
const requiredInlinePurchaseTokens = [
  'useEmbeddedEthereumWallet',
  'useLoginWithEmail',
  'usePrivy',
  'props.credentials.wallet',
  'disableSignup: true',
  'emailLogin.sendCode',
  'emailLogin.loginWithCode',
  'privy.getAccessToken',
  'CARTEIRA RECONECTADA',
  'Atualizar autorização da compra',
  'onWalletReconnected',
  'Reconecte sua carteira Privy antes de confirmar a compra.',
];
for (const token of requiredInlinePurchaseTokens) {
  if (!buy.includes(token)) {
    throw new Error(`v127 inline purchase recovery contract missing: ${token}`);
  }
}

if (!buy.includes("if (privy?.user && !wallet && typeof privy?.logout === 'function')")) {
  throw new Error('Purchase recovery must clear a mismatched Privy session before login recovery.');
}
if (!buy.includes('String(candidate.address || \'\').toLowerCase()') ||
    !buy.includes('String(props.credentials.wallet || \'\').toLowerCase()')) {
  throw new Error('Purchase recovery must match the exact backend-authorized wallet address.');
}

for (const forbidden of [
  'embedded.create(',
  'createAdditional',
  'nexaApi.linkWallet',
  'A carteira Privy desta compra não está disponível neste dispositivo.',
]) {
  if (buy.includes(forbidden)) {
    throw new Error(`v127 purchase recovery contains an obsolete/unsafe token: ${forbidden}`);
  }
}

console.log(
  'Wallet recovery safety validated: exact cross-device wallet recovery + v127 inline login-only Privy session restoration with fresh purchase authorization.',
);
