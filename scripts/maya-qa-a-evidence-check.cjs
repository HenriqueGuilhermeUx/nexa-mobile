#!/usr/bin/env node
// QA A evidence preflight only. Never publishes OTA or approves production.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const IDS = Array.from({length:16},(_,i)=>'A'+String(i+1).padStart(2,'0'));
const SHA=/^[a-f0-9]{40}$/i;
const OFFSET=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
function check(record) {
  const errors=[];
  if (!record || typeof record!=='object' || Array.isArray(record)) return ['invalid record'];
  const s=record.session || {};
  for(const key of ['session_id','package_name','runtime','build','bundle_sha','update_id','device','reviewer']) {
    if(typeof s[key]!=='string'||!s[key].trim()||s[key]==='PENDENTE') errors.push('missing session.'+key);
  }
  if(!SHA.test(s.bundle_sha||'')) errors.push('invalid session.bundle_sha');
  if(s.runtime!=='2.0.43'||s.build!=='148') errors.push('runtime/build mismatch');
  if(!['br.com.trynexa.mayaqa','br.com.trynexa.app'].includes(s.package_name)) errors.push('unknown package');
  if(s.package_name==='br.com.trynexa.mayaqa' && s.update_id!=='standalone_sem_ota') errors.push('standalone/OTA mixed');
  if(s.package_name==='br.com.trynexa.app' && s.update_id==='standalone_sem_ota') errors.push('Play/standalone mixed');
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
    else if(evidenceIds.has(c.evidence_id.trim())) errors.push('reused evidence '+c.id);
    else evidenceIds.add(c.evidence_id.trim());
    if(typeof c.observed_at!=='string'||!OFFSET.test(c.observed_at)||Number.isNaN(Date.parse(c.observed_at))) errors.push('invalid timestamp '+c.id);
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
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,evidence_id:'PENDENTE'}:c)}).includes('missing evidence A01'));
    assert(check({...good,cases:cases.map((c,i)=>i===0?{...c,evidence_id:' TODO '}:c)}).includes('missing evidence A01'));
    assert(check({...good,ci:'pending'}).includes('CI not approved'));
    assert(check({...good,explicit_approval:false}).includes('approval missing'));
    console.log('QA A validator self-test passed (synthetic evidence only)');
  } else {
    if(!process.argv[2]) {console.error('Usage: node scripts/maya-qa-a-evidence-check.cjs <evidence.json>');process.exit(2);}
    const errors=check(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
    console.log(errors.length?'NO-GO: '+errors.join('; '):'EVIDENCE PRECHECK PASS — human approval still required');
    process.exitCode=errors.length?1:0;
  }
}
module.exports={check};
