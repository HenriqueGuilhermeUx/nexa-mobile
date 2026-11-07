const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const script = path.join(__dirname,'maya-qa-a-adb-package-gate.cjs');
function run(mode,input) { return spawnSync(process.execPath,[script,mode],{input,encoding:'utf8'}); }
test('OTA identity accepted with standalone installed too',()=>assert.equal(run('ota','package:br.com.trynexa.app\npackage:br.com.trynexa.mayaqa\n').status,0));
test('standalone cannot impersonate OTA',()=>assert.notEqual(run('ota','package:br.com.trynexa.mayaqa\n').status,0));
test('duplicate package rejected',()=>assert.notEqual(run('ota','package:br.com.trynexa.app\npackage:br.com.trynexa.app\n').status,0));
test('prefix and malformed lines rejected',()=>{assert.notEqual(run('ota','package:br.com.trynexa.app.fake\n').status,0);assert.notEqual(run('ota','garbage\npackage:br.com.trynexa.app\n').status,0)});

test('standalone identity accepted with production app installed',()=>assert.equal(run('standalone','package:br.com.trynexa.app\r\npackage:br.com.trynexa.mayaqa\r\n').status,0));
test('OTA cannot impersonate standalone',()=>assert.notEqual(run('standalone','package:br.com.trynexa.app\n').status,0));
test('empty and oversized inventories fail closed',()=>{assert.notEqual(run('ota','').status,0);assert.notEqual(run('ota','package:br.com.trynexa.app\n'+'x'.repeat(1024*1024)).status,0)});
test('invalid mode fails closed',()=>assert.notEqual(run('production','package:br.com.trynexa.app\n').status,0));

test('ADB inventory rejects ANSI escapes and Unicode lookalike package names',()=>{
  assert.notEqual(run('ota','\u001b[32mpackage:br.com.trynexa.app\u001b[0m\n').status,0);
  assert.notEqual(run('ota','package:br.com.trynexa.аpp\n').status,0); // Cyrillic a
});
test('ADB inventory rejects additional non-package output even when expected package is present',()=>{
  assert.notEqual(run('ota','List of devices attached\npackage:br.com.trynexa.app\n').status,0);
  assert.notEqual(run('ota','package:br.com.trynexa.app\nerror: device offline\n').status,0);
});

test('blank ADB inventory records are rejected even if expected package is present',()=>{
  assert.notEqual(run('ota','\npackage:br.com.trynexa.app\n').status,0);
  assert.notEqual(run('ota','package:br.com.trynexa.app\n\n').status,0);
  assert.notEqual(run('ota','package:br.com.trynexa.app\n\npackage:br.com.trynexa.mayaqa\n').status,0);
});

test('noncanonical trailing spaces or tabs cannot pass as ADB package records',()=>{
  assert.notEqual(run('ota','package:br.com.trynexa.app \n').status,0);
  assert.notEqual(run('ota','package:br.com.trynexa.app\t\n').status,0);
  assert.equal(run('ota','package:br.com.trynexa.app\n').status,0);
});

test('UTF-8 byte limit rejects multibyte inventories below character-count threshold',()=>{
  const inventory='package:br.com.trynexa.app\n'+'é'.repeat(530000);
  assert.ok(inventory.length < 1024*1024);
  assert.ok(Buffer.byteLength(inventory,'utf8') > 1024*1024);
  const result=run('ota',inventory);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/oversized/i);
});
