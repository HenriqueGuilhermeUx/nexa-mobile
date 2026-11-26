'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const eas=JSON.parse(fs.readFileSync('eas.json','utf8'));
assert.equal(app.version,'2.0.43');
assert.equal(app.android.package,'br.com.trynexa.app');
assert.equal(app.android.versionCode,148);
assert.equal(app.runtimeVersion.policy,'appVersion');
assert.equal(eas.build.production.channel,'production');
const base=cp.execFileSync('git',['merge-base','origin/main','HEAD'],{encoding:'utf8'}).trim();
const changed=cp.execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=new Set([
 'app/assistant.tsx','app/_layout.tsx',
 'app/maya-hoje.tsx','app/maya-planning.tsx','app/maya-actions.tsx','app/maya-comunicacao.tsx','app/maya-shopping.tsx',
 'src/maya-actions/communicationDraft.ts','src/maya-actions/shoppingSearch.ts',
 'scripts/validate-maya-main-cumulative-qa.cjs',
 '.github/workflows/maya-main-cumulative-qa.yml',
]);
for(const p of changed)assert.ok(allowed.has(p),'Unexpected production diff: '+p);
const layout=fs.readFileSync('app/_layout.tsx','utf8');
const assistant=fs.readFileSync('app/assistant.tsx','utf8');
for(const route of ['maya-hoje','maya-actions','maya-planning','maya-shopping','maya-comunicacao']){
 assert.ok(layout.includes('name="'+route+'"'),'Route not registered: '+route);
 assert.ok(assistant.includes("'/"+route+"'"),'Assistant CTA missing: '+route);
 assert.ok(fs.existsSync('app/'+route+'.tsx'),'Screen not found: '+route);
}
assert.ok(!assistant.includes('agentics-bridge-staging'),'Never target backend staging from clients');
for(const path of ['app/maya-actions.tsx','app/maya-comunicacao.tsx','app/maya-planning.tsx','app/maya-shopping.tsx','app/maya-hoje.tsx']){
 const s=fs.readFileSync(path,'utf8');
 assert.ok(!s.includes("router.push('/maya-actions-financas'"),'Do not link to unavailable finance route');
 assert.ok(!/AGENTICS_ADMIN_TOKEN|NEXA_AGENTICS_BRIDGE_SECRET|AGENTICS_API_TOKEN/.test(s),'No server credentials');
}
for(const p of ['app.json','app.config.js','eas.json','package.json','package-lock.json','src/lib/api.ts','src/lib/nexaNotifications.ts']){
 const original=cp.execFileSync('git',['show',base+':'+p],{encoding:'utf8'});
 assert.equal(fs.readFileSync(p,'utf8'),original,'Immutable production file drift: '+p);
}
console.log('PASS main-based Maya cumulative QA: v148 identity, five routes, unchanged wallet/native config, reviewed diff='+changed.join(','));
