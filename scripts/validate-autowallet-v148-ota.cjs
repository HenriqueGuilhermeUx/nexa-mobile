'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const baseline='b8bc4c65f08480f2a334be457ef47bcc1b20f49d';
const changed=execFileSync('git',['diff','--name-only',baseline+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=new Set(['src/lib/onboarding.ts','app/onboarding-wallet.tsx',
 'app/wallet-ownership.tsx','scripts/validate-autowallet-v148-ota.cjs',
 '.github/workflows/nexa-autowallet-v148-ota.yml']);
assert.deepEqual(changed.filter(p=>!allowed.has(p)),[],'Unexpected native/financial OTA change');
for(const p of ['app.json','app.config.js','eas.json','package.json','package-lock.json','src/lib/api.ts','src/lib/walletFirst.ts','app/central-nexa.tsx']){
 const a=execFileSync('git',['show',baseline+':'+p],{encoding:'utf8'});
 assert.equal(fs.readFileSync(p,'utf8'),a,'Protected production-native or Central file changed: '+p);
}
const expo=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(expo.version,'2.0.43');
assert.equal(expo.android.versionCode,148);
assert.equal(expo.runtimeVersion.policy,'appVersion');
assert.equal(expo.extra.eas.projectId,'b3faabec-283a-4ba2-88b5-f096304e68aa');
const on=fs.readFileSync('src/lib/onboarding.ts','utf8');
const wallet=fs.readFileSync('app/onboarding-wallet.tsx','utf8');
const owner=fs.readFileSync('app/wallet-ownership.tsx','utf8');
const initial=on.indexOf('if (!hasLinkedPrivyWallet(profile))');
const kyc=on.indexOf("if (String(profile?.kycStatus || '').toLowerCase() !== 'approved')");
assert(initial>0 && kyc>initial,'Privy activation must happen before KYC; finance still gated');
assert(on.includes("pixType === 'CPF'"));
assert(wallet.includes('hasLinkedPrivyWallet(me)'));
assert(wallet.includes("String(linkedProfile?.kycStatus || '').toLowerCase() === 'approved'"));
assert(wallet.includes('await nexaApi.linkWallet('));
assert(owner.includes('walletFirstApi.createOwnershipChallenge'));
assert(owner.includes('walletFirstApi.verifyOwnershipSignature'));
assert(!owner.includes('walletAuditReady'));
console.log('PASS: OTA JS-only, v148 native baseline, Privy automation, KYC and CPF gates.');
