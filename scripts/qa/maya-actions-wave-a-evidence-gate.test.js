#!/usr/bin/env node
// Offline regression checks for QA A evidence gate; synthetic evidence only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const gate = path.join(__dirname, 'maya-actions-wave-a-evidence-gate.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-a-'));
const base = {
  candidateSha: '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e',
  runtime: '2.0.43',
  packageId: 'br.com.trynexa.mayaqa',
  cases: Array.from({length: 16}, (_, i) => ({
    id: 'A' + String(i + 1).padStart(2, '0'),
    status: 'PASS', evidenceRef: 'synthetic-' + i,
    testedAt: '2026-11-06T12:00:00Z', device: 'synthetic-android'
  }))
};
function run(data) {
  const file = path.join(dir, 'evidence.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [gate, file], {encoding: 'utf8'});
}
try {
  assert.equal(run(base).status, 0, 'complete synthetic manifest should parse');
  for (const timestamp of ['2026-11-06T', 'invalid', '2026-99-99T12:00:00Z', '2026-02-30T12:00:00Z', '2026-04-31T12:00:00Z', '2025-02-29T12:00:00Z', '2099-01-01T00:00:00Z']) {
    const data = structuredClone(base);
    data.cases[0].testedAt = timestamp;
    assert.equal(run(data).status, 1, 'must reject timestamp: ' + timestamp);
  }
  const leap = structuredClone(base);
  leap.cases[0].testedAt = '2024-02-29T12:00:00Z';
  assert.equal(run(leap).status, 1, 'pre-candidate leap date must be rejected');
  const duplicate = structuredClone(base);
  duplicate.cases[1].id = 'A01';
  assert.equal(run(duplicate).status, 1, 'duplicate/missing case must fail');
  const missing = structuredClone(base);
  missing.cases[0].evidenceRef = '';
  assert.equal(run(missing).status, 1, 'missing evidence must fail');
  console.log('PASS: QA A gate synthetic regression checks; no physical QA asserted');
} finally {
  fs.rmSync(dir, {recursive: true, force: true});
}
