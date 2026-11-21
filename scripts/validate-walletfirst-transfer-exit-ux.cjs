const fs = require('node:fs');
const assert = require('node:assert/strict');
const transfer = fs.readFileSync('app/(app)/send-nexa.tsx','utf8');
const exit = fs.readFileSync('app/(app)/cash-out.tsx','utf8');
const api = fs.readFileSync('src/lib/walletFirstExit.ts','utf8');
for (const line of [
  'WALLET_V15_TRANSFER_INTENT_SECRET_NOT_CONFIGURED',
  'ONCHAIN_DIRECT_SIGNED_INTENT_NOT_READY',
  'INSUFFICIENT_ONCHAIN_USDC',
  'prepareDirectTransfer',
  'sendPreparedWalletTransaction',
  'confirmDirectTransfer',
]) assert.ok(transfer.includes(line),'Transfer safe path absent: '+line);
for (const line of [
  'getWalletFirstExitReadiness',
  'eligibility?.available !== true',
  'getWalletFirstExitQuote',
]) assert.ok(exit.includes(line),'Exit safe preflight absent: '+line);
assert.ok(exit.indexOf('getWalletFirstExitReadiness(accessToken)') < exit.indexOf('getWalletFirstExitQuote(accessToken, amount)'), 'Preflight must precede quote');
assert.ok(api.includes("method: 'GET'"));
assert.ok(api.includes('USER_NOT_IN_PILOT_ALLOWLIST'));
assert.ok(api.includes('WALLET_FIRST_EXIT_CUSTOMER_SIGNING_DISABLED'));
assert.ok(api.includes('Seus USDC continuam'));
console.log('WALLET_FIRST_TRANSFER_EXIT_UX_QA=PASS');
