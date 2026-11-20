'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const baseline='72f2b82241eae43bda20a33c03758680787a613e';
const changed=execFileSync('git',['diff','--name-only',baseline+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=new Set(['src/lib/onboarding.ts','app/onboarding-wallet.tsx',
 'app/wallet-ownership.tsx','app/central-nexa.tsx',
 'scripts/validate-privy-v148-hotfix.cjs',
 '.github/workflows/nexa-privy-v148-ota-release.yml',
 'docs/privy-v148-ota-release.md']);
assert.deepEqual(changed.filter(x=>!allowed.has(x)),[],'Unexpected native/financial diff in OTA');
for(const p of ['app.json','app.config.js','eas.json','package.json','package-lock.json',
'src/lib/api.ts','src/lib/walletFirst.ts']){
 const original=execFileSync('git',['show',baseline+':'+p],{encoding:'utf8'});
 assert.equal(fs.readFileSync(p,'utf8'),original,'OTA changed protected '+p);
}
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(app.version,'2.0.43');
assert.equal(app.android.versionCode,148);
assert.equal(app.runtimeVersion.policy,'appVersion');
assert.equal(app.extra.eas.projectId,'b3faabec-283a-4ba2-88b5-f096304e68aa');
const on=fs.readFileSync('src/lib/onboarding.ts','utf8');
const wallet=fs.readFileSync('app/onboarding-wallet.tsx','utf8');
const owner=fs.readFileSync('app/wallet-ownership.tsx','utf8');
const central=fs.readFileSync('app/central-nexa.tsx','utf8');
assert(on.includes('hasLinkedPrivyWallet(profile)'));
assert(on.includes('wallet.privyLinked === true'));
assert(!on.includes('if (!walletAddress(profile))'));
assert(wallet.includes('hasLinkedPrivyWallet(me)'));
assert(!wallet.includes('if (linkedAddress)'));
assert(owner.includes('walletFirstApi.createOwnershipChallenge'));
assert(owner.includes('walletFirstApi.verifyOwnershipSignature'));
assert(!owner.includes('walletAuditReady'));
assert(central.includes('ATUALIZAÇÃO IMPORTANTE DA NEXA'));
assert(central.includes('Concluir minha carteira Privy'));
console.log('Nexa v148 Privy-only OTA contract passed; changed:',changed);
