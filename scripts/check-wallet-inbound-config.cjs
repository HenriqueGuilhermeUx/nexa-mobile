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
const lab = eas.build['wallet-inbound-lab'];
assert.ok(lab, 'missing isolated EAS lab profile');
assert.equal(lab.developmentClient, true);
assert.equal(lab.distribution, 'internal');
assert.equal(lab.channel, 'wallet-inbound-lab');
assert.equal(lab.android.buildType, 'apk');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID, '0d9b915b32c04b058efeba535319dd70');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_API_URL, 'https://nexa-backend-wallet-v15-staging.onrender.com/api/v1');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED, 'false');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_REOWN_ENABLED, 'false');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_REOWN_LICENSE_REVIEWED, 'false');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_REOWN_NATIVE_VERIFIED, 'false');
assert.equal(lab.env.EXPO_PUBLIC_NEXA_REOWN_NATIVE_QA_MODE, 'false');
for(const [name, profile] of Object.entries(eas.build)) {
  if(name !== 'wallet-inbound-lab' && profile.env?.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID) {
    throw new Error('Reown project ID leaked into a non-lab EAS profile: ' + name);
  }
}

for(const profile of Object.values(eas.build)) {
 if(profile.env?.EXPO_PUBLIC_NEXA_REOWN_ENABLED === 'true') {
   throw new Error('Reown enabled in a build profile before native/license validation');
 }
}
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_ENABLED === 'true'/);
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_LICENSE_REVIEWED === 'true'/);
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_NATIVE_VERIFIED === 'true'/);
assert.match(route, /EXPO_PUBLIC_NEXA_REOWN_NATIVE_QA_MODE === 'true'/);
assert.match(route, /projectId: process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID/);
assert.doesNotMatch(route,/\\n\s*\/\//, 'literal newline escape in route source');

// Behavioral regression: eth_accounts may contain several authorized addresses,
// but the selected account is the FIRST entry. Reject stale selected accounts.
const ts = require('typescript');
const source = fs.readFileSync(path.join(root, 'src/lib/activeExternalWalletAccount.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const testModule = { exports: {} };
new Function('module', 'exports', js)(testModule, testModule.exports);
const { isActiveExternalWalletAccount } = testModule.exports;
const selected = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
assert.equal(isActiveExternalWalletAccount([selected], selected), true);
assert.equal(isActiveExternalWalletAccount([selected.toUpperCase().replace('0X','0x')], selected), true);
assert.equal(isActiveExternalWalletAccount([other, selected], selected), false, 'stale selected account must be rejected');
assert.equal(isActiveExternalWalletAccount([selected, other], selected), true);
assert.equal(isActiveExternalWalletAccount([], selected), false);
assert.equal(isActiveExternalWalletAccount([null, selected], selected), false);
assert.equal(isActiveExternalWalletAccount([selected], 'invalid'), false);
for (const name of ['externalWalletProviderProof.ts','reownConnectedWalletBridge.ts','externalWalletConnectionState.ts']) {
  const consumer = fs.readFileSync(path.join(root, 'src/lib', name), 'utf8');
  assert.match(consumer, /isActiveExternalWalletAccount\(/, name + ' must verify selected account');
  assert.doesNotMatch(consumer, /\.some\(.*[Aa]ccount/, name + ' must not accept an arbitrary authorized account');
}
console.log('PASS: selected EIP-1193 account regression tests');

console.log('PASS: Reown staging gates, isolated lab profile and Android/iOS app IDs');
