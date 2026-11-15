'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const stable='c656931c71932e6217739612149166dde8179a8b';
const baseline='a97dea14a6235be6332fc106370c70665de9fef3';
const changed=execFileSync('git',['diff','--name-only',stable+'...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const allowed=['app/central-nexa.tsx','app/_layout.tsx',
  'scripts/validate-central-nexa-v148-consent-push-qa.js',
  '.github/workflows/central-nexa-v148-consent-push-qa.yml'];
assert.deepEqual(changed.filter(x=>!allowed.includes(x)),[],'Unexpected changes outside Central: '+changed.join(','));
for(const p of ['app.json','app.config.js','eas.json','package.json','package-lock.json',
  'src/lib/api.ts','src/lib/nexaNotifications.ts',
  'src/components/AlignedLegacyApp.tsx','app/kyc.tsx','app/sign-in.tsx']) {
  const previous=execFileSync('git',['show',stable+':'+p]);
  assert.deepEqual(fs.readFileSync(p),previous,'Existing release/native/financial file altered: '+p);
}
const config=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(config.version,'2.0.43');
assert.equal(config.android.versionCode,148);
assert.equal(config.runtimeVersion.policy,'appVersion');
assert.equal(config.extra.eas.projectId,'b3faabec-283a-4ba2-88b5-f096304e68aa');
const screen=fs.readFileSync('app/central-nexa.tsx','utf8');
for(const expected of ['inboxState === \'ready\'','CHANNEL_OPTIONS','refreshChannelConsents',
  'sendPushSelfTest','setChannelConsent','nexaWhatsAppSupportUrl',
  'NEXA_TELEGRAM_SUPPORT_URL','registerNexaCentralServicePush',
  'revokeNexaCentralServicePush','Os avisos push estão em preparação']) {
  assert(screen.includes(expected),'Missing preserved/added Central contract: '+expected);
}
const layout=fs.readFileSync('app/_layout.tsx','utf8');
assert(layout.includes('addNotificationResponseReceivedListener'),'Missing notification tap listener');
assert(layout.includes("route === '/central-nexa'"),'Unsafe/missing deep-link allowlist');
assert(layout.includes('<AppLockGate>'),'Auth lock gate missing');
console.log('PASS: cumulative v148 safe release with new Central UI only; no native/financial changes');
console.log('Protected baseline: '+baseline+' | previous released code: '+stable);
console.log('Changes: '+changed.join(','));
