'use strict';
const fs=require('fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('child_process');
const baseline='a97dea14a6235be6332fc106370c70665de9fef3';
const output=execFileSync('git',['diff','--name-only',baseline+'...HEAD'],{encoding:'utf8'});
const changed=output.trim().split('\n').filter(Boolean).sort();
const allowed=[
  'app/central-nexa.tsx','app/kyc.tsx','app/sign-in.tsx',
  'src/components/AlignedLegacyApp.tsx','src/lib/nexaSupportLinks.ts',
  'src/lib/nexaCentralPush.ts',
  'scripts/validate-central-nexa-v148.js',
  'scripts/validate-central-nexa-push-optin-v148.js',
  'scripts/validate-central-nexa-cumulative-release.js',
  '.github/workflows/central-nexa-cumulative-release-ci.yml',
  '.github/workflows/central-nexa-release-qa.yml',
  '.github/workflows/central-nexa-release-production.yml',
  'docs/central-nexa-ota-v148-release-audit.md',
].sort();
const unexpected=changed.filter(path=>!allowed.includes(path));
assert.deepStrictEqual(unexpected,[],'Non-Central changes from live OTA baseline: '+unexpected.join(', '));
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
assert.equal(app.version,'2.0.43');
assert.equal(app.runtimeVersion.policy,'appVersion');
assert.equal(app.android.versionCode,148);
assert.equal(app.android.package,'br.com.trynexa.app');
assert.equal(app.extra.eas.projectId,'b3faabec-283a-4ba2-88b5-f096304e68aa');
const src=fs.readFileSync('app/central-nexa.tsx','utf8');
assert(src.includes('Central Nexa'));
assert(src.includes('inboxState === \'ready\''));
assert(src.includes('Os avisos push estão em preparação'));
assert(src.includes('nexaWhatsAppSupportUrl'));
assert(src.includes('NEXA_TELEGRAM_SUPPORT_URL'));
console.log('Central-only cumulative release PASS against actual EAS production git SHA '+baseline);
console.log('Changed files: '+changed.join(', '));
