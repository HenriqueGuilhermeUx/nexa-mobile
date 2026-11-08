// QA A matrix integrity check. This checks documentation structure only; never approves physical QA.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const file = path.join(__dirname, '..', 'docs', 'maya-actions-qa-a-physical-capture-matrix.md');
const markdown = fs.readFileSync(file, 'utf8');
const expected = [
  ...Array.from({ length: 6 }, (_, i) => `A0${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `P0${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `R0${i + 1}`),
];
// Pin the tested OTA identity; a different binary/update requires a separate QA matrix.
const requiredIdentityLines = [
  /^- Aplicativo QA A: `br\.com\.trynexa\.app`; versionCode `148`; runtime `2\.0\.43`\.$/m,
  /^- SHA congelado: `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`\.$/m,
  /^- Android EAS update: `01a1a975-d85f-794f-9d67-cf2ac961fbb7`; branch `maya-actions-v148-qa`\.$/m,
];
for (const pattern of requiredIdentityLines) {
  assert.match(markdown, pattern, 'QA A identity must match the exact labeled release fields');
}
const table = markdown.split(/\r?\n/).filter(line => /^\|\s*[^|]+\|/.test(line) && !/^\|\s*(?:Caso|[-:\s]+)\s*\|/.test(line));
const rows = table.filter(line => /^\|\s*[APR]0[1-9]\s*\|/.test(line));
assert.equal(table.length, rows.length, 'QA A must not contain unknown or malformed case IDs');
const ids = rows.map(line => line.split('|')[1].trim());
assert.deepEqual([...ids].sort(), [...expected].sort(), 'QA A must contain exactly 16 unique canonical case IDs');
const evidenceRefs = new Set();
for (const row of rows) {
  const cells = row.split('|').slice(1, -1).map(x => x.trim());
  assert.equal(cells.length, 4, 'Each case must have four columns');
  assert.ok(cells[1], 'Every case needs an observable step');
  assert.match(cells[2], /^(PENDENTE|PASS|FAIL|BLOQUEADO)$/, 'Unrecognized QA state');
  if (cells[2] === 'PASS') {
    assert.notEqual(cells[3], '—', 'PASS requires a recorded evidence reference');
    assert.ok(cells[3].length >= 8, 'PASS evidence reference is too short');
    assert.doesNotMatch(cells[3], /^(?:pendente|todo|tbd|n\/a|sem evid[eê]ncia|placeholder|exemplo)(?:\b|$)/i, 'PASS cannot use placeholder evidence');
    assert.doesNotMatch(cells[3], /(?:example\.(?:com|org|net)|localhost|127\.0\.0\.1|dummy|fake|mock|sample|teste[-_ ]?fict[ií]cio)/i, 'PASS cannot cite synthetic or local placeholder evidence');
    assert.doesNotMatch(cells[3], /[<>]|\[insira|\{[^}]+\}/i, 'PASS cannot contain template tokens');
    // Canonicalize dot segments so aliases cannot reuse the same physical capture.
    const evidenceKey = path.posix.normalize(cells[3].replace(/\\/g, '/')).toLowerCase();
    assert.ok(!evidenceRefs.has(evidenceKey), 'PASS evidence reference must be unique per case (case and separator insensitive)');
    evidenceRefs.add(evidenceKey);
  }
}
console.log('QA A matrix structure valid (16 cases); this is NOT physical QA approval.');
