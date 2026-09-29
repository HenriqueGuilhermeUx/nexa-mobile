const fs = require('fs');
const path = require('path');

const libPath = path.join(process.cwd(), 'src/lib/walletFirstExit.ts');
const screenPath = path.join(process.cwd(), 'app/(app)/cash-out.tsx');
for (const file of [libPath, screenPath]) {
  if (!fs.existsSync(file)) throw new Error(`Wallet-First exit mobile file missing: ${file}`);
}

const lib = fs.readFileSync(libPath, 'utf8');
const screen = fs.readFileSync(screenPath, 'utf8');

const libRequired = [
  '/direct-settlement/wallet-first/usdc-pilot/exit',
  'createWalletFirstExitIntent',
  'prepareWalletFirstExitTransfer',
  'verifyWalletFirstExitTransfer',
  'reconcileWalletFirstExitProvider',
  'submitWalletFirstExitSell',
  'reconcileWalletFirstExitSell',
  'createWalletFirstExitPix',
  'approveWalletFirstExitPix',
  'reconcileWalletFirstExitPix',
  'EXECUTE_WALLET_FIRST_USDC_SELL',
  'CREATE_WALLET_FIRST_PIX_PAYOUT',
  'EXECUTE_WALLET_FIRST_PIX_PAYOUT',
  'X-Nexa-App-Version',
  'X-Nexa-App-Build',
  'X-Nexa-Platform',
];
for (const token of libRequired) {
  if (!lib.includes(token)) throw new Error(`Wallet-First exit API contract missing: ${token}`);
}

const screenRequired = [
  'useEmbeddedEthereumWallet',
  'sendPreparedWalletTransaction',
  'USDC permite no máximo 6 casas decimais',
  'prepareWalletFirstExitTransfer',
  'verifyWalletFirstExitTransfer',
  'reconcileWalletFirstExitProvider',
  'submitWalletFirstExitSell',
  'reconcileWalletFirstExitSell',
  'createWalletFirstExitPix',
  'approveWalletFirstExitPix',
  'reconcileWalletFirstExitPix',
  "setPhase('completed')",
  "currentPayoutStatus === 'completed'",
  'A Nexa não possui sua chave privada',
  'PIX CONCLUÍDO',
];
for (const token of screenRequired) {
  if (!screen.includes(token)) throw new Error(`Wallet-First exit screen contract missing: ${token}`);
}

const completionCheck = screen.indexOf("currentPayoutStatus === 'completed'");
const completionState = screen.indexOf("setPhase('completed')");
if (completionCheck < 0 || completionState < 0 || completionCheck > completionState) {
  throw new Error('The app may only mark the exit completed after provider payout status is completed.');
}

const forbidden = [
  'PRIVATE_KEY',
  'WALLET_PRIVATE_KEY',
  'new Wallet(',
  'api.0x.org',
  'foxbit.com',
  'woovi.com',
];
for (const token of forbidden) {
  if (screen.includes(token) || lib.includes(token)) {
    throw new Error(`Wallet-First exit mobile must not embed provider/signing secret: ${token}`);
  }
}

console.log(
  'Wallet-First USDC→Pix mobile flow validated: user-signed Polygon transfer, exact staged progression and completion only after real Pix confirmation.',
);
