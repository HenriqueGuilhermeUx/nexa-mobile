#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync('app/(app)/aave-info.tsx', 'utf8');
const backend = ['X-Nexa-App-Version','X-Nexa-App-Build','X-Nexa-Platform'];
for (const name of backend) assert.ok(src.includes("'"+name+"':"), name + ' missing');
assert.match(src, /const headers = aaveRequestHeaders\(session.accessToken\)/);
assert.match(src, /headers: aaveRequestHeaders\(session.accessToken\)/);
assert.match(src, /headers: \{ \.\.\.aaveRequestHeaders\(session.accessToken\), 'Content-Type': 'application\/json' \}/);
assert.match(src, /response.status === 426/);
assert.match(src, /data\?\.executionEnabled !== false/);
assert.match(src, /Nenhuma operação foi executada/);
console.log('Aave Android headers on status/markets/position/simulator/plan: PASS (read-only).');
