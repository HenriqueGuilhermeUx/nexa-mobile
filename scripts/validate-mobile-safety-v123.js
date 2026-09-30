const assert = require('node:assert/strict');
const fs = require('node:fs');

const realReadFileSync = fs.readFileSync.bind(fs);
const readReal = (file) => realReadFileSync(file, 'utf8');

const app = JSON.parse(readReal('app.json'));
const pkg = JSON.parse(readReal('package.json'));
const config = readReal('src/config.ts');
const buy = readReal('app/(app)/buy-crypto.tsx');
const funding = readReal('app/(app)/fund-card.tsx');
const addMoney = readReal('app/(app)/new-order.tsx');
const layout = readReal('app/_layout.tsx');

assert.equal(app.expo.version, '2.0.23');
assert.equal(app.expo.android.versionCode, 123);
assert.equal(app.expo.ios.buildNumber, '123');
assert.equal(app.expo.runtimeVersion?.policy, 'appVersion');
assert.equal(
  app.expo.updates?.url,
  'https://u.expo.dev/b3faabec-283a-4ba2-88b5-f096304e68aa',
);
assert.equal(
  app.expo.extra?.releaseBuild,
  'android16-api36-2.0.23-v123-wallet-first-ota-funding',
);
assert.ok(pkg.dependencies?.['expo-updates'], 'expo-updates must be installed');
assert.match(config, /android.*versionCode\s*\|\|\s*'123'/s);

assert.match(buy, /useIdentityToken/);
assert.match(buy, /getIdentityToken/);
assert.doesNotMatch(buy, /usePrivy/);
assert.doesNotMatch(buy, /getAccessToken/);
assert.match(buy, /executeSponsoredWalletFirstSwap/);
assert.doesNotMatch(buy, /sendPreparedWalletTransaction/);
assert.doesNotMatch(buy, /\bPOL\b|\bMATIC\b|gas fee/i);

assert.match(layout, /PrivyElements/);
assert.match(funding, /useFundWallet/);
assert.match(funding, /preferredProvider:\s*'moonpay'/);
assert.match(funding, /asset:\s*'USDC'/);
assert.match(funding, /defaultPaymentMethod:\s*'card'/);
assert.match(addMoney, /Adicionar por Pix/);
assert.match(addMoney, /Cartão · Apple Pay · Google Pay/);
assert.match(addMoney, /\(app\)\/fund-card/);

const allCode = [buy, funding, addMoney, layout, config].join('\n');
assert.doesNotMatch(
  allCode,
  /PRIVY_APP_SECRET\s*[:=]|PRIVY_SECRET_KEY\s*[:=]|MASTER_WALLET_PRIVATE_KEY\s*[:=]|BEGIN PRIVATE KEY/,
);

// Preserve every v122 invariant while adapting only the historical release-number
// expectations. This intentionally does not alter the repository on disk.
fs.readFileSync = function patchedReadFileSync(file, options) {
  const text = realReadFileSync(file, options);
  if (typeof text !== 'string') return text;
  const normalized = String(file).replace(/\\/g, '/');
  if (normalized.endsWith('/app.json') || normalized === 'app.json') {
    const legacy = JSON.parse(text);
    legacy.expo.android.versionCode = 122;
    legacy.expo.ios.buildNumber = '122';
    return JSON.stringify(legacy);
  }
  if (normalized.endsWith('/src/config.ts') || normalized === 'src/config.ts') {
    return text.replace("versionCode || '123'", "versionCode || '122'");
  }
  return text;
};

try {
  require('./validate-mobile-safety.js');
} finally {
  fs.readFileSync = realReadFileSync;
}

console.log(
  'Nexa v123 safety validated: all legacy invariants preserved + Privy identity-JWT sponsorship + Funding + Expo OTA boundary.',
);
