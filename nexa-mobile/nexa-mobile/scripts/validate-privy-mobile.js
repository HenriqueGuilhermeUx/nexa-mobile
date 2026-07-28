const fs = require('node:fs');
const assert = require('node:assert/strict');

const root = fs.readFileSync('PrivyMobileRoot.js', 'utf8');
const index = fs.readFileSync('index.js', 'utf8');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));

assert.match(root, /direct-settlement\/wallet\/link/);
assert.match(root, /x-privy-access-token/);
assert.doesNotMatch(root, /privyUserId\s*:/);
assert.match(root, /getAccessToken\(\)/);
assert.match(root, /createOnLogin:\s*'users-without-wallets'/);
assert.match(index, /fast-text-encoding/);
assert.match(index, /react-native-get-random-values/);
assert.match(index, /@ethersproject\/shims/);
assert.equal(app.expo.extra.privyAppId, 'cmpen2gm3007v0cjswjlyefji');
assert.equal(
  app.expo.extra.privyClientId,
  'client-WY6ZY2Ptr39FTjXumMRAfqM2Bx8m9DUWxcU1kwXxJGPh3',
);
assert.equal(app.expo.android.package, 'br.com.trynexa.app');
assert.equal(app.expo.scheme, 'nexa');
console.log('Secure Privy mobile contract validated.');
