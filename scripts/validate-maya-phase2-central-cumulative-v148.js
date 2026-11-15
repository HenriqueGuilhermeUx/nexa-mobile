'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const base='191bc32958ef40c7bc217babf781f3172f89c415';
const changed=cp.execFileSync('git',['diff','--name-only',base+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=['app/central-nexa.tsx','app/_layout.tsx',
'scripts/validate-maya-phase2-central-cumulative-v148.js',
'.github/workflows/maya-phase2-central-cumulative-qa.yml',
'docs/maya-central-cumulative-release-20261115.md',
'.github/workflows/maya-phase2-central-cumulative-canary.yml'];
assert.deepEqual(changed.filter(x=>!allowed.includes(x)),[], 'Unexpected changes to Maya / financial / app core: '+changed.join(', '));
for(const file of ['app.json','eas.json','package.json','package-lock.json',
  'src/components/NexaAssistantOpenFinance.tsx','app/assistant.tsx','src/lib/api.ts',
  'src/lib/nexaNotifications.ts','src/lib/nexaCentralPush.ts',
  'src/components/AlignedLegacyApp.tsx','app/kyc.tsx','app/sign-in.tsx']){
  const prior=cp.execFileSync('git',['show',base+':'+file]);
  assert.deepEqual(fs.readFileSync(file),prior,'A live Maya/finance/native file changed: '+file);
}
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(app.version,'2.0.43');
assert.equal(app.android.versionCode,148);
assert.equal(app.android.package,'br.com.trynexa.app');
assert.equal(app.runtimeVersion.policy,'appVersion');
assert.equal(app.extra.eas.projectId,'b3faabec-283a-4ba2-88b5-f096304e68aa');
const central=fs.readFileSync('app/central-nexa.tsx','utf8');
for(const marker of ['CHANNEL_OPTIONS','refreshChannelConsents',
  'sendPushSelfTest','setChannelConsent','noteDepositGuideOpened',
  'registerNexaCentralServicePush','revokeNexaCentralServicePush',
  'nexaWhatsAppSupportUrl','NEXA_TELEGRAM_SUPPORT_URL',
  'inboxState === \'ready\'']){
  assert(central.includes(marker),'Central missing feature '+marker);
}
const layout=fs.readFileSync('app/_layout.tsx','utf8');
assert(layout.includes('getLastNotificationResponseAsync'));
assert(layout.includes('addNotificationResponseReceivedListener'));
assert(/route\s*===\s*['"]\/central-nexa['"]/.test(layout),'Central route must be strict allowlist');
assert(layout.includes('<AppLockGate>'));
console.log('MAYA_CENTRAL_CUMULATIVE_SAFE: '+JSON.stringify({base,changed}));
