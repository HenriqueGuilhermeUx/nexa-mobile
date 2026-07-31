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
assert.equal(appConfig.expo.version, '2.0.6');
assert.equal(packageJson.version, '2.0.6');
assert.equal(appConfig.expo.android.versionCode, 37);
assert.equal(appConfig.expo.ios.buildNumber, '37');
assert.equal(
  appConfig.expo.extra.eas.projectId,
  'b3faabec-283a-4ba2-88b5-f096304e68aa',
);
assert.equal(appConfig.expo.extra.financialExecutionEnabled, false);
assert.equal(appConfig.expo.extra.ledgerOperationsEnabled, true);
assert.equal(appConfig.expo.extra.balanceSource, 'ledger');
assert.equal(appConfig.expo.extra.privyOptional, true);
assert.equal(appConfig.expo.extra.releaseChannel, 'production');
assert.match(appConfig.expo.extra.apiUrl, /^https:\/\//);

const splashPlugin = appConfig.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);
assert.ok(splashPlugin, 'Plugin expo-splash-screen ausente.');
const splashImage = splashPlugin[1]?.image;
assert.ok(splashImage, 'Imagem do splash não configurada.');
assert.ok(
  fs.existsSync(splashImage.replace(/^\.\//, '')),
  `Imagem do splash ausente: ${splashImage}`,
);

assert.equal(packageJson.main, 'entrypoint.js');
assert.equal(packageJson.dependencies['react-native-svg'], '15.15.4');
assert.ok(packageJson.dependencies['@privy-io/expo']);
assert.ok(packageJson.dependencies['expo-secure-store']);
assert.match(entrypoint, /fast-text-encoding/);
assert.match(entrypoint, /react-native-get-random-values/);
assert.match(entrypoint, /@ethersproject\/shims/);
assert.match(metro, /moduleName === 'jose'/);

assert.match(session, /expo-secure-store/);
assert.match(session, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
assert.doesNotMatch(session, /AsyncStorage/);

assert.match(config, /appVersion/);
assert.match(config, /appBuild/);
assert.match(config, /2\.0\.6/);
assert.match(config, /37/);
assert.match(config, /ledgerOperationsEnabled/);
assert.match(config, /balanceSource/);
assert.match(config, /privyOptional/);
assert.doesNotMatch(config, /Configuração pública da Privy ausente/);
assert.match(api, /X-Nexa-App-Version/);
assert.match(api, /X-Nexa-App-Build/);
assert.match(api, /X-Nexa-Platform/);
assert.match(api, /Authorization/);
assert.match(api, /register\(data: RegistrationData\)/);

// A experiência aprovada permanece simples: Entrar, Criar conta e o app completo.
assert.match(welcome, /Cripto sem complicação/);
assert.match(welcome, /label="Entrar"/);
assert.match(welcome, /label="Criar conta"/);
assert.match(welcome, /router\.replace\('\/legacy'/);
assert.doesNotMatch(welcome, /Primeiros Nexa|convite|ABERTURA GRADUAL/i);
assert.doesNotMatch(welcome, /usePrivy|directProfile|onboarding-wallet/);
assert.doesNotMatch(rootLayout, /primeiros-nexa/);
assert.ok(!fs.existsSync('app/primeiros-nexa.tsx'));

assert.match(signIn, /nexaApi\.login/);
assert.match(signIn, /saveNexaSession/);
assert.match(signIn, /router\.replace\('\/legacy'/);
assert.doesNotMatch(
  signIn,
  /usePrivy|useLoginWithEmail|sendCode|loginWithCode|directProfile|onboarding-wallet/,
);

assert.match(signUp, /nexaApi\.register/);
assert.match(signUp, /saveNexaSession/);
assert.match(signUp, /router\.replace\('\/legacy'/);
assert.match(signUp, /KYC/);
assert.doesNotMatch(
  signUp,
  /usePrivy|useLoginWithEmail|sendCode|loginWithCode|onboarding-wallet/,
);
assert.doesNotMatch(appLayout, /AuthBoundary|usePrivy|Privy/);

assert.match(legacyBridge, /LegacyApp/);
assert.match(legacyBridge, /nexa_token/);
assert.match(legacyBridge, /nexa_user/);
assert.match(legacyBridge, /nexaApi\.me/);
assert.match(legacyBridge, /installLegacyFinancialFetchBridge/);
assert.match(legacyBridge, /session\.accessToken/);

// O código visual legado não é redesenhado; a rota antiga é trocada no bundle.
assert.match(legacyPixApp, /\/withdrawal\/pix-request/);
assert.match(babelConfig, /babel-replace-legacy-pix-route/);
assert.match(pixRouteTransform, /\/withdrawal\/pix-request/);
assert.match(pixRouteTransform, /\/payment\/pix\/redemption/);

// Saque e transferência ganham autenticação sem mudar componentes ou menus.
assert.match(financialBridge, /\/payment\/pix\/redemption/);
assert.match(financialBridge, /\/internal-transfer\/send-by-username/);
assert.match(financialBridge, /Authorization/);
assert.match(financialBridge, /Bearer \$\{accessToken\}/);
assert.match(financialBridge, /X-Nexa-App-Version/);
assert.match(financialBridge, /X-Nexa-App-Build/);
assert.match(financialBridge, /X-Nexa-Platform/);
assert.match(financialBridge, /paymentId/);
assert.match(financialBridge, /estimatedPayoutBrl/);
assert.match(financialBridge, /processingDeadlineHours:\s*24/);
assert.match(financialBridge, /toUsername/);
assert.match(financialBridge, /clientRequestId/);
assert.doesNotMatch(financialBridge, /fromUserId:\s*legacyBody\.fromUserId/);
assert.doesNotMatch(financialBridge, /userId:\s*legacyBody\.userId/);

assert.match(artifactValidator, /\/withdrawal\/pix-request/);
assert.match(artifactValidator, /Primeiros Nexa/);
assert.match(artifactValidator, /Já recebi meu convite/);
assert.match(artifactValidator, /direct_settlement/);
assert.match(artifactValidator, /\/payment\/pix\/redemption/);

// Privy permanece disponível apenas como recurso voluntário.
assert.match(onboarding, /Criar carteira e continuar/);
assert.doesNotMatch(onboarding, /Proteções desta etapa|custódia pendente/i);

assert.match(legacyPixApp, /function formatInputAmount\(value\)/);
assert.match(
  legacyPixApp,
  /setValorUsdc\(formatInputAmount\(saldo\.USDC\)\)/,
);
assert.match(legacyPixApp, /lastIndexOf\(','\)/);
assert.match(legacyPixApp, /lastIndexOf\('\.'\)/);
assert.match(legacyPixApp, /Dep[oó]sito|deposit/i);
assert.match(legacyPixApp, /Transfer/);
assert.match(legacyPixApp, /Sacar Pix|saque Pix/i);

const codeFiles = [...walk('app'), ...walk('src')].filter((file) =>
  /\.(ts|tsx|js)$/.test(file),
);
const configurationFiles = ['app.json', 'package.json', 'eas.json'];
const codeAndConfig = [...codeFiles, ...configurationFiles].map(read).join('\n');
assert.doesNotMatch(
  codeAndConfig,
  /PRIVY_APP_SECRET\s*[:=]|PRIVY_SECRET_KEY\s*[:=]|MASTER_WALLET_PRIVATE_KEY\s*[:=]|BEGIN PRIVATE KEY/,
);
assert.doesNotMatch(codeAndConfig, /seed phrase|mnemonic phrase/i);

console.log(
  'Nexa mobile 2.0.6 v37 validated: approved visuals preserved, official authenticated Pix route, authenticated transfers, mandatory build headers, KYC, ledger and optional Privy.',
);
