// Maya Android 2.0.43 v148 — static guard for cumulative OTA production safety.
// This does not publish an OTA, prove a channel's EAS mapping or replace QA on device.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
const promotion = fs.readFileSync('.github/workflows/maya-actions-v148-ota-promotion.yml', 'utf8');
const plan = fs.readFileSync('docs/maya-actions-ota-rollout-lotes.md', 'utf8');
assert.equal(app.version, '2.0.43');
assert.equal(app.android.versionCode, 148);
assert.equal(app.android.package, 'br.com.trynexa.app');
assert.equal(app.runtimeVersion.policy, 'appVersion');
assert.equal(eas.build.production.channel, 'production');
assert.equal(eas.build.production.android.buildType, 'app-bundle');
assert(promotion.includes('workflow_dispatch:'), 'Promotion must remain manual');
assert(promotion.includes('RELEASE-MAYA-ANDROID-V148'), 'Required human confirmation missing');
assert(promotion.includes('integration/maya-actions-v148'), 'Frozen cumulative branch missing');
assert(promotion.includes('test "$(git rev-parse HEAD)" = "$RELEASE_SHA"'), 'Exact SHA guard missing');
assert(promotion.includes('concurrency:'), 'OTA publication must be serialized');
assert(promotion.includes('eas update --channel production --platform android'), 'Unexpected production target');
assert(!/^\s+push:\s*$/m.test(promotion), 'Production OTA must not publish on push');
assert(plan.includes('APK QA é outro pacote'), 'QA identity separation must be documented');
assert(plan.includes('update group'), 'OTA evidence requirements missing');
console.log('PASS Maya OTA rollout: Android identity 2.0.43/148, manual cumulative promotion and QA/production separation');
