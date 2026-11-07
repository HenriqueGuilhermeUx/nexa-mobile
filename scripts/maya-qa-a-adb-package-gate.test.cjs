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
