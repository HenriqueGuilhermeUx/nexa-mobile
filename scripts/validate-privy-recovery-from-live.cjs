'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const base='2e8b883d37381125f7afa1fc17ee630c4dc31bc3';
const changed=execFileSync('git',['diff','--name-only',base+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=new Set(['src/lib/onboarding.ts','app/onboarding-wallet.tsx','app/central-nexa.tsx','scripts/validate-privy-recovery-from-live.cjs','.github/workflows/nexa-privy-recovery-from-live.yml']);
assert.deepEqual(changed.filter(x=>!allowed.has(x)),[],'Unexpected change from live Expo Android');
for(const p of ['app.json','eas.json','package.json','package-lock.json','app/wallet-ownership.tsx','src/lib/api.ts','src/lib/walletFirst.ts']){
assert.equal(fs.readFileSync(p,'utf8'),execFileSync('git',['show',base+':'+p],{encoding:'utf8'}),'Protected file changed '+p);
}
const expo=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(expo.version,'2.0.43');assert.equal(expo.android.versionCode,148);
assert.equal(expo.runtimeVersion.policy,'appVersion');
const on=fs.readFileSync('src/lib/onboarding.ts','utf8');
const w=fs.readFileSync('app/onboarding-wallet.tsx','utf8');
const central=fs.readFileSync('app/central-nexa.tsx','utf8');
assert(on.indexOf('if (!hasLinkedPrivyWallet(profile))')<on.indexOf("if (String(profile?.kycStatus || '').toLowerCase() !== 'approved')"));
assert(on.includes("pixType === 'CPF'"));
assert(w.includes('await nexaApi.linkWallet('));
assert(w.includes('hasLinkedPrivyWallet(me)'));
assert(w.includes('embedded.create({ createAdditional: false })'));
assert(w.includes("String(linkedProfile?.kycStatus || '').toLowerCase() === 'approved'"));
assert(central.includes('setNeedsPrivyActivation(!hasLinkedPrivyWallet(profile))'));
assert(central.includes('ATUALIZAÇÃO DE SEGURANÇA NEXA'));
console.log('PASS live Expo base preserved; Privy account recovery + KYC + Central + Pix CPF.');
