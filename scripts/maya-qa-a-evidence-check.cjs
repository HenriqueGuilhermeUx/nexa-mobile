#!/usr/bin/env node
// QA A evidence preflight only. Never publishes OTA or approves production.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const IDS = Array.from({length:16},(_,i)=>'A'+String(i+1).padStart(2,'0'));
const SHA=/^[a-f0-9]{40}$/i;
const EAS_UPDATE_ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const QA_A_OTA_SHA='096c9fd619a551f23ba8c7d9e3e72a7e01605a6e';
const QA_A_OTA_ID='01a1a975-d85f-794f-9d67-cf2ac961fbb7';
const OFFSET=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
function validObservedAt(value) {
  if(typeof value!=='string'||!OFFSET.test(value)) return false;
  const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(Z|[+-]\d\d:\d\d)$/.exec(value);
  if(!m) return false;
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
  if(year<100||month<1||month>12||hour>23||minute>59||second>59) return false;
  const calendar=new Date(Date.UTC(year,month-1,day));
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day) return false;
  const zone=m[7];
  if(zone!=='Z') {
    const zh=Number(zone.slice(1,3)), zm=Number(zone.slice(4,6));
    if(zh>14||zm>59||(zh===14&&zm!==0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}
function parseEvidence(text) {
  try { return {record: JSON.parse(text), errors: []}; }
  catch { return {record: null, errors: ['invalid evidence JSON']}; }
}
function check(record) {
  const errors=[];
  if (!record || typeof record!=='object' || Array.isArray(record)) return ['invalid record'];
  const s=record.session || {};
  for(const key of ['session_id','package_name','runtime','build','bundle_sha','update_id','device','reviewer']) {
    if(typeof s[key]!=='string'||!s[key].trim()||/^(?:PENDENTE|TODO|TBD|N\/A|NA|PLACEHOLDER)$/i.test(s[key].trim())) errors.push('missing session.'+key);
  }
  if(!SHA.test(s.bundle_sha||'')) errors.push('invalid session.bundle_sha');
  if(s.runtime!=='2.0.43'||s.build!=='148') errors.push('runtime/build mismatch');
  if(!['br.com.trynexa.mayaqa','br.com.trynexa.app'].includes(s.package_name)) errors.push('unknown package');
  if(s.package_name==='br.com.trynexa.mayaqa' && s.update_id!=='standalone_sem_ota') errors.push('standalone/OTA mixed');
  if(s.package_name==='br.com.trynexa.app') {
    if(!EAS_UPDATE_ID.test(s.update_id||'')) errors.push('invalid EAS update ID');
    // QA A only: a syntactically valid UUID from another release is not QA A evidence.
    if(s.update_id!==QA_A_OTA_ID || s.bundle_sha!==QA_A_OTA_SHA) errors.push('QA A OTA provenance mismatch');
  }
  if(!Array.isArray(record.cases)) return [...errors,'missing cases'];
  const seen=new Set();
  const evidenceIds=new Set();
  for(const c of record.cases){
    if(!c||typeof c!=='object'||Array.isArray(c)||!IDS.includes(c.id)) {errors.push('unknown case');continue;}
    if(seen.has(c.id)) errors.push('duplicate '+c.id);
    seen.add(c.id);
    if(c.result!=='PASS') errors.push('not PASS '+c.id);
    for(const k of ['session_id','package_name','runtime','build','bundle_sha','update_id']) if(c[k]!==s[k]) errors.push('provenance mismatch '+c.id+':'+k);
    if(typeof c.evidence_id!=='string'||!c.evidence_id.trim()||/^(?:PENDENTE|TODO|TBD|N\/A|NA|PLACEHOLDER)$/i.test(c.evidence_id.trim())) errors.push('missing evidence '+c.id);
    else if(evidenceIds.has(c.evidence_id.trim().toLowerCase())) errors.push('reused evidence '+c.id);
    else evidenceIds.add(c.evidence_id.trim().toLowerCase());
    if(!validObservedAt(c.observed_at)) errors.push('invalid timestamp '+c.id);
    else if(Date.parse(c.observed_at)>Date.now()) errors.push('future timestamp '+c.id);
  }
  for(const id of IDS) if(!seen.has(id)) errors.push('missing '+id);
  if(record.ci!=='success') errors.push('CI not approved');
  if(record.device_compatibility!==true) errors.push('device compatibility unverified');
  if(record.explicit_approval!==true) errors.push('approval missing');
  return errors;
}
if(require.main===module){
  if(process.argv[2]==='--self-test'){
    const s={session_id:'test',package_name:'br.com.trynexa.mayaqa',runtime:'2.0.43',build:'148',bundle_sha:'a'.repeat(40),update_id:'standalone_sem_ota',device:'test Android',reviewer:'QA'};
    const cases=IDS.map(id=>({...s,id,result:'PASS',evidence_id:'redacted-'+id,observed_at:'2026-11-10T01:00:00-03:00'}));
    const good={session:s,cases,ci:'success',device_compatibility:true,explicit_approval:true};
    assert.deepEqual(check(good),[]);
    assert(check({...good,cases:[...cases,cases[0]]}).some(x=>x.startsWith('duplicate')));
    assert(check({...good,cases:cases.slice(1)}).includes('missing A01'));
    assert(check({...good,cases:[null,...cases.slice(1)]}).includes('unknown case'));
    assert(check({...good,cases:[42,...cases.slice(1)]}).includes('unknown case'));
    assert(check({...good,cases:[[],...cases.slice(1)]}).includes('unknown case'));
    assert(check({...good,cases:['A01',...cases.slice(1)]}).includes('unknown case'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,bundle_sha:'b'.repeat(40)}:c)}).some(x=>x.startsWith('provenance mismatch')));
    assert(check({...good,cases:cases.map((c,i)=>i===1?{...c,evidence_id:cases[0].evidence_id}:c)}).includes('reused evidence A02'));
    assert(check({...good,cases:cases.map((c,i)=>i===1?{...c,evidence_id:'  REDACTED-a01  '}:c)}).includes('reused evidence A02'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,evidence_id:'PENDENTE'}:c)}).includes('missing evidence A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,evidence_id:' TODO '}:c)}).includes('missing evidence A01'));
    assert(check({...good,session:{...s,reviewer:'  pendente  '}}).includes('missing session.reviewer'));
    assert(check({...good,session:{...s,device:'TODO'}}).includes('missing session.device'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,observed_at:'2099-01-01T00:00:00-03:00'}:c)}).includes('future timestamp A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,observed_at:'2026-02-30T01:00:00-03:00'}:c)}).includes('invalid timestamp A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,observed_at:'2026-11-10T01:00:00+25:00'}:c)}).includes('invalid timestamp A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,observed_at:'2026-11-10T01:00:00+14:01'}:c)}).includes('invalid timestamp A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,observed_at:'2026-11-10T01:00:00-15:00'}:c)}).includes('invalid timestamp A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,observed_at:'2026-11-10T25:00:00-03:00'}:c)}).includes('invalid timestamp A01'));
    assert(check({...good,ci:'pending'}).includes('CI not approved'));
    const otaSession={...s,package_name:'br.com.trynexa.app',bundle_sha:QA_A_OTA_SHA,update_id:QA_A_OTA_ID};
    const otaCases=cases.map(c=>({...c,package_name:otaSession.package_name,bundle_sha:otaSession.bundle_sha,update_id:otaSession.update_id}));
    assert.deepEqual(check({...good,session:otaSession,cases:otaCases}),[]);
    const wrongRelease={...otaSession,update_id:'50890af6-e7ba-4f98-8fa7-1b3068c18fd4'};
    assert(check({...good,session:wrongRelease,cases:otaCases.map(c=>({...c,update_id:wrongRelease.update_id}))}).includes('QA A OTA provenance mismatch'));
    assert(check({...good,session:{...otaSession,bundle_sha:'b'.repeat(40)},cases:otaCases.map(c=>({...c,bundle_sha:'b'.repeat(40)}))}).includes('QA A OTA provenance mismatch'));
    assert(check({...good,session:{...otaSession,update_id:'fake-ota'},cases:otaCases.map(c=>({...c,update_id:'fake-ota'}))}).includes('invalid EAS update ID'));
    assert(check({...good,session:{...otaSession,update_id:'standalone_sem_ota'},cases:otaCases.map(c=>({...c,update_id:'standalone_sem_ota'}))}).includes('invalid EAS update ID'));
    assert(check({...good,explicit_approval:false}).includes('approval missing'));
    assert.deepEqual(parseEvidence('{broken').errors,['invalid evidence JSON']);
    assert.deepEqual(parseEvidence('null').record,null);
    assert.deepEqual(check(parseEvidence('null').record),['invalid record']);
    console.log('QA A validator self-test passed (synthetic evidence only)');
  } else {
    if(!process.argv[2]) {console.error('Usage: node scripts/maya-qa-a-evidence-check.cjs <evidence.json>');process.exit(2);}
    let raw;
    try { raw=fs.readFileSync(process.argv[2],'utf8'); }
    catch { console.error('NO-GO: evidence file unreadable'); process.exit(1); }
    const parsed=parseEvidence(raw);
    const errors=parsed.errors.length?parsed.errors:check(parsed.record);
    console.log(errors.length?'NO-GO: '+errors.join('; '):'EVIDENCE PRECHECK PASS — human approval still required');
    process.exitCode=errors.length?1:0;
  }
}
module.exports={check};
