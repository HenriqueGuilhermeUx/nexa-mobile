const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../src/lib/onboarding.ts'),'utf8');
const onboarding=fs.readFileSync(path.join(__dirname,'../app/onboarding-wallet.tsx'),'utf8');

assert.match(source,/hasLinkedPrivyWallet\(profile\)/);
assert.match(onboarding,/hasLinkedPrivyWallet\(me\)/);
assert.doesNotMatch(onboarding,/if \(linkedAddress\)/);
assert.match(source,/wallet\?\.privyLinked === true/);
const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const ctx={
  exports:{},require:()=>({walletFirstApi:{readiness:async()=>({pilotProfile:{userControlledWalletConfirmed:true}})}}),
};
vm.runInNewContext(js,ctx,{timeout:1500});
const f=ctx.exports.hasLinkedPrivyWallet;
assert.equal(typeof f,'function');
const address='0x1111111111111111111111111111111111111111';
for (const p of [
  {wallet:{address,provider:'nexa-managed'}},
  {wallet:{address,provider:'nexa-managed',privyLinked:true}},
  {wallet:{address,provider:'privy'}},
  {wallet:{address,provider:'privy',privyLinked:false}},
  {wallet:{address:'invalid',provider:'privy',privyLinked:true}},
]) assert.equal(f(p),false,'unverified/malformed wallet must not skip onboarding');
assert.equal(f({wallet:{address,provider:'privy',privyLinked:true}}),true);
(async()=>{
  assert.equal(await ctx.exports.resolveAuthenticatedRoute(
    {kycStatus:'approved',residenceCountry:'US',wallet:{address,provider:'nexa-managed'}},
    'fake-token'),'/onboarding-wallet');
  assert.equal(await ctx.exports.resolveAuthenticatedRoute(
    {kycStatus:'approved',residenceCountry:'BR',pixWithdrawEnabled:false,
      pixKeyType:'PHONE',wallet:{address,provider:'nexa-managed'}},
    'fake-token'),'/onboarding-wallet',
    'customer should get automatic Privy recovery before configuring Pix CPF');
  assert.equal(await ctx.exports.resolveAuthenticatedRoute(
    {kycStatus:'approved',residenceCountry:'BR',pixWithdrawEnabled:true,
      pixKey:'11977777777',pixKeyType:'PHONE',
      wallet:{address,provider:'privy',privyLinked:true}},
    'fake-token'),'/onboarding-pix',
    'legacy PHONE payout must migrate via explicit review, not bypass CPF-only policy');
  assert.equal(await ctx.exports.resolveAuthenticatedRoute(
    {kycStatus:'pending',residenceCountry:'BR',wallet:{address,provider:'nexa-managed'}},
    'fake-token'),'/onboarding-wallet','wallet provisioning precedes KYC but does not authorize deposits');

  assert.equal(await ctx.exports.resolveAuthenticatedRoute(
    {kycStatus:'approved',residenceCountry:'US',wallet:{address,provider:'privy',privyLinked:true}},
    'fake-token'),'/legacy');
  assert.equal(await ctx.exports.resolveAuthenticatedRoute(
    {kycStatus:'pending',residenceCountry:'BR',
      wallet:{address,provider:'privy',privyLinked:true}},'fake-token'),
    '/kyc','Privy linkage cannot bypass KYC before finance');
  console.log('Automatic Privy wallet provisioning and non-financial KYC gates validated.');
})().catch(error=>{console.error(error);process.exitCode=1;});
