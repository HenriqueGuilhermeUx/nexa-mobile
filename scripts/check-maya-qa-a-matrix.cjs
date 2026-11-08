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
const rows = markdown.split(/\r?\n/).filter(line => /^\|\s*[APR]0[1-9]\s*\|/.test(line));
const ids = rows.map(line => line.split('|')[1].trim());
assert.deepEqual([...ids].sort(), [...expected].sort(), 'QA A must contain exactly 16 unique canonical case IDs');
for (const row of rows) {
  const cells = row.split('|').slice(1, -1).map(x => x.trim());
  assert.equal(cells.length, 4, 'Each case must have four columns');
  assert.ok(cells[1], 'Every case needs an observable step');
  assert.match(cells[2], /^(PENDENTE|PASS|FAIL|BLOQUEADO)$/, 'Unrecognized QA state');
  if (cells[2] === 'PASS') {
    assert.notEqual(cells[3], '—', 'PASS requires a recorded evidence reference');
    assert.ok(cells[3].length >= 8, 'PASS evidence reference is too short');
  }
}
console.log('QA A matrix structure valid (16 cases); this is NOT physical QA approval.');
