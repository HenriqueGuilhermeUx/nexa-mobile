const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/maya-actions/agenticsReviewPreview.ts','utf8');
assert.doesNotMatch(source,/fetch\s*\(|axios\.|Authorization|Bearer |sendPix|executePayment|EXPO_PUBLIC_/);
const out={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,Set,Array,Object});
const parse=out.parseMayaAgenticsReviewPreview;
const id='33333333-3333-4333-8333-333333333333';
const good={taskId:id,status:'preview_ready',
 steps:[{action:'review_request',description:'Revisar o pedido'},{action:'approve_before_execution',description:'Revisar antes de autorizar'}],
 externalEffects:false,financialExecution:false,remoteConnectorsUsed:false,requiresUserReview:true};
assert.equal(parse(good,id).status,'preview_ready');
assert.equal(parse(good,'22222222-2222-4222-8222-222222222222'),null);
for (const bad of [
 {...good,financialExecution:true},
 {...good,externalEffects:true},
 {...good,remoteConnectorsUsed:true},
 {...good,requiresUserReview:false},
 {...good,steps:[]},
 {...good,steps:[{action:'review_request',description:'Review'}]},
 {...good,steps:[{action:'send_pix',description:'Pay'},good.steps[1]]},
 {...good,steps:[{action:'review_request',description:'   '},good.steps[1]]},
 {...good,steps:[{...good.steps[0],url:'https://third-party.example'},good.steps[1]]},
 {...good,sessionToken:'leak'},
]) assert.equal(parse(bad,id),null);
console.log('PASS Maya Agentics read-only preview contract rejects untrusted or cross-task response');
