#!/usr/bin/env node
/** Pure offline test of read-only native USDC balance HTTP response.
 * No app account, Polygon RPC, Privy credentials, Reown or production access.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const filename = path.join(root,'src/lib/directUsdcBalance.ts');
const js = ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020 },
}).outputText;
const moduleStub={exports:{}};
const config={apiUrl:'https://isolated-fixture.invalid/api/v1'};
const isAddress=a=>typeof a==='string' && /^0x[a-fA-F0-9]{40}$/.test(a);
new Function('require','module','exports',js)((name)=>{
  if(name==='@/config') return {config};
  if(name==='viem') return {isAddress};
  throw new Error('UNEXPECTED_TEST_DEPENDENCY');
},moduleStub,moduleStub.exports);
const {loadDirectUsdcOnchainBalance}=moduleStub.exports;
const wallet='0x1111111111111111111111111111111111111111';
const different='0x2222222222222222222222222222222222222222';
const nativeUSDC='0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
const base={
  walletAddress:wallet,balanceRaw:'2500000',balanceUsdc:'2.5',
  chainId:137,asset:'USDC',contractAddress:nativeUSDC,decimals:6,
  source:'POLYGON_NATIVE_USDC_BALANCE_OF',walletLocation:'privy',
  ledgerCredited:false,reconciledDeposit:false,financialAction:false,readOnly:true,
};
const original=global.fetch;
async function main(){
  let calls=0;
  global.fetch=async(url,options)=>{
    calls++;
    assert.equal(url,config.apiUrl+'/wallet-connect-inbound/receive/balance');
    assert.equal(options.method,'GET');
    assert.equal(options.headers.Authorization,'Bearer fixture-access');
    return {ok:true,json:async()=>({...base})};
  };
  const valid=await loadDirectUsdcOnchainBalance({
    accessToken:'fixture-access',verifiedReceivingWallet:wallet,
  });
  assert.equal(valid.balanceUsdc,'2.5');
  assert.equal(valid.financialAction,false);
  assert.equal(calls,1);
  for(const override of [
    {walletAddress:different}, {contractAddress:different}, {chainId:1},
    {asset:'USDC.e'},{decimals:18},{source:'OTHER'},{ledgerCredited:true},
    {reconciledDeposit:true},{financialAction:true},{readOnly:false},
    {balanceRaw:'-1'},{balanceRaw:'1.5'},{balanceUsdc:'2.1234567'},
    {balanceUsdc:250},{balanceRaw:2500000},
  ]){
    global.fetch=async()=>({ok:true,json:async()=>({...base,...override})});
    await assert.rejects(
      loadDirectUsdcOnchainBalance({
        accessToken:'fixture-access',verifiedReceivingWallet:wallet,
      }),/UNTRUSTED_USDC_BALANCE/,
    );
  }
  global.fetch=async()=>{throw new Error('FETCH_SHOULD_NOT_HAVE_BEEN_CALLED');};
  await assert.rejects(
    loadDirectUsdcOnchainBalance({accessToken:'',verifiedReceivingWallet:wallet}),
    /AUTH_REQUIRED/,
  );
  await assert.rejects(
    loadDirectUsdcOnchainBalance({accessToken:'fixture-access',verifiedReceivingWallet:'not-an-address'}),
    /INVALID_RECEIVING_WALLET/,
  );
  console.log('PASS: Reown-free Privy USDC balance rejects wrong wallet, token, network and ledger claims');
}
main().catch(e=>{console.error('FAIL: isolated USDC balance contract test:',e.message);process.exitCode=1;})
  .finally(()=>{global.fetch=original;});
