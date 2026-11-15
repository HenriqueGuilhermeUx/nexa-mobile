#!/usr/bin/env node
// Synthetic QA A manifest cardinality regression; never validates a real device.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const gate = path.join(__dirname, 'maya-actions-wave-a-evidence-gate.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-cardinality-'));
const base = {
  candidateSha: '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e',
  runtime: '2.0.43',
  packageId: 'br.com.trynexa.app',
  easBranch: 'maya-actions-v148-qa',
  androidUpdateId: '01a1a975-d85f-794f-9d67-cf2ac961fbb7',
  cases: Array.from({ length: 16 }, (_, i) => ({
    id: 'A' + String(i + 1).padStart(2, '0'),
    status: 'PASS',
    evidenceRef: 'synthetic-proof-' + i,
    testedAt: '2026-11-06T12:00:00Z',
    device: 'synthetic-android'
  }))
};
function check(data) {
  const file = path.join(dir, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [gate, file], { encoding: 'utf8' });
}
try {
  assert.equal(check(base).status, 0, 'complete synthetic shape should parse');
  const mutations = [
    ['missing A16', data => data.cases.pop()],
    ['duplicate A01', data => data.cases.push({ ...data.cases[0], evidenceRef: 'another-proof' })],
    ['unknown A17', data => data.cases.push({ ...data.cases[0], id: 'A17', evidenceRef: 'another-proof' })],
    ['renamed A16', data => { data.cases[15].id = 'A17'; }],
    ['missing device', data => { delete data.cases[0].device; }],
    ['missing timestamp', data => { delete data.cases[0].testedAt; }],
    ['duplicate A16 with different proof', data => data.cases.push({ ...data.cases[15], evidenceRef: 'another-a16-proof' })],
    ['extra malformed case record', data => data.cases.push(null)],
    ['extra noncanonical case ID', data => data.cases.push({ ...data.cases[0], id: 'a01', evidenceRef: 'another-lowercase-proof' })]
  ];
  for (const [name, mutate] of mutations) {
    const data = structuredClone(base);
    mutate(data);
    const result = check(data);
    assert.equal(result.status, 1, name + ' must be rejected');
    assert.match(result.stderr, /NO-GO/, name + ' must report NO-GO');
  }
  console.log('QA A cardinality regression: 9 synthetic rejection cases passed (not device QA).');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
