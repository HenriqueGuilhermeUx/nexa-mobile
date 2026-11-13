#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync('app/(app)/aave-info.tsx', 'utf8');
for (const name of ['X-Nexa-App-Version','X-Nexa-App-Build','X-Nexa-Platform']) {
  assert.ok(src.includes("'"+name+"':"), name + ' missing');
}
assert.ok(src.includes('const headers = aaveRequestHeaders(session.accessToken);'));
assert.ok(src.includes('headers: aaveRequestHeaders(session.accessToken),'));
assert.ok(src.includes("headers: { ...aaveRequestHeaders(session.accessToken), 'Content-Type': 'application/json' },"));
assert.ok(src.includes('response.status === 426'));
assert.ok(src.includes('data?.executionEnabled !== false'));
assert.ok(src.includes('Nenhuma operação foi executada'));
console.log('Aave Android headers across status/markets/position/simulator/plan: PASS (no execution).');
