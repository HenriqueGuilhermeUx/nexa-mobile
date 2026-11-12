#!/usr/bin/env node
// QA A evidence gate: offline only; never contacts EAS, GitHub or production.
// Usage: node scripts/qa/maya-actions-wave-a-evidence-gate.js path/to/private-redacted-evidence.json
// Expected JSON: { candidateSha, runtime, packageId, cases: [{ id, status, evidenceRef }] }
// Do not commit evidence containing credentials, customer identifiers or financial data.
const fs = require('node:fs');
const ids = Array.from({ length: 16 }, (_, i) => 'A' + String(i + 1).padStart(2, '0'));
const file = process.argv[2];
// Date.parse normalizes impossible calendar dates in some runtimes (e.g. February 30).
function validClockAndOffset(timestamp) {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(timestamp);
  if (!match) return false;
  const hour = Number(match[1]), minute = Number(match[2]), second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[4] !== 'Z') {
    const offsetHour = Number(match[6]), offsetMinute = Number(match[7]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return true;
}
function validCalendarDate(timestamp) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(timestamp);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}
if (!file) {
  console.error('BLOCKED: provide a local, redacted evidence JSON path. No device approval inferred.');
  process.exit(2);
}
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch { console.error('BLOCKED: evidence file missing or invalid JSON'); process.exit(2); }
if (data === null || typeof data !== 'object' || Array.isArray(data)) {
  console.error('NO-GO: evidence manifest must be a JSON object');
  process.exit(1);
}
const failures = [];
if (data.candidateSha !== '096c9fd619a551f23ba8c7d9e3e72a7e01605a6e') failures.push('candidate SHA mismatch');
if (data.runtime !== '2.0.43') failures.push('runtime mismatch');
// EAS OTA QA A is delivered to the official app identity on a QA-enabled binary.
// A standalone may be useful for feature QA, but cannot prove receipt of this EAS update.
if (data.packageId !== 'br.com.trynexa.app') failures.push('EAS QA app package mismatch (standalone APK is not OTA evidence)');
// Bind the manifest to the frozen QA A EAS update; an arbitrary QA or production OTA is not evidence for this candidate.
if (data.easBranch !== 'maya-actions-v148-qa') failures.push('QA EAS branch mismatch');
if (data.androidUpdateId !== '01a1a975-d85f-794f-9d67-cf2ac961fbb7') failures.push('QA Android update mismatch');
if (!Array.isArray(data.cases)) failures.push('cases must be an array');
const cases = Array.isArray(data.cases) ? data.cases : [];
for (const id of ids) {
  const matches = cases.filter(c => c && c.id === id);
  if (matches.length !== 1) { failures.push(id + ': missing or duplicate'); continue; }
  const c = matches[0];
  if (c.status !== 'PASS') failures.push(id + ': not PASS');
  if (typeof c.evidenceRef !== 'string' || !c.evidenceRef.trim()) failures.push(id + ': evidence reference missing');
  // Reject control characters that can corrupt audit logs or conceal a reused reference.
  if (typeof c.evidenceRef === 'string' && /[\x00-\x1f\x7f]/.test(c.evidenceRef)) failures.push(id + ': evidence reference contains control characters');
  if (typeof c.evidenceRef === 'string' && c.evidenceRef.length > 512) failures.push(id + ': evidence reference too long');
  if (typeof c.testedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(c.testedAt) ||
      !Number.isFinite(Date.parse(c.testedAt)) ||
      !validCalendarDate(c.testedAt) ||
      !validClockAndOffset(c.testedAt) ||
      new Date(Date.parse(c.testedAt)).toISOString().slice(0, 10) < '2026-11-04' ||
      Date.parse(c.testedAt) > Date.now()) failures.push(id + ': invalid or future timestamp');
  if (typeof c.device !== 'string' || !c.device.trim()) failures.push(id + ': device missing');
  // Keep device metadata printable and bounded; it is copied into private audit reports.
  if (typeof c.device === 'string' && (/[\x00-\x1f\x7f]/.test(c.device) || c.device.length > 160)) failures.push(id + ': invalid device metadata');
}
// Each physical test must point to its own evidence; a copied reference is not 16 proofs.
const refs = cases.filter(c => c && typeof c.evidenceRef === 'string' && c.evidenceRef.trim())
  .map(c => c.evidenceRef.trim());
if (new Set(refs).size !== refs.length) failures.push('duplicate evidence reference');
if (cases.some(c => !ids.includes(c?.id))) failures.push('unknown case ID');
if (failures.length) {
  console.error('NO-GO: ' + failures.join('; '));
  process.exit(1);
}
console.log('Evidence manifest structurally complete (16/16). NOT a device verification, CI approval, or production authorization.');
