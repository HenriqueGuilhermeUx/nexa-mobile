const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('./validate-maya-qa-a-evidence');
const ids = ['A01','A02','A03','A04','A05','A06','P01','P02','P03','P04','P05','R01','R02','R03','R04','R05'];
const valid = () => ({
 runtime:'2.0.43', versionCode:148,
 releaseSha:'096c9fd619a551f23ba8c7d9e3e72a7e01605a6e',
 updateId:'01a1a975-d85f-794f-9d67-cf2ac961fbb7',
 deviceModel:'QA test fixture', androidVersion:'14', testedAt:'2026-11-05T10:00:00-03:00',
 ci:'success', explicitApproval:true,
 cases:ids.map(id=>({id,status:'PASS',observed:'fixture only',evidenceRef:'fixture'}))
});
test('complete synthetic fixture passes structural validation only',()=>assert.deepEqual(validate(valid()),[]));
test('missing device evidence is blocked',()=>{const e=valid();e.cases[0].evidenceRef='';assert.ok(validate(e).length);});
test('missing or duplicate case is blocked',()=>{const e=valid();e.cases[1]=e.cases[0];assert.ok(validate(e).length);});
test('wrong runtime or update is blocked',()=>{const e=valid();e.runtime='2.0.44';e.updateId='wrong';assert.ok(validate(e).length);});
test('without explicit approval is blocked',()=>{const e=valid();e.explicitApproval=false;assert.ok(validate(e).length);});
