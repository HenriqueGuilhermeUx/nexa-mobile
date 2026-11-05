const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, verifyEvidenceFiles } = require('./validate-maya-qa-a-evidence');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ids = ['A01','A02','A03','A04','A05','A06','P01','P02','P03','P04','P05','R01','R02','R03','R04','R05'];
const valid = () => ({
 runtime:'2.0.43', versionCode:148,
 releaseSha:'096c9fd619a551f23ba8c7d9e3e72a7e01605a6e',
 updateId:'01a1a975-d85f-794f-9d67-cf2ac961fbb7',
 deviceModel:'Pixel 7', androidVersion:'14', testedAt:'2026-11-04T10:00:00-03:00',
 ci:'success', explicitApproval:true,
 cases:ids.map(id=>({id,status:'PASS',observed:'Notificação apareceu no horário configurado',evidenceRef:`qa-a/device-01/${id}.png`}))
});
test('complete synthetic fixture passes structural validation only',()=>assert.deepEqual(validate(valid()),[]));
test('missing device evidence is blocked',()=>{const e=valid();e.cases[0].evidenceRef='';assert.ok(validate(e).length);});
test('missing or duplicate case is blocked',()=>{const e=valid();e.cases[1]=e.cases[0];assert.ok(validate(e).length);});
test('wrong runtime or update is blocked',()=>{const e=valid();e.runtime='2.0.44';e.updateId='wrong';assert.ok(validate(e).length);});
test('without explicit approval is blocked',()=>{const e=valid();e.explicitApproval=false;assert.ok(validate(e).length);});

test('placeholder observations cannot approve QA A',()=>{const e=valid();e.cases[0].observed='fixture only';assert.match(validate(e).join(' '),/synthetic\/placeholder/);});
test('placeholder evidence reference cannot approve QA A',()=>{const e=valid();e.cases[0].evidenceRef='TODO';assert.match(validate(e).join(' '),/synthetic\/placeholder/);});
test('timezone-less timestamp is rejected',()=>{const e=valid();e.testedAt='2026-11-05T10:00:00';assert.match(validate(e).join(' '),/timezone/);});
test('invalid top-level payload is rejected without crashing',()=>assert.ok(validate(null).length));

test('valid ISO timestamp with timezone is accepted',()=>{const e=valid();assert.deepEqual(validate(e),[]);});
test('malformed case object is rejected without crashing',()=>{const e=valid();e.cases[0]=null;assert.match(validate(e).join(' '),/invalid case object/);});
test('impossible calendar date is rejected',()=>{const e=valid();e.testedAt='2026-13-40T10:00:00-03:00';assert.match(validate(e).join(' '),/timezone/);});

test('same evidence reference across cases is blocked',()=>{const e=valid();e.cases[1].evidenceRef=e.cases[0].evidenceRef;assert.match(validate(e).join(' '),/duplicate evidence reference/);});
test('synthetic device metadata is blocked',()=>{const e=valid();e.deviceModel='Android emulator fixture';assert.match(validate(e).join(' '),/device metadata appears synthetic/);});

test('remote URL is not an acceptable evidence artifact',()=>{const e=valid();e.cases[0].evidenceRef='https://example.com/proof.png';assert.match(validate(e).join(' '),/unsafe evidence reference/);});
test('path traversal is rejected',()=>{const e=valid();e.cases[0].evidenceRef='../private/proof.png';assert.match(validate(e).join(' '),/unsafe evidence reference/);});
test('unsupported artifact extension is rejected',()=>{const e=valid();e.cases[0].evidenceRef='qa-a/device-01/result.txt';assert.match(validate(e).join(' '),/unsafe evidence reference/);});

test('embedded TODO in an observation blocks QA approval',()=>{const e=valid();e.cases[0].observed='Notificação OK; TODO confirmar no aparelho';assert.match(validate(e).join(' '),/synthetic\/placeholder/);});
test('embedded fixture marker in evidence path blocks QA approval',()=>{const e=valid();e.cases[0].evidenceRef='qa-a/fixture-capture/A01.png';assert.match(validate(e).join(' '),/synthetic\/placeholder/);});

test('future-dated QA capture is rejected',()=>{const e=valid();e.testedAt='2099-01-01T00:00:00Z';assert.match(validate(e).join(' '),/future/);});

test('artifact gate rejects missing files even when metadata passes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try { assert.match(verifyEvidenceFiles(valid(),root).join(' '),/artifact missing\/unreadable/); }
  finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('artifact gate accepts existing nonempty regular files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid();
    for (const c of e.cases) {
      const target=path.join(root,c.evidenceRef);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,Buffer.from('test artifact'));
    }
    assert.deepEqual(verifyEvidenceFiles(e,root),[]);
    fs.writeFileSync(path.join(root,e.cases[0].evidenceRef),'');
    assert.match(verifyEvidenceFiles(e,root).join(' '),/nonempty regular file/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('artifact gate rejects symlinks',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid();e.cases=[e.cases[0]];
    const target=path.join(root,e.cases[0].evidenceRef);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.symlinkSync(__filename,target);
    assert.match(verifyEvidenceFiles(e,root).join(' '),/nonempty regular file/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects traversal directly, without metadata validation',()=>{
  const e=valid(); e.cases=[{...e.cases[0],evidenceRef:'../outside.png'}];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unsafe evidence reference/);
});
test('artifact gate rejects remote references directly',()=>{
  const e=valid(); e.cases=[{...e.cases[0],evidenceRef:'https://example.org/proof.png'}];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unsafe evidence reference/);
});
test('artifact gate rejects unsupported file types directly',()=>{
  const e=valid(); e.cases=[{...e.cases[0],evidenceRef:'qa-a/result.exe'}];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unsafe evidence reference/);
});
