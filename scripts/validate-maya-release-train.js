const fs = require('fs');
const assert = require('assert');
const { execFileSync } = require('child_process');
const app = JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const eas = JSON.parse(fs.readFileSync('eas.json','utf8'));
assert.strictEqual(app.version,'2.0.43');
assert.strictEqual(app.android.versionCode,148);
assert.strictEqual(app.android.package,'br.com.trynexa.app');
assert.strictEqual(app.runtimeVersion.policy,'appVersion');
assert.strictEqual(pkg.version,'2.0.43');
assert.strictEqual(eas.build.production.channel,'production');
assert(fs.readFileSync('app/index.tsx','utf8').includes('sem precisar depositar agora'),'Activation copy lost');
assert(fs.readFileSync('app/assistant.tsx','utf8').includes('Sua assistente inteligente'),'Maya identity lost');
assert(fs.readFileSync('app/assistant.tsx','utf8').includes("router.push('/maya-actions'"),'Maya actions entry lost');
const base = 'origin/feat/aave-v148-internal-apk-20261102';
const output = execFileSync('git',['diff','--name-only',base+'...HEAD'],{encoding:'utf8'});
const allowed = [
  /^app\/index\.tsx$/, /^app\/kyc\.tsx$/, /^app\/assistant\.tsx$/, /^app\/_layout\.tsx$/,
  /^app\/maya-actions(?:-[a-z0-9-]+)?\.tsx$/, /^app\/maya-planning\.tsx$/, /^components\/maya-actions\//,
  /^lib\/maya-actions\//, /^src\/maya-actions\//, /^src\/lib\/mayaWebActionContracts\.ts$/,
  /^scripts\/validate-maya-[a-z0-9-]+\.js$/, /^docs\/maya-actions-[a-z0-9-]+\.md$/,
  /^\.github\/workflows\/maya-actions-[a-z0-9-]+\.yml$/, /^package(?:-lock)?\.json$/,
];
const changed = output.trim().split('\n').filter(Boolean);
const unexpected = changed.filter(f => !allowed.some(re => re.test(f)));
assert.deepStrictEqual(unexpected, [], 'Unapproved file changes from proven Android v148 OTA baseline: '+unexpected.join(', '));
console.log('PASS: Android 2.0.43 v148 runtime, onboarding, Maya and guarded cumulative changes ('+changed.length+' files)');
