#!/usr/bin/env node
// Offline CLI fail-closed smoke tests. Synthetic inputs only; no network or device access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const gate = path.join(__dirname, 'maya-actions-wave-a-evidence-gate.js');
function invoke(args) {
  return spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', timeout: 10000 });
}
test('missing evidence argument blocks without claiming device approval', () => {
  const result = invoke([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /BLOCKED/);
  assert.doesNotMatch(result.stdout, /structurally complete/);
});
test('missing evidence file blocks', () => {
  const result = invoke([path.join(os.tmpdir(), 'maya-qa-a-nonexistent-evidence-' + process.pid + '.json')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /BLOCKED/);
});
test('malformed JSON blocks, without success output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-a-cli-'));
  const file = path.join(dir, 'invalid.json');
  try {
    fs.writeFileSync(file, '{"cases": [', { mode: 0o600 });
    const result = invoke([file]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /BLOCKED/);
    assert.doesNotMatch(result.stdout, /structurally complete/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON null blocks as an invalid manifest without a crash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-a-null-'));
  const file = path.join(dir, 'null.json');
  try {
    fs.writeFileSync(file, 'null', { mode: 0o600 });
    const result = invoke([file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NO-GO: evidence manifest must be a JSON object/);
    assert.doesNotMatch(result.stdout, /structurally complete/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON array blocks as an invalid manifest without a success signal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-qa-a-array-'));
  const file = path.join(dir, 'array.json');
  try {
    fs.writeFileSync(file, '[]', { mode: 0o600 });
    const result = invoke([file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /NO-GO: evidence manifest must be a JSON object/);
    assert.doesNotMatch(result.stdout, /structurally complete/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
