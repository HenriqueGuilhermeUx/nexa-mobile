const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, verifyEvidenceFiles } = require('./validate-maya-qa-a-evidence');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ids = ['A01','A02','A03','A04','A05','A06','P01','P02','P03','P04','P05','R01','R02','R03','R04','R05'];
const valid = () => ({
 applicationId:'br.com.trynexa.app', runtime:'2.0.43', versionCode:148,
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
      fs.writeFileSync(target,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
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

test('equivalent relative paths cannot reuse one evidence artifact',()=>{
  const e=valid(); e.cases[1].evidenceRef='qa-a/device-01/./A01.png';
  assert.match(validate(e).join(' '),/duplicate evidence reference/);
});
test('case-only path aliases cannot reuse one evidence artifact',()=>{
  const e=valid(); e.cases[1].evidenceRef='QA-A/DEVICE-01/a01.PNG';
  assert.match(validate(e).join(' '),/duplicate evidence reference/);
});

test('Windows-style separator alias cannot reuse an evidence artifact',()=>{
  const e=valid(); e.cases[1].evidenceRef=['qa-a','device-01','A01.png'].join(String.fromCharCode(92));
  assert.match(validate(e).join(' '),/duplicate evidence reference/);
});

test('Windows-style evidence paths are rejected by metadata and disk gates',()=>{
  const e=valid(); e.cases[0].evidenceRef=['qa-a','device-01','A01.png'].join(String.fromCharCode(92));
  assert.match(validate(e).join(' '),/unsafe evidence reference/);
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unsafe evidence reference/);
});

test('artifact gate rejects hard-linked duplicate captures',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid(); e.cases=e.cases.slice(0,2);
    const first=path.join(root,e.cases[0].evidenceRef);
    const second=path.join(root,e.cases[1].evidenceRef);
    fs.mkdirSync(path.dirname(first),{recursive:true});
    fs.writeFileSync(first,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
    fs.linkSync(first,second);
    assert.match(verifyEvidenceFiles(e,root).join(' '),/duplicate physical evidence artifact/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects evidence under a symlinked parent directory',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid(); e.cases=[e.cases[0]];
    const actual=path.join(root,'actual');
    fs.mkdirSync(actual);
    fs.writeFileSync(path.join(actual,'A01.png'),'capture');
    fs.mkdirSync(path.join(root,'qa-a'));
    fs.symlinkSync(actual,path.join(root,'qa-a','device-01'),'dir');
    assert.match(verifyEvidenceFiles(e,root).join(' '),/artifact path contains symlink/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('standalone artifact gate rejects repeated paths even without metadata validation',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid();
    e.cases=[e.cases[0],{...e.cases[1],evidenceRef:e.cases[0].evidenceRef}];
    const target=path.join(root,e.cases[0].evidenceRef);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
    assert.match(verifyEvidenceFiles(e,root).join(' '),/duplicate evidence reference/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('standalone artifact gate fails closed on malformed case records',()=>{
  const e=valid(); e.cases=[null,{},'invalid',...e.cases.slice(0,1)];
  assert.equal(verifyEvidenceFiles(e,os.tmpdir()).filter(x=>x.includes('invalid case object')).length,3);
});

test('standalone artifact gate rejects duplicate case IDs even with different files',()=>{
  const e=valid(); e.cases=[e.cases[0],{...e.cases[1],id:e.cases[0].id}];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unknown or duplicate case/);
});
test('standalone artifact gate rejects unknown case IDs',()=>{
  const e=valid(); e.cases=[{...e.cases[0],id:'UNKNOWN'}];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unknown or duplicate case/);
});


test('standalone artifact gate rejects empty QA matrix',()=>{
  const e=valid(); e.cases=[];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/missing case\(s\) for artifact verification/);
});
test('standalone artifact gate rejects partial QA matrix',()=>{
  const e=valid(); e.cases=[e.cases[0]];
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/missing case\(s\) for artifact verification/);
});

test('impossible February day is rejected even if Date.parse normalizes it',()=>{
  const e=valid(); e.testedAt='2026-02-30T10:00:00-03:00';
  assert.match(validate(e).join(' '),/impossible calendar date/);
});
test('valid leap day passes calendar validation',()=>{
  const e=valid(); e.testedAt='2024-02-29T10:00:00-03:00';
  assert.deepEqual(validate(e),[]);
});

test('century year 1900 is not a leap year',()=>{
  const e=valid(); e.testedAt='1900-02-29T10:00:00Z';
  assert.match(validate(e).join(' '),/impossible calendar date/);
});
test('century year 2000 is a leap year',()=>{
  const e=valid(); e.testedAt='2000-02-29T10:00:00Z';
  assert.deepEqual(validate(e),[]);
});

test('literal ISO year 0096 is a leap year, not year 1996',()=>{
  const e=valid(); e.testedAt='0096-02-29T10:00:00Z';
  assert.deepEqual(validate(e),[]);
});
test('literal ISO year 0099 rejects February 29',()=>{
  const e=valid(); e.testedAt='0099-02-29T10:00:00Z';
  assert.match(validate(e).join(' '),/impossible calendar date/);
});

test('non-leap February 29 is rejected',()=>{
  const e=valid(); e.testedAt='2025-02-29T10:00:00-03:00';
  assert.match(validate(e).join(' '),/impossible calendar date/);
});
test('April 31 is rejected even when timestamp parser normalizes the day',()=>{
  const e=valid(); e.testedAt='2026-04-31T10:00:00-03:00';
  assert.match(validate(e).join(' '),/impossible calendar date/);
});

// A colon inside a relative path can select a Windows NTFS alternate data stream.
test('metadata gate rejects NTFS alternate data stream evidence path',()=>{
  const e=valid(); e.cases[0].evidenceRef='qa-a/device-01/A01.png:payload.png';
  assert.match(validate(e).join(' '),/unsafe evidence reference/);
});
test('standalone artifact gate rejects NTFS alternate data stream evidence path',()=>{
  const e=valid(); e.cases[0].evidenceRef='qa-a/device-01/A01.png:payload.png';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/unsafe evidence reference/);
});

test('standalone artifact gate rejects FAIL case even with existing artifact',()=>{
  const e=valid(); e.cases[0].status='FAIL';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/case not approved for artifact verification/);
});
test('standalone artifact gate rejects missing observation',()=>{
  const e=valid(); e.cases[0].observed='  ';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/case not approved for artifact verification/);
});

test('standalone artifact gate rejects placeholder observation without metadata gate',()=>{
  const e=valid(); e.cases[0].observed='TODO verify on device';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/synthetic\/placeholder evidence/);
});
test('standalone artifact gate rejects placeholder artifact reference without metadata gate',()=>{
  const e=valid(); e.cases[0].evidenceRef='qa-a/fixture/A01.png';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/synthetic\/placeholder evidence/);
});

