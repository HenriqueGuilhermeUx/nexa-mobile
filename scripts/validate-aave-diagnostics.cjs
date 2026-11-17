#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const aave = fs.readFileSync('app/(app)/aave-info.tsx', 'utf8');
for (const marker of [
  "response.status === 426",
  "response.status === 401",
  "marketsResult.status === 503",
  "positionResult.status === 403",
  "carteira Privy com titularidade verificada necessária",
  "read('aave/markets')",
  "read('aave/me')",
  "executionEnabled !== false",
  "Nenhuma operação foi executada",
]) assert.ok(aave.includes(marker), 'Aave QA safety/diagnostic marker missing: ' + marker);
for (const forbidden of ['walletClient.writeContract', 'sendTransaction(', 'eth_sendRawTransaction', 'signTransaction(']) {
  assert.ok(!aave.includes(forbidden), 'Unexpected on-chain execution primitive in Aave QA: ' + forbidden);
}
console.log('Aave QA: status 401/403/426/503 diagnostics and execution prohibition PASS.');
