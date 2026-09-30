const assert = require('node:assert/strict');
const fs = require('node:fs');

const realReadFileSync = fs.readFileSync.bind(fs);
const readReal = (file) => realReadFileSync(file, 'utf8');

const app = JSON.parse(readReal('app.json'));
const config = readReal('src/config.ts');
const buy = readReal('app/(app)/buy-crypto.tsx');
const recovery = readReal('app/wallet-recovery.tsx');
const handoff = readReal('src/lib/privyPurchaseAuthorization.ts');

assert.equal(app.expo.version, '2.0.23');
assert.equal(app.expo.android.versionCode, 124);
assert.equal(app.expo.ios.buildNumber, '124');
assert.equal(app.expo.runtimeVersion?.policy, 'appVersion');
assert.equal(
  app.expo.extra?.releaseBuild,
  'android16-api36-2.0.23-v124-wallet-first-auth-fix',
);
assert.match(config, /android.*versionCode\s*\|\|\s*'124'/s);

assert.match(buy, /useIdentityToken/);
assert.match(buy, /getIdentityToken/);
assert.match(buy, /consumePurchaseIdentityToken/);
assert.doesNotMatch(buy, /getAccessToken/);
assert.match(recovery, /useIdentityToken/);
assert.match(recovery, /waitForIdentityToken/);
assert.match(recovery, /stashPurchaseIdentityToken/);
assert.match(recovery, /if \(!returnToPurchase && typeof privy\?\.logout === 'function'/);
assert.match(handoff, /pendingIdentityToken/);
assert.doesNotMatch(handoff, /SecureStore|AsyncStorage|FileSystem/);

fs.readFileSync = function patchedReadFileSync(file, options) {
  const text = realReadFileSync(file, options);
  if (typeof text !== 'string') return text;
  const normalized = String(file).replace(/\\/g, '/');
  if (normalized.endsWith('/app.json') || normalized === 'app.json') {
    const previous = JSON.parse(text);
    previous.expo.android.versionCode = 123;
    previous.expo.ios.buildNumber = '123';
    previous.expo.extra.releaseBuild = 'android16-api36-2.0.23-v123-wallet-first-ota-funding';
    return JSON.stringify(previous);
  }
  if (normalized.endsWith('/src/config.ts') || normalized === 'src/config.ts') {
    return text.replace("versionCode || '124'", "versionCode || '123'");
  }
  return text;
};

try {
  require('./validate-mobile-safety-v123.js');
} finally {
  fs.readFileSync = realReadFileSync;
}

console.log(
  'Nexa v124 safety validated: v123 invariants preserved + embedded Privy authorization loop fix with ephemeral in-memory identity handoff.',
);
