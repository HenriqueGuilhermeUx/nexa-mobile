#!/usr/bin/env node
// Offline check only: compare an adb package inventory with the expected QA artifact.
const fs = require('node:fs');
const expected = Object.freeze({ota:'br.com.trynexa.app',standalone:'br.com.trynexa.mayaqa'});
function checkPackageInventory(text, mode) {
  if (!Object.hasOwn(expected,mode)) return ['unknown QA artifact mode'];
  if (typeof text !== 'string' || !text || Buffer.byteLength(text, 'utf8') > 1024 * 1024) return ['empty or oversized adb package inventory'];
  const lines = text.replace(/\r?\n$/, '').split(/\r?\n/);
  const packages = lines.map(line=>/^package:([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)$/.exec(line));
  if (!packages.length || packages.some(match=>!match)) return ['invalid adb package inventory'];
  const ids = packages.map(match=>match[1]);
  if (new Set(ids).size !== ids.length) return ['duplicate entries in adb package inventory'];
  if (!ids.includes(expected[mode])) return ['expected QA package not installed: '+expected[mode]];
  return [];
}
if (require.main === module) {
  const [mode, file] = process.argv.slice(2);
  if (!Object.hasOwn(expected, mode) || typeof file !== 'string' || !file.trim()) {
    console.error('NO-GO: usage: node check-maya-qa-installed-package.js <ota|standalone> <adb-inventory-file>');
    process.exit(2);
  }
  let content;
  try { content = fs.readFileSync(file,'utf8'); }
  catch { console.error('NO-GO: package inventory missing/unreadable'); process.exit(2); }
  const errors=checkPackageInventory(content,mode);
  if (errors.length) { console.error('NO-GO: '+errors.join('; ')); process.exit(1); }
  console.log('Package present in supplied adb inventory; does NOT prove active OTA/update ID, device identity or QA approval.');
}
module.exports={checkPackageInventory};
