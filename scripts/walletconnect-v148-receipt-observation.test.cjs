'use strict';
/** Offline malicious-response QA for the actual Polygon USDC receipt client. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const file=path.resolve(__dirname,'../src/lib/externalUsdcReceiptObservation.ts');
const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
},fileName:file}).outputText;
const mod={exports:{}};
new Function('require','module','exports',compiled)(
  id=>id==='@/config'?{config:{apiUrl:'https://wallet-qa.invalid/api/v1'}}:require(id),
  mod,mod.exports);
const observe=mod.exports.observeExternalUsdcReceipt;
const hash='0x'+'a'.repeat(64);
const from='0x1111111111111111111111111111111111111111';
const recipient='0x2222222222222222222222222222222222222222';
const event={from,recipient,amountUsdc:'1.250000',eventId:`137:${hash}:0`};
const good={status:'CONFIRMED',chainId:137,txHash:hash,confirmations:12,
  confirmationsRequired:12,events:[event],ledgerCredited:false,
  financialAction:false,blockchainSourceOfTruth:true};
let payload=good,requests=0;
global.fetch=async (url,options)=>{
  requests++;
  assert.equal(String(url),`https://wallet-qa.invalid/api/v1/wallet-connect-inbound/receive/confirm?txHash=${hash}`);
  assert.equal(options.method,'GET');
  assert.equal(options.headers.Authorization,'Bearer qa-token');
  return {ok:true,status:200,json:async()=>payload};
};
async function reject(changed,pattern=/UNTRUSTED/){
  payload={...good,...changed};
  await assert.rejects(observe('qa-token',hash),pattern);
}
(async()=>{
  const ok=await observe('qa-token',hash);
  assert.equal(ok.status,'CONFIRMED');
  assert.equal(ok.ledgerCredited,false);
  await reject({events:[event,event]});
  await reject({events:[{...event,eventId:`137:${hash}:bogus`}]});
  await reject({events:[{...event,eventId:`137:${hash}:0:extra`}]});
  await reject({events:[{...event,eventId:`137:${hash}:00`},{...event,eventId:`137:${hash}:0`}]});
  await reject({events:[{...event,amountUsdc:'0'}]});
  await reject({events:[{...event,recipient:'not-address'}]});
  await reject({events:Array(101).fill(event)});
  await reject({confirmations:-1});
  await reject({confirmations:11,status:'CONFIRMED'});
  await reject({confirmations:12,status:'CONFIRMING'});
  await reject({ledgerCredited:true});
  await reject({financialAction:true});
  await reject({chainId:1});
  await reject({txHash:'0x'+'b'.repeat(64)});
  payload={status:'PENDING',chainId:137,ledgerCredited:false};
  assert.equal((await observe('qa-token',hash)).status,'PENDING');
  const before=requests;
  await assert.rejects(observe('qa-token','not-a-tx'),/INVALID_POLYGON_TX_HASH/);
  assert.equal(requests,before);
  console.log('PASS: read-only Polygon receipt, confirmation threshold, duplicate/malformed event rejection');
  console.log('PASS: invalid network, hash, ledger credit and execution attempts fail closed');
})().catch(err=>{console.error(err);process.exitCode=1;});
