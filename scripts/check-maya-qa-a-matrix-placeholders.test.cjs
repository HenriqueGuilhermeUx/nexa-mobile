// Regression tests for the QA A physical evidence matrix validator.
// Uses temporary fixtures; never changes the real matrix or approves device QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = fs.readFileSync(path.join(__dirname, 'check-maya-qa-a-matrix.cjs'), 'utf8');
const ids = [
  ...Array.from({ length: 6 }, (_, i) => `A0${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `P0${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `R0${i + 1}`),
];
function validate(reference) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-matrix-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'scripts', 'check-maya-qa-a-matrix.cjs'), source);
    const rows = ids.map((id, i) =>
      `| ${id} | Observe case ${id} | ${i === 0 ? 'PASS' : 'PENDENTE'} | ${i === 0 ? reference : '—'} |`);
    fs.writeFileSync(path.join(dir, 'docs', 'maya-actions-qa-a-physical-capture-matrix.md'), rows.join('\n'));
    return spawnSync(process.execPath, [path.join(dir, 'scripts', 'check-maya-qa-a-matrix.cjs')], { encoding: 'utf8' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
test('rejects example.com evidence URL', () => {
  assert.notEqual(validate('https://example.com/video.mp4').status, 0);
});
test('rejects local-only evidence URL', () => {
  assert.notEqual(validate('http://localhost:8080/capture.mp4').status, 0);
});
test('rejects template evidence', () => {
  assert.notEqual(validate('[insira arquivo real]').status, 0);
});
test('accepts a structurally plausible unique evidence path (not physical approval)', () => {
  assert.equal(validate('evidence/qa-a/A01-device-capture-20261108.mp4').status, 0);
});
