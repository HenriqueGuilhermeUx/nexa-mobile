const fs = require('fs');
const path = require('path');

const files = {
  api: path.join(process.cwd(), 'src/lib/walletFirstActions.ts'),
  send: path.join(process.cwd(), 'app/(app)/send-nexa.tsx'),
  buy: path.join(process.cwd(), 'app/(app)/buy-crypto.tsx'),
  home: path.join(process.cwd(), 'app/(app)/index.tsx'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Wallet-First mobile ${name} file missing: ${file}`);
}

const api = fs.readFileSync(files.api, 'utf8');
const send = fs.readFileSync(files.send, 'utf8');
const buy = fs.readFileSync(files.buy, 'utf8');
const home = fs.readFileSync(files.home, 'utf8');
const combined = `${api}\n${send}\n${buy}`;

const required = [
  '/wallet-v15/transfer/onchain-direct/prepare',
  '/wallet-v15/transfer/onchain-direct/confirm',
  '/wallet-v15/swap/quote',
  '/wallet-v15/swap/prepare',
  '/wallet-v15/swap/confirm',
  "method: 'eth_sendTransaction'",
  "method: 'eth_accounts'",
  "method: 'eth_chainId'",
  "method: 'wallet_switchEthereumChain'",
  "chainId: '0x89'",
  'sendPreparedWalletTransaction',
  'A carteira ativa não corresponde à carteira vinculada à Nexa.',
];
for (const token of required) {
  if (!combined.includes(token)) {
    throw new Error(`Wallet-First mobile user-action contract missing: ${token}`);
  }
}

const forbidden = [
  '/internal-transfer/',
  '/payment/pix/redemption',
  'TREASURY_PRIVATE_KEY',
  'WALLET_PRIVATE_KEY',
  'PRIVATE_KEY',
  'send-by-username',
];
for (const token of forbidden) {
  if (combined.includes(token)) {
    throw new Error(`Wallet-First mobile user action must not use legacy/custodial path: ${token}`);
  }
}

const sendRequired = [
  'NEXA → NEXA',
  'Revisar transferência',
  'Confirmar e assinar',
  "response?.route !== 'ONCHAIN_DIRECT'",
  'Não passa pelo saldo interno da Nexa.',
];
for (const token of sendRequired) {
  if (!send.includes(token)) throw new Error(`Nexa-to-Nexa customer safety copy missing: ${token}`);
}

const buyRequired = [
  "type Asset = 'BTC' | 'ETH'",
  'Cotação Nexa',
  "asset === 'BTC' ? 'WBTC' : 'WETH'",
  'A Nexa não possui sua chave',
  'approvalRequired',
  'approvalTransaction',
  'swapTransaction',
];
for (const token of buyRequired) {
  if (!buy.includes(token)) throw new Error(`Wallet-First buy customer contract missing: ${token}`);
}

if (!home.includes('label="Enviar"') || !home.includes('label="Comprar"')) {
  throw new Error('Wallet-First Home must surface Enviar and Comprar actions.');
}

console.log(
  'Wallet-First mobile user actions validated: direct Nexa-to-Nexa, BTC/ETH user-signed swaps, Polygon binding and no legacy ledger route.',
);
