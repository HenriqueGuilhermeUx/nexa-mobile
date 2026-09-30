const fs = require('fs');
const path = require('path');

const files = {
  api: path.join(process.cwd(), 'src/lib/walletFirstActions.ts'),
  send: path.join(process.cwd(), 'app/(app)/send-nexa.tsx'),
  buy: path.join(process.cwd(), 'app/(app)/buy-crypto.tsx'),
  funding: path.join(process.cwd(), 'app/(app)/fund-card.tsx'),
  addMoney: path.join(process.cwd(), 'app/(app)/new-order.tsx'),
  rootLayout: path.join(process.cwd(), 'app/_layout.tsx'),
  home: path.join(process.cwd(), 'app/(app)/index.tsx'),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Wallet-First mobile ${name} file missing: ${file}`);
}

const api = fs.readFileSync(files.api, 'utf8');
const send = fs.readFileSync(files.send, 'utf8');
const buy = fs.readFileSync(files.buy, 'utf8');
const funding = fs.readFileSync(files.funding, 'utf8');
const addMoney = fs.readFileSync(files.addMoney, 'utf8');
const rootLayout = fs.readFileSync(files.rootLayout, 'utf8');
const home = fs.readFileSync(files.home, 'utf8');
const combined = `${api}\n${send}\n${buy}`;

const required = [
  '/wallet-v15/transfer/onchain-direct/prepare',
  '/wallet-v15/transfer/onchain-direct/confirm',
  '/wallet-v15/swap/quote',
  '/wallet-v15/swap/prepare',
  '/wallet-v15/swap/confirm',
  '/wallet-v15/swap/execute-sponsored',
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
  'executeSponsoredWalletFirstSwap',
  'useIdentityToken',
  'getIdentityToken',
  'swapTransaction',
  'AUTORIZAÇÃO SEGURA',
  'Confirmar compra',
  'A Nexa cuida automaticamente',
];
for (const token of buyRequired) {
  if (!buy.includes(token)) throw new Error(`Wallet-First sponsored buy contract missing: ${token}`);
}

for (const token of ['usePrivy', 'getAccessToken']) {
  if (buy.includes(token)) {
    throw new Error(`Sponsored wallet authorization must use the Privy identity JWT, not ${token}.`);
  }
}

const buyForbidden = [
  'sendPreparedWalletTransaction',
  'approvalTransaction',
  "method: 'eth_sendTransaction'",
  'WBTC',
  'WETH',
  'Polygon ·',
  'gas fee',
  'POL',
  'MATIC',
];
for (const token of buyForbidden) {
  if (buy.includes(token)) {
    throw new Error(`Wallet-First sponsored buy must hide direct network mechanics: ${token}`);
  }
}

const fundingRequired = [
  'useFundWallet',
  "asset: 'USDC'",
  "defaultPaymentMethod: 'card'",
  "preferredProvider: 'moonpay'",
  'Cartão, Apple Pay ou Google Pay',
  'wallet-recovery',
];
for (const token of fundingRequired) {
  if (!funding.includes(token)) throw new Error(`Funding contract missing: ${token}`);
}
if (!rootLayout.includes('PrivyElements')) {
  throw new Error('PrivyElements must be mounted for the native funding flow.');
}
if (!addMoney.includes('Cartão · Apple Pay · Google Pay') || !addMoney.includes("/(app)/fund-card")) {
  throw new Error('Adicionar dinheiro must surface the card funding route alongside Pix.');
}

if (!home.includes('label="Enviar"') || !home.includes('label="Comprar"')) {
  throw new Error('Wallet-First Home must surface Enviar and Comprar actions.');
}

console.log(
  'Wallet-First mobile user actions validated: direct Nexa-to-Nexa, identity-JWT sponsored BTC/ETH swaps, gas abstraction, Privy/MoonPay funding and no legacy ledger route.',
);
