'use strict';
/**
 * Offline integration contract: runs the ACTUAL mobile TypeScript client with
 * a mocked authenticated QA API and real viem ERC20 ABI encode/decode.
 * No provider, wallet, RPC, funds, keys or real backend connection.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const typescript=require('typescript');
const {encodeFunctionData,getAddress,parseUnits}=require('viem');
const file=path.resolve(__dirname,'../src/lib/externalUsdcReceivePreview.ts');
const js=typescript.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{target:typescript.ScriptTarget.ES2022,module:typescript.ModuleKind.CommonJS},
  fileName:file,
}).outputText;
const output={exports:{}};
new Function('require','module','exports',js)(
  id=>id==='@/config'?
    {config:{apiUrl:'https://wallet-qa.invalid/api/v1'}}:require(id),
  output,output.exports
);
const api=output.exports;
const SOURCE='0x1111111111111111111111111111111111111111';
const DEST=getAddress('0x2222222222222222222222222222222222222222');
const TOKEN=getAddress('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359');
const abi=[{type:'function',name:'transfer',stateMutability:'nonpayable',
  inputs:[{name:'to',type:'address'},{name:'value',type:'uint256'}],outputs:[{name:'success',type:'bool'}]}];
const receiver={walletAddress:DEST,chainId:137,asset:'USDC',contractAddress:TOKEN,
  feeBps:0,source:'LIVE_PRIVY_USER_AND_WALLET_AUDIT',financialAction:false,ledgerCredited:false};
function validPreview(amount='2.50'){
  return {mode:'PREVIEW_ONLY',destinationSource:'LIVE_PRIVY_USER_AND_WALLET_AUDIT',
    chainId:137,asset:'USDC',creditsLedger:false,backendMaySign:false,
    backendMayBroadcast:false,requiresExternalWalletSignature:true,
    recipient:DEST,amount,contractAddress:TOKEN,
    pricing:{feeBps:0,feeUsdc:'0',netUsdc:amount,market:'BR',mode:'PREVIEW_ONLY'},
    transactionRequest:{chainId:137,from:SOURCE,to:TOKEN,value:'0x0',
      data:encodeFunctionData({abi,functionName:'transfer',args:[DEST,parseUnits(amount,6)]})}};
}
const audit=[];
let dest=receiver,preview=validPreview(),authFailure=false;
global.fetch=async (url,options)=>{
  assert.ok(String(url).startsWith('https://wallet-qa.invalid/api/v1/wallet-connect-inbound/'));
  assert.equal(options.method,'GET');
  assert.equal(options.headers.Authorization,'Bearer qa-fixture-token');
  audit.push(String(url));
  if(authFailure)return {ok:false,status:403};
  const body=String(url).includes('/preview?')?preview:dest;
  return {ok:true,status:200,json:async()=>body};
};
async function rejects(promise,pattern){await assert.rejects(promise,pattern);}
async function main(){
  let verified=await api.getVerifiedNexaReceiveDestination('qa-fixture-token');
  assert.equal(verified.walletAddress,DEST);
  const result=await api.getReviewedExternalUsdcTransfer({
    accessToken:'qa-fixture-token',sourceAddress:SOURCE,destination:verified,
    amountUsdc:'2.50',market:'BR',
  });
  assert.equal(result.mode,'PREVIEW_ONLY');
  assert.equal(result.financialAction,false);
  assert.equal(result.recipient,DEST);
  assert.equal(result.transactionRequest.to,TOKEN);
  assert.equal(result.amount,'2.50');
  assert.equal(result.pricing.feeBps,0);
  assert.equal(audit.length,2);
  for(const changed of [
    {contractAddress:SOURCE},
    {walletAddress:'not-an-eip55-address'},
    {source:'SELF_REPORTED'},
    {ledgerCredited:true},
    {financialAction:true},
    {feeBps:25},
    {chainId:1},
  ]) {
    dest={...receiver,...changed};
    await rejects(api.getVerifiedNexaReceiveDestination('qa-fixture-token'));
  }
  dest=receiver;
  verified=await api.getVerifiedNexaReceiveDestination('qa-fixture-token');
  for(const changed of [
    {recipient:SOURCE},
    {amount:'200'},
    {contractAddress:SOURCE},
    {backendMayBroadcast:true},
    {creditsLedger:true},
    {destinationSource:'CACHED_PROFILE'},
    {pricing:{...preview.pricing,feeBps:10}},
    {pricing:{...preview.pricing,feeUsdc:'1'}},
    {transactionRequest:{...preview.transactionRequest,to:SOURCE}},
    {transactionRequest:{...preview.transactionRequest,from:DEST}},
    {transactionRequest:{...preview.transactionRequest,
      data:encodeFunctionData({abi,functionName:'transfer',args:[SOURCE,parseUnits('2.50',6)]})}},
    {transactionRequest:{...preview.transactionRequest,
      data:encodeFunctionData({abi,functionName:'transfer',args:[DEST,parseUnits('2.51',6)]})}},
  ]) {
    preview={...validPreview(),...changed};
    await rejects(api.getReviewedExternalUsdcTransfer({
      accessToken:'qa-fixture-token',sourceAddress:SOURCE,destination:verified,
      amountUsdc:'2.50',market:'BR',
    }));
  }
  preview=validPreview();
  for(const amount of ['0','0.000000','0.0000001','1.1234567','1e6','-1','1,5']) {
    await rejects(api.getReviewedExternalUsdcTransfer({
      accessToken:'qa-fixture-token',sourceAddress:SOURCE,destination:verified,
      amountUsdc:amount,market:'BR',
    }));
  }
  authFailure=true;
  await rejects(api.getVerifiedNexaReceiveDestination('qa-fixture-token'),/RECEIVE_PILOT_UNAVAILABLE/);
  console.log('PASS walletconnect offline: audited Privy destination, exact Polygon USDC calldata, 0% fee');
  console.log('PASS walletconnect offline: invalid amounts, wrong network, recipient, signature assumptions and disabled pilot rejected');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