test('standalone artifact gate rejects missing CI even when cases exist',()=>{
  const e=valid(); e.ci='pending';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/CI\/approval missing for artifact verification/);
});
test('standalone artifact gate rejects missing explicit human approval',()=>{
  const e=valid(); e.explicitApproval=false;
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/CI\/approval missing for artifact verification/);
});


test('standalone artifact gate rejects wrong runtime even with approval',()=>{
  const e=valid(); e.runtime='2.0.44';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/QA A release identity mismatch/);
});
test('standalone artifact gate rejects wrong OTA update ID',()=>{
  const e=valid(); e.updateId='another-update';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/QA A release identity mismatch/);
});
test('standalone artifact gate rejects wrong release SHA or versionCode',()=>{
  const e=valid(); e.releaseSha='unapproved'; e.versionCode=149;
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/QA A release identity mismatch/);
});


test('standalone artifact gate rejects synthetic device metadata',()=>{
  const e=valid(); e.deviceModel='Android emulator fixture';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/device metadata missing or synthetic/);
});
test('standalone artifact gate rejects future QA session timestamp',()=>{
  const e=valid(); e.testedAt='2099-01-01T00:00:00Z';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/invalid QA session timestamp/);
});

test('standalone artifact gate rejects impossible February 30 without metadata validation',()=>{
  const e=valid(); e.testedAt='2026-02-30T10:00:00-03:00';
  assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/impossible QA session calendar date/);
});
test('standalone artifact gate accepts valid leap-day calendar metadata',()=>{
  const e=valid(); e.testedAt='2024-02-29T10:00:00-03:00';
  assert.doesNotMatch(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/impossible QA session calendar date/);
});

