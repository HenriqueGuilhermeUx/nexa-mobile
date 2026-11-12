#!/usr/bin/env node
// QA A evidence gate: offline only; never contacts EAS, GitHub or production.
// Usage: node scripts/qa/maya-actions-wave-a-evidence-gate.js path/to/private-redacted-evidence.json
// Expected JSON: { candidateSha, runtime, packageId, cases: [{ id, status, evidenceRef }] }
// Do not commit evidence containing credentials, customer identifiers or financial data.
const fs = require('node:fs');
const ids = Array.from({ length: 16 }, (_, i) => 'A' + String(i + 1).padStart(2, '0'));
const file = process.argv[2];
if (!file) {
  console.error('BLOCKED: provide a local, redacted evidence JSON path. No device approval inferred.');
  process.exit(2);
}
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch { console.error('BLOCKED: evidence file missing or invalid JSON'); process.exit(2); }
const failures = [];
if (data.candidateSha !== '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e') failures.push('candidate SHA mismatch');
if (data.runtime !== '2.0.43') failures.push('runtime mismatch');
if (data.packageId !== 'br.com.trynexa.mayaqa') failures.push('QA package mismatch');
if (!Array.isArray(data.cases)) failures.push('cases must be an array');
const cases = Array.isArray(data.cases) ? data.cases : [];
for (const id of ids) {
  const matches = cases.filter(c => c && c.id === id);
  if (matches.length !== 1) { failures.push(id + ': missing or duplicate'); continue; }
  const c = matches[0];
  if (c.status !== 'PASS') failures.push(id + ': not PASS');
  if (typeof c.evidenceRef !== 'string' || !c.evidenceRef.trim()) failures.push(id + ': evidence reference missing');
  if (typeof c.testedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(c.testedAt) ||
      !Number.isFinite(Date.parse(c.testedAt)) ||
      new Date(Date.parse(c.testedAt)).toISOString().slice(0, 10) < '2026-11-04' ||
      Date.parse(c.testedAt) > Date.now()) failures.push(id + ': invalid or future timestamp');
  if (typeof c.device !== 'string' || !c.device.trim()) failures.push(id + ': device missing');
}
if (cases.some(c => !ids.includes(c?.id))) failures.push('unknown case ID');
if (failures.length) {
  console.error('NO-GO: ' + failures.join('; '));
  process.exit(1);
}
console.log('Evidence manifest structurally complete (16/16). NOT a device verification, CI approval, or production authorization.');
