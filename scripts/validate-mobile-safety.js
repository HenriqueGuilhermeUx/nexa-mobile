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
const config = read('src/config.ts');
const api = read('src/lib/api.ts');
const session = read('src/lib/session.ts');
const welcome = read('app/index.tsx');
const signIn = read('app/sign-in.tsx');
const signUp = read('app/sign-up.tsx');
const rootLayout = read('app/_layout.tsx');
const appLayout = read('app/(app)/_layout.tsx');
const onboarding = read('app/onboarding-wallet.tsx');
const legacyBridge = read('app/legacy.js');
const financialBridge = read('src/lib/legacy-financial-fetch-bridge.js');
const legacyPixApp = read('nexa-mobile/nexa-mobile/App.js');
const babelConfig = read('babel.config.js');
const pixRouteTransform = read('scripts/babel-replace-legacy-pix-route.js');
const artifactValidator = read('scripts/validate-built-artifact.js');
const entrypoint = read('entrypoint.js');
const metro = read('metro.config.js');

assert.equal(appConfig.expo.android.package, 'br.com.trynexa.app');
assert.equal(appConfig.expo.ios.bundleIdentifier, 'br.com.trynexa.app');
assert.equal(appConfig.expo.scheme, 'nexa');
assert.equal(appConfig.expo.version, '2.0.8');
assert.equal(packageJson.version, '2.0.8');
assert.equal(appConfig.expo.android.versionCode, 101);
assert.equal(appConfig.expo.ios.buildNumber, '101');
assert.equal(appConfig.expo.extra.androidTargetApi, 36);
assert.equal(appConfig.expo.extra.financialExecutionEnabled, false);
assert.equal(appConfig.expo.extra.ledgerOperationsEnabled, true);
assert.equal(appConfig.expo.extra.balanceSource, 'ledger');
assert.equal(appConfig.expo.extra.privyOptional, true);
assert.equal(appConfig.expo.extra.releaseChannel, 'production');
assert.match(appConfig.expo.extra.apiUrl, /^https:\/\//);

assert.equal(packageJson.main, 'entrypoint.js');
assert.equal(packageJson.dependencies['react-native-svg'], '15.15.4');
assert.ok(packageJson.dependencies['@privy-io/expo']);
assert.ok(packageJson.dependencies['expo-secure-store']);
assert.match(packageJson.dependencies.expo, /^~57\./);
assert.equal(packageJson.dependencies['react-native'], '0.86.2');
assert.match(entrypoint, /fast-text-encoding/);
assert.match(entrypoint, /react-native-get-random-values/);
assert.match(entrypoint, /@ethersproject\/shims/);
assert.match(metro, /moduleName === 'jose'/);

assert.match(session, /expo-secure-store/);
assert.match(session, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
assert.doesNotMatch(session, /AsyncStorage/);

assert.match(config, /appVersion/);
assert.match(config, /appBuild/);
assert.match(config, /2\.0\.8/);
assert.match(config, /101/);
assert.match(config, /androidTargetApi/);
assert.match(config, /36/);
assert.match(api, /X-Nexa-App-Version/);
assert.match(api, /X-Nexa-App-Build/);
assert.match(api, /X-Nexa-Platform/);
assert.match(api, /Authorization/);

assert.match(welcome, /Cripto sem complicação/);
assert.match(welcome, /label="Entrar"/);
assert.match(welcome, /label="Criar conta"/);
assert.match(welcome, /router\.replace\('\/legacy'/);
assert.doesNotMatch(welcome, /Primeiros Nexa|convite|ABERTURA GRADUAL/i);
assert.doesNotMatch(rootLayout, /primeiros-nexa/);
assert.ok(!fs.existsSync('app/primeiros-nexa.tsx'));

assert.match(signIn, /nexaApi\.login/);
assert.match(signIn, /saveNexaSession/);
assert.doesNotMatch(signIn, /useLoginWithEmail|sendCode|loginWithCode|onboarding-wallet/);
assert.match(signUp, /nexaApi\.register/);
assert.match(signUp, /saveNexaSession/);
assert.match(signUp, /KYC/);
assert.doesNotMatch(signUp, /useLoginWithEmail|sendCode|loginWithCode|onboarding-wallet/);
assert.doesNotMatch(appLayout, /AuthBoundary|usePrivy|Privy/);

assert.match(legacyBridge, /LegacyApp/);
assert.match(legacyBridge, /installLegacyFinancialFetchBridge/);
assert.match(legacyBridge, /session\.accessToken/);

assert.match(legacyPixApp, /\/withdrawal\/pix-request/);
assert.match(babelConfig, /babel-replace-legacy-pix-route/);
assert.match(pixRouteTransform, /\/withdrawal\/pix-request/);
assert.match(pixRouteTransform, /\/payment\/pix\/redemption/);

assert.match(financialBridge, /\/payment\/pix\/redemption/);
assert.match(financialBridge, /\/internal-transfer\/send-by-username/);
assert.match(financialBridge, /Authorization/);
assert.match(financialBridge, /X-Nexa-App-Version/);
assert.match(financialBridge, /X-Nexa-App-Build/);
assert.match(financialBridge, /X-Nexa-Platform/);
assert.match(financialBridge, /2\.0\.8/);
assert.match(financialBridge, /101/);
assert.doesNotMatch(financialBridge, /fromUserId:\s*legacyBody\.fromUserId/);
assert.doesNotMatch(financialBridge, /userId:\s*legacyBody\.userId/);

for (const forbidden of [
  'Primeiros Nexa',
  'Já recebi meu convite',
  'Recebi meu convite',
  'direct_settlement',
]) {
  assert.match(artifactValidator, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(artifactValidator, /\/withdrawal\/pix-request/);
assert.match(artifactValidator, /\/payment\/pix\/redemption/);

assert.match(onboarding, /Criar carteira e continuar/);
assert.doesNotMatch(onboarding, /Proteções desta etapa|custódia pendente/i);
assert.match(legacyPixApp, /function formatInputAmount\(value\)/);
assert.match(legacyPixApp, /Dep[oó]sito|deposit/i);
assert.match(legacyPixApp, /Transfer/);
assert.match(legacyPixApp, /Sacar Pix|saque Pix/i);

const codeFiles = [...walk('app'), ...walk('src')].filter((file) =>
  /\.(ts|tsx|js)$/.test(file),
);
const codeAndConfig = [...codeFiles, 'app.json', 'package.json', 'eas.json']
  .map(read)
  .join('\n');
assert.doesNotMatch(
  codeAndConfig,
  /PRIVY_APP_SECRET\s*[:=]|PRIVY_SECRET_KEY\s*[:=]|MASTER_WALLET_PRIVATE_KEY\s*[:=]|BEGIN PRIVATE KEY/,
);
assert.doesNotMatch(codeAndConfig, /seed phrase|mnemonic phrase/i);

console.log(
  'Nexa mobile 2.0.8 v101 validated: Expo SDK 57, React Native 0.86.2 with fixed Hermes, Android API 36 release metadata, official Pix, authenticated transfers, mandatory build headers, KYC, ledger and optional Privy.',
);
