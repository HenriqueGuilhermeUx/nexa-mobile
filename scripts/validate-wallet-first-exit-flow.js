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
  'usePrivy',
  'ensurePrivyWalletSession',
  "pathname: '/wallet-session'",
  "returnTo: 'cash-out'",
  'createSmartWalletClient',
  'alchemyWalletTransport',
  'sendCalls',
  'waitForCallsStatus',
  'client_sponsored_eip7702',
  'getWalletFirstExitSwapSponsorshipCredentials',
  'getWalletFirstExitTransferSponsorshipCredentials',
  'gas da Polygon é patrocinado pela Nexa',
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

const completionCalls = [...screen.matchAll(/setPhase\('completed'\)/g)].map(
  (match) => match.index ?? -1,
);
const restoredCompletionCheck = screen.indexOf("payout === 'completed'");
const runtimeCompletionCheck = screen.indexOf(
  "currentPayoutStatus === 'completed'",
);
if (
  completionCalls.length !== 2 ||
  restoredCompletionCheck < 0 ||
  runtimeCompletionCheck < 0 ||
  restoredCompletionCheck > completionCalls[0] ||
  runtimeCompletionCheck > completionCalls[1]
) {
  throw new Error(
    'The app may only mark the exit completed after provider payout status is completed.',
  );
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
