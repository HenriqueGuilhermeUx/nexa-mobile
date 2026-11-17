'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

const source=fs.readFileSync('src/lib/externalWalletWatch.ts','utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const exportsObject={};
const fakeViem={
  isAddress:(v)=>/^0x[a-fA-F0-9]{40}$/.test(String(v)),
  getAddress:(v)=>String(v).toLowerCase(),
  createPublicClient:()=>({}),
  formatUnits:()=> '0',
  http:()=>({}),
};
const resolver=(name)=>{
  if(name==='viem')return fakeViem;
  if(name==='viem/chains')return {polygon:{id:137}};
  if(name==='expo-crypto')return {};
  if(name==='expo-secure-store')return {};
  throw Error('Unexpected import: '+name);
};
const sandbox={module:{exports:exportsObject},exports:exportsObject,require:resolver,process:{env:{}},console};
vm.runInNewContext(javascript,sandbox,{filename:'externalWalletWatch.compiled.js'});
const verify=sandbox.module.exports.verifiedNexaReceiveAddress;
assert.equal(typeof verify,'function');
const nex='0x1111111111111111111111111111111111111111';
const external='0x2222222222222222222222222222222222222222';
const user={wallet:{address:nex,provider:'nexa-managed',network:'polygon'}};
const result={success:true,portfolio:{address:nex,network:'polygon',walletReady:true}};
assert.equal(verify(user,result),nex,'valid Nexa-managed wallet displays own receive address');
assert.equal(verify({wallet:{...user.wallet,provider:'privy'}},result),nex,'Privy wallet displays if matched');
assert.equal(verify(user,{...result,portfolio:{...result.portfolio,address:external}}),null,'outgoing destination never shown as deposit QR');
assert.equal(verify({...user,wallet:{...user.wallet,address:external}},result),null,'identity wallet mismatch denied');
assert.equal(verify(user,{...result,portfolio:{...result.portfolio,network:'ethereum'}}),null,'wrong network denied');
assert.equal(verify({...user,wallet:{...user.wallet,network:'ethereum'}},result),null,'identity network denied');
assert.equal(verify(user,{...result,portfolio:{...result.portfolio,walletReady:false}}),null,'unready wallet denied');
assert.equal(verify({...user,wallet:{...user.wallet,provider:'sandbox'}},result),null,'mock wallet denied');
assert.equal(verify({},result),null,'missing authenticated identity denied');
assert.equal(verify(user,{...result,success:false}),null,'failed API response denied');
assert.equal(verify(user,{...result,portfolio:{...result.portfolio,address:'not-a-wallet'}}),null,'invalid address denied');
const ui=fs.readFileSync('app/(app)/external-wallets.tsx','utf8');
const legacy=fs.readFileSync('src/components/AlignedLegacyApp.tsx','utf8');
assert.match(ui,/verifiedNexaReceiveAddress\(profile, body\)/);
assert.match(ui,/Nenhum QR foi liberado/);
assert.match(legacy,/verifiedNexaReceiveAddress\(user, walletFirst\)/);
assert.match(legacy,/<QRCode value=\{verifiedReceiveAddress\} size=\{186\}/);
assert.match(legacy,/RECEBIMENTO EM VERIFICAÇÃO/);
assert(!legacy.includes('<QRCode value={walletAddress} size={186} />'));
console.log('PASS: 11 wallet-ownership / deposit-address verification cases + both receive QR surfaces fail closed.');
