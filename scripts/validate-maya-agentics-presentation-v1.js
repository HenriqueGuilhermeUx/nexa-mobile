const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const path='src/maya-actions/agenticsPresentation.ts';
const src=fs.readFileSync(path,'utf8');
assert.doesNotMatch(src,/fetch\s*\(|axios\.|Authorization|Bearer |executePayment|sendPix|transferUsdc|EXPO_PUBLIC_/);
const transformed=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};
vm.runInNewContext(transformed,{module:m,exports:m.exports,require:(x)=>{
 if(x==='./agenticsReadiness')return {MAYA_AGENTICS_DISABLED:{available:false,mode:'disabled',authenticatedByNexa:false,userScopedJobs:false,externalEffects:false,financialExecution:false}};
 throw Error('Unexpected dependency '+x);
}});
const api=m.exports;
const off=api.mayaAgenticsAvailabilityView();
assert.equal(off.action,'none');
assert.equal(off.canClaimExecution,false);
const ready={available:true,mode:'review_only',authenticatedByNexa:true,userScopedJobs:true,externalEffects:false,financialExecution:false};
assert.equal(api.mayaAgenticsAvailabilityView(ready).action,'review');
assert.equal(api.mayaAgenticsAvailabilityView({...ready,externalEffects:true}).action,'none');
assert.equal(api.mayaAgenticsAvailabilityView({...ready,userScopedJobs:false}).action,'none');
for(const status of ['draft','awaiting_approval','queued','running','completed','failed','cancelled']){
 const view=api.mayaAgenticsTaskView({status,mode:'read_only'});
 assert.equal(view.canClaimExecution,false);
 assert.ok(view.title);
}
assert.match(api.mayaAgenticsTaskView({status:'draft',mode:'read_only'}).detail,/Nenhuma ação foi realizada/);
assert.equal(api.mayaAgenticsTaskView(null).action,'none');
console.log('PASS Maya Agentics customer wording: readiness fail-closed, reviews without claiming execution');
