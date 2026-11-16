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
    ['explicit failed physical case', data => { data.cases[0].status = 'FAIL'; }],
    ['empty evidence reference', data => { data.cases[0].evidenceRef = ''; }],
    ['reused local proof across cases', data => { data.cases[1].evidenceRef = data.cases[0].evidenceRef; }],
    ['missing timestamp', data => { delete data.cases[0].testedAt; }],
    ['duplicate A16 with different proof', data => data.cases.push({ ...data.cases[15], evidenceRef: 'another-a16-proof' })],
    ['extra malformed case record', data => data.cases.push(null)],
    ['extra noncanonical case ID', data => data.cases.push({ ...data.cases[0], id: 'a01', evidenceRef: 'another-lowercase-proof' })],
    ['impossible calendar date', data => { data.cases[0].testedAt = '2026-02-30T12:00:00Z'; }],
    ['invalid timezone offset', data => { data.cases[0].testedAt = '2026-11-06T12:00:00+14:30'; }],
    ['invalid hour', data => { data.cases[0].testedAt = '2026-11-06T24:00:00Z'; }],
    ['invalid April 31', data => { data.cases[0].testedAt = '2026-04-31T12:00:00Z'; }],
    ['invalid November 31', data => { data.cases[0].testedAt = '2026-11-31T12:00:00Z'; }],
    ['invalid second 60', data => { data.cases[0].testedAt = '2026-11-06T12:00:60Z'; }],
    ['non-leap February 29', data => { data.cases[0].testedAt = '2026-02-29T12:00:00Z'; }],
    ['month zero', data => { data.cases[0].testedAt = '2026-00-06T12:00:00Z'; }],
    ['month thirteen', data => { data.cases[0].testedAt = '2026-13-06T12:00:00Z'; }],
    ['day zero', data => { data.cases[0].testedAt = '2026-11-00T12:00:00Z'; }],
    ['invalid negative timezone offset', data => { data.cases[0].testedAt = '2026-11-06T12:00:00-14:30'; }],
    ['timezone beyond 14 hours', data => { data.cases[0].testedAt = '2026-11-06T12:00:00+15:00'; }],
    ['duplicate HTTPS proof with canonical host and default port', data => { data.cases[0].evidenceRef = 'https://QA-PROOFS.example.test:443/A01'; data.cases[1].evidenceRef = 'https://qa-proofs.example.test/A01'; }],
    ['duplicate HTTPS proof with unreserved percent encoding', data => { data.cases[0].evidenceRef = 'https://qa-proofs.example.test/A01'; data.cases[1].evidenceRef = 'https://qa-proofs.example.test/%41%30%31'; }],
    ['duplicate HTTPS proof with trailing DNS dot', data => { data.cases[0].evidenceRef = 'https://qa-proofs.example.test./A01'; data.cases[1].evidenceRef = 'https://qa-proofs.example.test/A01'; }],
    ['duplicate Unicode NFC proof', data => { data.cases[0].evidenceRef = 'proof-caf\u00e9'; data.cases[1].evidenceRef = 'proof-cafe\u0301'; }],
    ['duplicate local proof after safe percent decoding', data => { data.cases[0].evidenceRef = 'proof-A01'; data.cases[1].evidenceRef = 'proof-%41%30%31'; }],
    ['wrong frozen candidate SHA', data => { data.candidateSha = '0'.repeat(40); }],
    ['wrong runtime', data => { data.runtime = '2.0.44'; }],
    ['standalone package is not EAS QA proof', data => { data.packageId = 'br.com.trynexa.mayaqa'; }],
    ['wrong EAS branch', data => { data.easBranch = 'production'; }],
    ['wrong Android EAS update', data => { data.androidUpdateId = '00000000-0000-0000-0000-000000000000'; }]
  ];
  for (const [name, mutate] of mutations) {
    const data = structuredClone(base);
    mutate(data);
    const result = check(data);
    assert.equal(result.status, 1, name + ' must be rejected');
    assert.match(result.stderr, /NO-GO/, name + ' must report NO-GO');
  }
  const leapBoundary = structuredClone(base);
  leapBoundary.cases[0].testedAt = '2028-02-29T12:00:00Z';
  // This date is in the future during 2026; the gate must reject it until a real test occurs.
  assert.equal(check(leapBoundary).status, 1, 'future leap-day evidence must not be accepted');
  const boundary = structuredClone(base);
  boundary.cases[0].testedAt = '2026-11-06T12:00:00+14:00';
  assert.equal(check(boundary).status, 0, 'valid maximum positive UTC offset must parse');
  boundary.cases[0].testedAt = '2026-11-06T12:00:00-14:00';
  assert.equal(check(boundary).status, 0, 'valid maximum negative UTC offset must parse');
  console.log('QA A cardinality regression: 33 synthetic rejection, 1 future-date rejection and 2 timezone boundary acceptance cases passed (not device QA).');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
