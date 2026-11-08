// Regression checks for the QA A matrix gate. Uses temporary fixtures only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const validator = fs.readFileSync(path.join(__dirname, 'check-maya-qa-a-matrix.cjs'), 'utf8');
const original = fs.readFileSync(path.join(root, 'docs/maya-actions-qa-a-physical-capture-matrix.md'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-a-matrix-'));
try {
  fs.mkdirSync(path.join(temp, 'scripts'));
  fs.mkdirSync(path.join(temp, 'docs'));
  fs.writeFileSync(path.join(temp, 'scripts/check-maya-qa-a-matrix.cjs'), validator);
  const run = (markdown) => {
    fs.writeFileSync(path.join(temp, 'docs/maya-actions-qa-a-physical-capture-matrix.md'), markdown);
    return spawnSync(process.execPath, [path.join(temp, 'scripts/check-maya-qa-a-matrix.cjs')], { encoding: 'utf8' });
  };
  const row = '| A01 | Abrir Maya e iniciar criação de lembrete | PENDENTE | — |';
  assert.equal(run(original).status, 0, 'Canonical pending matrix must pass');
  assert.notEqual(run(original.replace(row, '')).status, 0, 'Missing case must fail');
  assert.notEqual(run(original.replace(row, row + '\n' + row)).status, 0, 'Duplicate case must fail');
  const pass = '| A01 | Abrir Maya e iniciar criação de lembrete | PASS | evidence-A01.mp4 |';
  assert.equal(run(original.replace(row, pass)).status, 0, 'PASS with reference must pass structural gate only');
  assert.notEqual(run(original.replace(row, row.replace('PENDENTE | —', 'PASS | TODO'))).status, 0, 'Placeholder must fail');
  assert.notEqual(run(original.replace(row, row.replace('PENDENTE | —', 'PASS | {INSERIR_EVIDENCIA}'))).status, 0, 'Brace-delimited template reference must fail');
  const row2 = '| A02 | Informar título e data futura válida; revisar antes de salvar | PENDENTE | — |';
  assert.notEqual(run(original.replace(row, pass).replace(row2, row2.replace('PENDENTE | —', 'PASS | evidence-A01.mp4'))).status, 0, 'Duplicate evidence must fail');
  assert.notEqual(run(original.replace(row, pass).replace(row2, row2.replace('PENDENTE | —', 'PASS | EVIDENCE-a01.MP4'))).status, 0, 'Case-only evidence alias must fail');
  assert.notEqual(run(original.replace(row, row.replace('PENDENTE | —', 'PASS | qa/evidence-A01.mp4')).replace(row2, row2.replace('PENDENTE | —', 'PASS | qa\\\\evidence-A01.mp4'))).status, 0, 'Slash/backslash evidence alias must fail');
  console.log('QA A matrix gate regression fixtures passed; physical QA is NOT approved.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
