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
const home = read('app/(app)/index.tsx');
const newOrder = read('app/(app)/new-order.tsx');
const activity = read('app/(app)/activity.tsx');
const legacyPixApp = read('nexa-mobile/nexa-mobile/App.js');
const entrypoint = read('entrypoint.js');
const metro = read('metro.config.js');
const readme = read('README.md');

assert.equal(appConfig.expo.android.package, 'br.com.trynexa.app');
assert.equal(appConfig.expo.ios.bundleIdentifier, 'br.com.trynexa.app');
assert.equal(appConfig.expo.scheme, 'nexa');
assert.equal(appConfig.expo.version, '2.0.3');
assert.equal(packageJson.version, '2.0.3');
assert.equal(appConfig.expo.android.versionCode, 33);
assert.equal(appConfig.expo.ios.buildNumber, '33');
assert.equal(
  appConfig.expo.extra.eas.projectId,
  'b3faabec-283a-4ba2-88b5-f096304e68aa',
);
assert.equal(appConfig.expo.extra.financialExecutionEnabled, false);
assert.equal(appConfig.expo.extra.releaseChannel, 'production');
assert.match(appConfig.expo.extra.apiUrl, /^https:\/\//);
assert.equal(appConfig.expo.extra.privyAppId, 'cmpen2gm3007v0cjswjlyefji');
assert.equal(
  appConfig.expo.extra.privyClientId,
  'client-WY6ZY2Ptr39FTjXumMRAfqM2Bx8m9DUWxcU1kwXxJGPh3',
);
assert.notEqual(
  appConfig.expo.extra.privyClientId,
  'client-WY6ZY2Ptr39FTjXumMRAfqM2Bx8m9DUWxcSgXg6CWaMyT',
  'O app móvel não pode usar o Client ID Web.',
);

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

assert.match(config, /appVersion/);
assert.match(api, /X-Nexa-App-Version/);
assert.match(api, /X-Nexa-Platform/);
assert.match(api, /Authorization/);
assert.match(api, /x-privy-access-token/);
assert.match(api, /register\(data: RegistrationData\)/);
assert.match(api, /privyWalletId: string; walletAddress: string/);
assert.doesNotMatch(api, /linkWallet[\s\S]{0,800}privyUserId/);
assert.match(api, /\/direct-settlement\/wallet\/audit/);
assert.match(api, /\/direct-settlement\/orders\/entry/);
assert.match(api, /\/direct-settlement\/orders\/exit/);
assert.match(api, /\/payment\/user/);
assert.match(api, /\/payment\/status\//);
assert.match(api, /\/payment\/pix\/redemption/);
assert.match(api, /amountUsdc: number; pixKey: string/);
assert.match(api, /saleProceedsBrl/);
assert.match(api, /settledAmountBrl/);
assert.match(api, /nexaFeeBrl/);
assert.match(api, /pixOutFeeBrl/);
assert.doesNotMatch(api, /requestPixRedemption[\s\S]{0,300}amountBrl/);

assert.match(welcome, /Cripto sem complicação/);
assert.match(welcome, /label="Entrar"/);
assert.match(welcome, /label="Criar conta"/);
assert.doesNotMatch(welcome, /Primeiros Nexa|convite|ABERTURA GRADUAL/i);
assert.doesNotMatch(rootLayout, /primeiros-nexa/);
assert.ok(!fs.existsSync('app/primeiros-nexa.tsx'));

assert.match(signIn, /directProfile/);
assert.match(signIn, /isLegacyProfile/);
assert.match(signIn, /router\.replace\('\/\(app\)'\)/);
assert.match(signIn, /profile\?\.wallet\?\.linked === true/);
assert.match(signIn, /sendCode/);
assert.ok(
  signIn.indexOf('isLegacyProfile(profile)') < signIn.indexOf('await sendCode'),
  'Conta legacy deve ser liberada antes de qualquer exigência Privy.',
);
assert.doesNotMatch(appLayout, /AuthBoundary|usePrivy|Privy/);

assert.match(signUp, /sendCode/);
assert.match(signUp, /loginWithCode/);
assert.match(signUp, /nexaApi\.register/);
assert.ok(
  signUp.indexOf('await loginWithCode') < signUp.indexOf('await nexaApi.register'),
  'O e-mail deve ser confirmado antes de criar o usuário Nexa.',
);

assert.match(onboarding, /wallets\.find/);
assert.doesNotMatch(onboarding, /wallets\[0\]/);
assert.match(onboarding, /isLegacyProfile/);
assert.match(onboarding, /Criar carteira e continuar/);
assert.match(onboarding, /linkWhenReady/);
assert.match(onboarding, /auditWallet/);
assert.match(onboarding, /\.catch\(\(\) => undefined\)/);
assert.match(onboarding, /router\.replace\('\/\(app\)'\)/);
assert.doesNotMatch(onboarding, /Proteções desta etapa|custódia pendente|auditoria complementar ficou pendente/i);
assert.doesNotMatch(onboarding, /console\.log.*Token/i);

assert.match(home, /Aguardando leitura on-chain/);
assert.match(home, /availableBalanceUsdc/);
assert.match(home, /Resgatar USDC/);
assert.match(home, /Conta existente preservada sem migração automática/);
assert.match(home, /listPixRedemptions/);
assert.doesNotMatch(home, /Mock|mock balance|842\.30/i);

assert.match(newOrder, /requestPixRedemption/);
assert.match(newOrder, /amountUsdc: parsed/);
assert.match(newOrder, /pixKey: pixKey\.trim\(\)/);
assert.match(newOrder, /lastIndexOf\(','\)/);
assert.match(newOrder, /lastIndexOf\('\.'\)/);
assert.match(newOrder, /ESTIMATIVA — NÃO GARANTIDA/);
assert.match(newOrder, /BRL líquido realmente recebido na venda/);
assert.match(newOrder, /fee Nexa de 1,5%/);
assert.match(newOrder, /Nenhum dinheiro foi movimentado/);
assert.doesNotMatch(newOrder, /requestPixRedemption[\s\S]{0,600}amountBrl/);

assert.match(legacyPixApp, /function formatInputAmount\(value\)/);
assert.match(
  legacyPixApp,
  /setValorUsdc\(formatInputAmount\(saldo\.USDC\)\)/,
);
assert.match(legacyPixApp, /lastIndexOf\(','\)/);
assert.match(legacyPixApp, /lastIndexOf\('\.'\)/);

assert.match(activity, /listPixRedemptions/);
assert.match(activity, /BRL líquido da venda/);
assert.match(activity, /Fee Nexa/);
assert.match(activity, /Pix Out/);
assert.match(activity, /Pix enviado/);
assert.match(activity, /Estimativa antes da venda/);
assert.match(activity, /Este valor não é garantido/);
assert.match(activity, /Até 1 dia útil/);
assert.match(activity, /endToEndId/);
assert.doesNotMatch(activity, /valor garantido/i);

assert.match(readme, /usuários Beta\/Legacy não são migrados automaticamente/i);

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
  'Nexa mobile 2.0.3 validated: simple entry, legacy access without Privy, one-step Privy onboarding, decimal-safe Pix redemption and preserved operations.',
);