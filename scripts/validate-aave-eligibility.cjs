#!/usr/bin/env node
'use strict';
// Run: node scripts/validate-aave-eligibility.cjs (after npm ci).
// Unit checks for QA planning only; this is not on-chain Aave eligibility or transaction approval.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const helperPath = path.resolve(__dirname, '../src/lib/aaveReserveEligibility.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const emitted = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
const errors = (emitted.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, 'Aave helper must transpile without errors');
const moduleObj = { exports: {} };
vm.runInNewContext(emitted.outputText, { module: moduleObj, exports: moduleObj.exports }, { filename: helperPath });
const { aaveReserveEligibleForPlanning: eligible } = moduleObj.exports;
assert.equal(typeof eligible, 'function');

const active = { active: true, paused: false, frozen: false, borrowingEnabled: true };
for (const action of ['SUPPLY', 'BORROW', 'REPAY', 'WITHDRAW']) {
  assert.equal(eligible(active, action), true, 'Active reserve: ' + action);
  assert.equal(eligible({ ...active, active: false }, action), false, 'Inactive: ' + action);
  assert.equal(eligible({ ...active, paused: true }, action), false, 'Paused: ' + action);
}
assert.equal(eligible({ ...active, frozen: true }, 'SUPPLY'), false);
assert.equal(eligible({ ...active, frozen: true }, 'BORROW'), false);
assert.equal(eligible({ ...active, frozen: true }, 'REPAY'), true);
assert.equal(eligible({ ...active, frozen: true }, 'WITHDRAW'), true);
assert.equal(eligible({ ...active, borrowingEnabled: false }, 'BORROW'), false);
for (const action of ['SUPPLY', 'REPAY', 'WITHDRAW']) {
  assert.equal(eligible({ ...active, borrowingEnabled: false }, action), true, 'No borrowing: ' + action);
}
const screen = fs.readFileSync(path.resolve(__dirname, '../app/(app)/aave-info.tsx'), 'utf8');
assert.match(screen, /aaveReserveEligibleForPlanning\(r, action\)/);
assert.match(screen, /aaveReserveEligibleForPlanning\(reserve, action\)/);
assert.match(screen, /data\?\.executionEnabled !== false/);
assert.match(screen, /Nenhuma operação foi executada/);
console.log('Aave isolated QA planning gates PASS (no transactions).');
