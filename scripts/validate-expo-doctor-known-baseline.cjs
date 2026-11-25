'use strict';
/**
 * Temporary, fail-closed Expo Doctor baseline guard. 
 * Expo SDK 57 patch updates are tracked separately (#202).
 * Never remove/skip any other Expo Doctor check, and fail on any new mismatch.
 */
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const expected = new Map([
  ['expo', ['~57.0.34','57.0.31']],
  ['expo-build-properties', ['~57.0.24','57.0.22']],
  ['expo-constants', ['~57.0.25','57.0.22']],
  ['expo-dev-client', ['~57.0.22','57.0.20']],
  ['expo-router', ['~57.0.32','57.0.29']],
  ['expo-splash-screen', ['~57.0.12','57.0.10']],
  ['expo-updates', ['~57.0.29','57.0.26']],
]);
const current = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const knownDeclared = {
  expo:'~57.0.26',
  'expo-build-properties':'~57.0.22',
  'expo-constants':'~57.0.20',
  'expo-dev-client':'57.0.20',
  'expo-router':'~57.0.24',
  'expo-splash-screen':'57.0.10',
  'expo-updates':'~57.0.23',
};
for (const [key,version] of Object.entries(knownDeclared)) {
  assert.equal(current.dependencies?.[key], version, 'Dependency changed: remove temporary baseline allowance and run full Expo Doctor');
}
function doctor(env = {}) {
  const r = spawnSync('npx',['expo-doctor'],{
    encoding:'utf8', env:{...process.env,...env},timeout:180000,
    maxBuffer:1024*1024*4,
  });
  if (r.error) throw r.error;
  return {status:r.status, output:(r.stdout||'')+'\n'+(r.stderr||'')};
}
const full = doctor();
if (full.status === 0) {
  console.info('NEXA_EXPO_DOCTOR_FULL=PASS; no known-baseline exception needed');
  process.exit(0);
}
const mismatch = new Map();
for (const line of full.output.split('\n')) {
  const match = line.trim().match(/^(expo(?:-[a-z-]+)?)\s+(~?\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+)\s*$/);
  if (match) {
    assert.ok(!mismatch.has(match[1]),'Duplicate Expo dependency mismatch');
    mismatch.set(match[1],[match[2],match[3]]);
  }
}
assert.match(full.output,/20\/21 checks passed\. 1 checks failed\./,
  'Unexpected Expo Doctor failure: check full output and resolve it');
assert.equal(mismatch.size,expected.size,'Unexpected package version mismatch count');
for (const [name,versions] of expected) {
  assert.deepEqual(mismatch.get(name),versions,'Unexpected Expo Doctor version mismatch: '+name);
}
console.warn('NEXA_EXPO_DOCTOR_BASELINE=7_KNOWN_PATCH_MISMATCHES_ONLY; issue #202; full doctor still fails');
const rest = doctor({EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK:'1'});
if (rest.status !== 0) {
  console.error(rest.output);
  throw new Error('One or more non-version Expo Doctor checks failed');
}
console.info('NEXA_EXPO_DOCTOR_OTHER_CHECKS=PASS; no new errors; dependency patch debt remains tracked in #202');
