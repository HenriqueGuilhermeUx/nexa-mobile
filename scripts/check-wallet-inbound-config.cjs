/**
 * Read-only preflight for WalletConnect/USDC staging. Does not request build,
 * modify Expo credentials or touch financial APIs.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const app = load('app.json').expo;
const eas = load('eas.json');
const pkg = load('package.json');
const route = fs.readFileSync(path.join(root, 'app/(app)/external-wallet-connect.tsx'),'utf8');
assert.equal(app.scheme, 'nexa');
assert.equal(app.ios.bundleIdentifier, 'br.com.trynexa.app', 'iOS bundle id changed');
assert.equal(app.android.package, 'br.com.trynexa.app', 'Android package id changed');
assert.equal(pkg.dependencies['@reown/appkit-react-native'], '2.0.6');
assert.equal(pkg.dependencies['@reown/appkit-ethers-react-native'], '2.0.6');
assert.equal(eas.build.production.env.EXPO_PUBLIC_NEXA_RELEASE_CHANNEL, 'production');
for(const profile of Object.values(eas.build)) {
 if(profile.env?.EXPO_PUBLIC_NEXA_REOWN_ENABLED === 'true') {
   throw new Error('Reown enabled in a build profile before native/license validation');
 }
}
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_ENABLED === 'true'/);
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_LICENSE_REVIEWED === 'true'/);
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_NATIVE_VERIFIED === 'true'/);
assert.match(route, /0d9b915b32c04b058efeba535319dd70/);
assert.doesNotMatch(route,/\\n\s*\/\//, 'literal newline escape in route source');
console.log('PASS: Reown staging guards and registered Expo iOS/Android identifiers');
