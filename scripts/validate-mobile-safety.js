const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  assert.ok(fs.existsSync(file), `Arquivo obrigatório ausente: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const appConfig = JSON.parse(read('app.json'));
const packageJson = JSON.parse(read('package.json'));
const api = read('src/lib/api.ts');
const session = read('src/lib/session.ts');
const onboarding = read('app/onboarding-wallet.tsx');
const home = read('app/(app)/index.tsx');
const newOrder = read('app/(app)/new-order.tsx');
const entrypoint = read('entrypoint.js');
const metro = read('metro.config.js');
const readme = read('README.md');

assert.equal(appConfig.expo.android.package, 'br.com.trynexa.app');
assert.equal(appConfig.expo.ios.bundleIdentifier, 'br.com.trynexa.app');
assert.equal(appConfig.expo.scheme, 'nexa');
assert.ok(appConfig.expo.android.versionCode > 25);
assert.equal(appConfig.expo.extra.financialExecutionEnabled, false);
assert.match(appConfig.expo.extra.apiUrl, /^https:\/\//);
assert.match(appConfig.expo.extra.privyAppId, /^cmp/);
assert.match(appConfig.expo.extra.privyClientId, /^client-/);

assert.equal(packageJson.main, 'entrypoint.js');
assert.ok(packageJson.dependencies['@privy-io/expo']);
assert.ok(packageJson.dependencies['expo-secure-store']);
assert.ok(packageJson.dependencies['react-native-get-random-values']);

assert.match(entrypoint, /fast-text-encoding/);
assert.match(entrypoint, /react-native-get-random-values/);
assert.match(entrypoint, /@ethersproject\/shims/);
assert.match(metro, /moduleName === 'jose'/);

assert.match(session, /expo-secure-store/);
assert.match(session, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
assert.doesNotMatch(session, /AsyncStorage/);

assert.match(api, /Authorization/);
assert.match(api, /x-privy-access-token/);
assert.match(api, /privyWalletId: string; walletAddress: string/);
assert.doesNotMatch(api, /linkWallet[\s\S]{0,800}privyUserId/);
assert.match(api, /\/direct-settlement\/wallet\/audit/);
assert.match(api, /\/direct-settlement\/orders\/entry/);
assert.match(api, /\/direct-settlement\/orders\/exit/);

assert.match(onboarding, /wallets\.find/);
assert.doesNotMatch(onboarding, /wallets\[0\]/);
assert.match(onboarding, /getAccessToken/);
assert.match(onboarding, /auditWallet/);
assert.match(onboarding, /includes\('legacy'\)/);
assert.doesNotMatch(onboarding, /console\.log.*Token/i);

assert.match(home, /Aguardando sincronização/);
assert.doesNotMatch(home, /Mock|mock balance|842\.30/i);
assert.match(newOrder, /Nenhum dinheiro foi movimentado/);
assert.match(newOrder, /fundsMoved/);
assert.match(readme, /usuários Beta\/Legacy não são migrados automaticamente/i);

const sourceFiles = [
  ...walk('app'),
  ...walk('src'),
  'app.json',
  'README.md',
].filter((file) => /\.(ts|tsx|js|json|md)$/.test(file));
const combined = sourceFiles.map(read).join('\n');
assert.doesNotMatch(
  combined,
  /PRIVY_APP_SECRET\s*[:=]|PRIVY_SECRET_KEY\s*[:=]|MASTER_WALLET_PRIVATE_KEY\s*[:=]|BEGIN PRIVATE KEY/,
);
assert.doesNotMatch(combined, /seed phrase|mnemonic phrase/i);

console.log(
  'Nexa mobile validated: secure session, dual-token wallet binding, no mock balances and financial safe mode passed.',
);
