#!/usr/bin/env node
// Offline, read-only QA A package identity gate. Input must be captured from a physical device.
// Usage: node scripts/maya-qa-a-adb-package-gate.cjs ota|standalone < packages.txt
const fs = require('node:fs');
const mode = process.argv[2];
const expected = {ota:'br.com.trynexa.app',standalone:'br.com.trynexa.mayaqa'};
if (!Object.hasOwn(expected,mode)) { console.error('Usage: node scripts/maya-qa-a-adb-package-gate.cjs ota|standalone < packages.txt'); process.exit(2); }
const data = fs.readFileSync(0,'utf8');
if (!data || data.length > 1024*1024) { console.error('Missing or oversized ADB inventory'); process.exit(1); }
const lines = data.trim().split(/\r?\n/);
const names = [];
for (const line of lines) {
  const match = /^package:([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*$/.exec(line);
  if (!match) { console.error('Malformed ADB package inventory'); process.exit(1); }
  names.push(match[1]);
}
if (new Set(names).size !== names.length) { console.error('Duplicate package entry'); process.exit(1); }
if (!names.includes(expected[mode])) { console.error('Expected QA package not found: '+expected[mode]); process.exit(1); }
console.log('PASS: installed package identity present ('+expected[mode]+'); this does NOT verify runtime, update ID, CI or device test completion');