// A renamed text file must never count as a physical QA screenshot.
test('artifact gate rejects text disguised as PNG',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid();
    for (const item of e.cases) {
      const target=path.join(root,item.evidenceRef);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
    }
    fs.writeFileSync(path.join(root,e.cases[0].evidenceRef),'not a screenshot');
    assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('artifact gate rejects a PDF header renamed as PNG',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
  try {
    const e=valid();
    for (const item of e.cases) {
      const target=path.join(root,item.evidenceRef);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
    }
    fs.writeFileSync(path.join(root,e.cases[0].evidenceRef),'%PDF-1.7');
    assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});


test('artifact gate rejects a PNG signature without complete chunks',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try { const e=valid(); for (const c of e.cases) { const target=path.join(root,c.evidenceRef); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64')); }
 fs.writeFileSync(path.join(root,e.cases[0].evidenceRef),Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
 assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects PNG with an empty IDAT chunk',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  const good=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
  for(const c of e.cases) {
   const target=path.join(root,c.evidenceRef);
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.writeFileSync(target,good);
  }
  // The parser must reject a structurally present IDAT that contains no image bytes.
  const ihdr=good.subarray(0,33);
  const emptyIdat=Buffer.concat([Buffer.alloc(4),Buffer.from('IDAT'),Buffer.alloc(4)]);
  const iend=Buffer.concat([Buffer.alloc(4),Buffer.from('IEND'),Buffer.alloc(4)]);
  fs.writeFileSync(path.join(root,e.cases[0].evidenceRef),Buffer.concat([ihdr,emptyIdat,iend]));
  assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects JPEG with SOI prefix but no EOI trailer',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  e.cases[0].evidenceRef='qa-a/device-01/A01.jpg';
  const target=path.join(root,e.cases[0].evidenceRef);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10]));
  assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('artifact gate accepts JPEG signature with terminal EOI as format sanity check only',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  e.cases[0].evidenceRef='qa-a/device-01/A01.jpg';
  const target=path.join(root,e.cases[0].evidenceRef);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,Buffer.from([0xff,0xd8,0xff,0xe0,0xff,0xd9]));
  assert.doesNotMatch(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension: A01/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects PNG dimensions beyond evidence sanity limit',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  const good=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
  const target=path.join(root,e.cases[0].evidenceRef);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const oversized=Buffer.from(good);
  oversized.writeUInt32BE(16385,16);
  fs.writeFileSync(target,oversized);
  assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension: A01/);
  const zeroHeight=Buffer.from(good);
  zeroHeight.writeUInt32BE(0,20);
  fs.writeFileSync(target,zeroHeight);
  assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension: A01/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects invalid PNG IHDR encoding fields',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  const good=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
  const target=path.join(root,e.cases[0].evidenceRef);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  for(const [offset,value] of [[24,7],[25,5],[26,1],[27,1],[28,2]]) {
   const bad=Buffer.from(good);
   bad[offset]=value;
   fs.writeFileSync(target,bad);
   assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension: A01/);
  }
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('artifact gate rejects altered PNG dimensions when IHDR CRC is stale',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  const good=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
  const target=path.join(root,e.cases[0].evidenceRef);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const altered=Buffer.from(good);
  altered.writeUInt32BE(2,16); // Valid dimensions, but no matching IHDR CRC.
  fs.writeFileSync(target,altered);
  assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension: A01/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});


test('artifact gate rejects PNG with a corrupted IEND CRC',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maya-qa-'));
 try {
  const e=valid();
  const good=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
  const target=path.join(root,e.cases[0].evidenceRef);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const altered=Buffer.from(good);
  altered[altered.length-1]^=1;
  fs.writeFileSync(target,altered);
  assert.match(verifyEvidenceFiles(e,root).join(' '),/content does not match media extension: A01/);
 } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('OTA metadata gate rejects standalone APK identity',()=>{
 const e=valid(); e.applicationId='br.com.trynexa.mayaqa';
 assert.match(validate(e).join(' '),/applicationId mismatch/);
});
test('artifact gate independently rejects standalone APK identity',()=>{
 const e=valid(); e.applicationId='br.com.trynexa.mayaqa';
 assert.match(verifyEvidenceFiles(e,os.tmpdir()).join(' '),/QA A release identity mismatch/);
});
