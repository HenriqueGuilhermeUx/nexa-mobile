#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const helperPath = path.resolve(__dirname, '../src/lib/aaveEducationalSimulation.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const emitted = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
assert.equal((emitted.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const moduleObj = { exports: {} };
vm.runInNewContext(emitted.outputText, { module: moduleObj, exports: moduleObj.exports }, { filename: helperPath });
const { simulateAaveEducationalScenario: simulate } = moduleObj.exports;
const base = { collateralUsd: 1000, borrowUsd: 400, priceDropPercent: 25, referenceLtvPercent: 60 };
const safe = simulate(base);
assert.equal(safe.stressedCollateralUsd, 750);
assert.equal(safe.originalLtvPercent, 40);
assert.ok(Math.abs(safe.stressedLtvPercent - 53.3333333) < 0.0001);
assert.equal(safe.outsideReferenceLtv, false);
const risky = simulate({ ...base, priceDropPercent: 50 });
assert.equal(risky.stressedLtvPercent, 80);
assert.equal(risky.outsideReferenceLtv, true);
const gone = simulate({ ...base, priceDropPercent: 100 });
assert.equal(gone.stressedLtvPercent, null);
assert.equal(gone.outsideReferenceLtv, true);
const noDebt = simulate({ ...base, priceDropPercent: 100, borrowUsd: 0 });
assert.equal(noDebt.stressedLtvPercent, 0);
assert.equal(noDebt.outsideReferenceLtv, false);
for (const invalid of [
  { ...base, collateralUsd: 0 }, { ...base, priceDropPercent: 101 },
  { ...base, borrowUsd: -1 }, { ...base, collateralUsd: NaN },
]) assert.throws(() => simulate(invalid), /Invalid educational scenario/);
const screen = fs.readFileSync(path.resolve(__dirname, '../app/(app)/aave-info.tsx'), 'utf8');
for (const needed of [
  'simulateAaveEducationalScenario', 'Resultado da simulação hipotética',
  'simulationIssue', 'marketIssue', 'positionIssue',
  'Verificar intenção está desativado',
]) assert.ok(screen.includes(needed), 'Missing explicit local scenario/diagnostic marker: ' + needed);
assert.ok(!screen.includes("fetch(API + '/invest-credit/simulate-collateral"), 'Simulation must be independent of live API flags');
for (const forbidden of ['sendTransaction(', 'signTransaction(', 'eth_sendRawTransaction', 'walletClient.writeContract']) {
  assert.ok(!screen.includes(forbidden));
  assert.ok(!source.includes(forbidden));
}
console.log('Aave QA local educational simulation PASS; zero RPC/signing/execution.');
