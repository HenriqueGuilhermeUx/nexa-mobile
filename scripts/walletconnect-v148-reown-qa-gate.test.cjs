'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const src=fs.readFileSync('src/lib/externalWalletReownGate.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',js)(mod,mod.exports);
const gate=mod.exports.assertReownExternalWalletReady;
const valid={enabled:true,projectId:'a'.repeat(32),licenseApproved:true,nativeBuildVerified:false,nativeQaMode:true,environment:'preview'};
assert.equal(gate(valid).transferEnabled,false);
assert.equal(gate(valid).internalQaOnly,true);
for(const bad of [
  {enabled:false},{projectId:''},{projectId:'xyz'},{projectId:'*'.repeat(32)},
  {licenseApproved:false},{nativeBuildVerified:false,nativeQaMode:false},
  {environment:'production'},{environment:'production',nativeBuildVerified:true},
]) assert.throws(()=>gate({...valid,...bad}),/DISABLED|REQUIRED|REVIEW|UNVERIFIED|ROLLOUT/);
const app=fs.readFileSync('src/lib/reownExternalWalletAppKit.ts','utf8');
assert.match(app,/enableAnalytics: false/);
assert.match(app,/swaps: false, onramp: false, socials: false/);
assert.match(app,/const sessionStore = new Map<string, unknown>\(\)/);
assert.match(app,/redirect: \{ native: 'nexa-walletconnect-qa:\/\/' \}/);
assert.doesNotMatch(app,/AsyncStorage/);
const product=fs.readFileSync('src/lib/walletConnectProductGate.ts','utf8');
assert.match(product,/walletConnectFinancialOperationsEnabled = false as const/);
const eas=JSON.parse(fs.readFileSync('eas.json','utf8')).build;
const qa=eas['wallet-inbound-lab-v148'];
assert.equal(qa.env.EXPO_PUBLIC_NEXA_REOWN_ENABLED,'false');
assert.equal(qa.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED,'false');
assert.notEqual(eas.production.env.EXPO_PUBLIC_NEXA_REOWN_ENABLED,'true');
console.log('PASS Reown disabled-by-default and isolated Android QA native activation contract');
console.log('PASS session isolation, no third-party swaps/onramp, financial execution off');
