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
const kycScreen = read('app/kyc.tsx');
const rootLayout = read('app/_layout.tsx');
const appLayout = read('app/(app)/_layout.tsx');
const onboarding = read('app/onboarding-wallet.tsx');
const legacyBridge = read('app/legacy.js');
const alignedApp = read('src/components/AlignedLegacyApp.tsx');
const financialBridge = read('src/lib/legacy-financial-fetch-bridge.js');
const legacyPixApp = read('nexa-mobile/nexa-mobile/App.js');
const custodyScreen = read('nexa-mobile/nexa-mobile/CustodyScreen.js');
const babelConfig = read('babel.config.js');
const pixRouteTransform = read('scripts/babel-replace-legacy-pix-route.js');
const artifactValidator = read('scripts/validate-built-artifact.js');
const entrypoint = read('entrypoint.js');
const metro = read('metro.config.js');

assert.equal(appConfig.expo.android.package, 'br.com.trynexa.app');
assert.equal(appConfig.expo.ios.bundleIdentifier, 'br.com.trynexa.app');
assert.equal(appConfig.expo.scheme, 'nexa');
assert.equal(appConfig.expo.version, '2.0.11');
assert.equal(packageJson.version, '2.0.11');
assert.equal(appConfig.expo.android.versionCode, 105);
assert.equal(appConfig.expo.ios.buildNumber, '105');
assert.equal(appConfig.expo.extra.androidTargetApi, 36);
assert.equal(appConfig.expo.extra.financialExecutionEnabled, false);
assert.equal(appConfig.expo.extra.ledgerOperationsEnabled, true);
assert.equal(appConfig.expo.extra.balanceSource, 'ledger');
assert.equal(appConfig.expo.extra.privyOptional, true);
assert.equal(appConfig.expo.extra.releaseChannel, 'production');
assert.match(appConfig.expo.extra.apiUrl, /^https:\/\//);

assert.equal(packageJson.main, 'entrypoint.js');
assert.equal(packageJson.dependencies['react-native-svg'], '15.15.4');
assert.equal(packageJson.dependencies['react-native-reanimated'], '4.5.1');
assert.equal(packageJson.dependencies['react-native-worklets'], '0.10.1');
assert.ok(packageJson.dependencies['@privy-io/expo']);
assert.ok(packageJson.dependencies['expo-secure-store']);
assert.ok(packageJson.dependencies['react-native-safe-area-context']);
assert.match(packageJson.dependencies.expo, /^~57\./);
assert.match(packageJson.dependencies['react-native'], /^0\.86\./);
assert.match(entrypoint, /fast-text-encoding/);
assert.match(entrypoint, /react-native-get-random-values/);
assert.match(entrypoint, /@ethersproject\/shims/);
assert.match(metro, /moduleName === 'jose'/);

assert.match(session, /expo-secure-store/);
assert.match(session, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
assert.match(session, /migrateLegacySession/);
assert.match(session, /AsyncStorage\.getItem\('nexa_token'\)/);
assert.match(session, /AsyncStorage\.removeItem\('nexa_token'\)/);
assert.doesNotMatch(session, /password/i);

assert.match(config, /appVersion/);
assert.match(config, /appBuild/);
assert.match(config, /2\.0\.11/);
assert.match(config, /105/);
assert.match(config, /androidTargetApi/);
assert.match(config, /EXPO_PUBLIC_NEXA_API_URL/);
assert.match(config, /EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED/);
assert.match(config, /EXPO_PUBLIC_NEXA_RELEASE_CHANNEL/);
assert.match(api, /X-Nexa-App-Version/);
assert.match(api, /X-Nexa-App-Build/);
assert.match(api, /X-Nexa-Platform/);
assert.match(api, /Authorization/);

assert.match(welcome, /Cripto sem complicação/);
assert.match(welcome, /label="Entrar"/);
assert.match(welcome, /label="Criar conta"/);
assert.match(welcome, /nexaApi\.me/);
assert.match(welcome, /migrateLegacySession/);
assert.match(welcome, /nexaApi\.refresh/);
assert.match(welcome, /'\/kyc'/);
assert.match(welcome, /'\/legacy'/);
assert.doesNotMatch(welcome, /Primeiros Nexa|convite|ABERTURA GRADUAL/i);
assert.doesNotMatch(rootLayout, /primeiros-nexa/);
assert.ok(!fs.existsSync('app/primeiros-nexa.tsx'));

assert.match(signIn, /nexaApi\.login/);
assert.match(signIn, /saveNexaSession/);
assert.match(signIn, /loadNexaEmail/);
assert.match(signIn, /Por segurança, sua senha não é armazenada/);
assert.match(signIn, /kycStatus/);
assert.match(signIn, /'\/kyc'/);
assert.match(signIn, /'\/legacy'/);
assert.doesNotMatch(signIn, /useLoginWithEmail|sendCode|loginWithCode|onboarding-wallet/);

assert.match(signUp, /nexaApi\.register/);
assert.match(signUp, /saveNexaSession/);
assert.match(signUp, /CPF/);
assert.match(signUp, /router\.replace\('\/kyc'/);
assert.doesNotMatch(signUp, /router\.replace\('\/legacy'/);
assert.doesNotMatch(signUp, /useLoginWithEmail|sendCode|loginWithCode|onboarding-wallet/);

assert.match(api, /\/kyc\/didit\/brazil\/start/);
assert.match(api, /\/kyc\/didit\/me/);
assert.match(api, /startBrazilKyc/);
assert.match(api, /getMyKycStatus/);
assert.match(kycScreen, /Consentimento biométrico/);
assert.match(kycScreen, /startBrazilKyc/);
assert.match(kycScreen, /getMyKycStatus/);
assert.match(kycScreen, /AppState/);
assert.match(kycScreen, /document_fallback/);
assert.match(kycScreen, /manual_review/);
assert.match(kycScreen, /retry_selfie/);
assert.match(kycScreen, /Concordo e verificar identidade/);
assert.doesNotMatch(appLayout, /AuthBoundary|usePrivy|Privy/);

// A experiência aprovada usa um shell alinhado, preservando o App.js antigo
// apenas para auditoria/compatibilidade histórica e não como UI principal.
assert.match(legacyBridge, /AlignedLegacyApp/);
assert.match(legacyBridge, /activeSession\.accessToken/);
assert.match(legacyBridge, /nexaApi\.refresh/);
assert.match(legacyBridge, /saveNexaSession/);
assert.doesNotMatch(legacyBridge, /<LegacyApp|installLegacyFinancialFetchBridge/);

assert.match(alignedApp, /useSafeAreaInsets/);
assert.match(alignedApp, /paddingBottom:\s*Math\.max\(insets\.bottom/);
assert.match(alignedApp, /\['home', '⌂', 'Início'\]/);
assert.match(alignedApp, /\['wallet', '◫', 'Carteira'\]/);
assert.match(alignedApp, /\['assets', '◇', 'Ativos'\]/);
assert.match(alignedApp, /\['send', '↑', 'Enviar'\]/);
assert.match(alignedApp, /\['menu', '☰', 'Menu'\]/);
assert.match(alignedApp, /USDC/);
assert.match(alignedApp, /BTC/);
assert.match(alignedApp, /ETH/);
assert.match(alignedApp, /XAUT/);
assert.doesNotMatch(alignedApp, /PAXG|WBTC|USDY/);
assert.match(alignedApp, /Taxas menores/);
assert.match(alignedApp, /Recebimento externo/i);
assert.doesNotMatch(alignedApp, /Entrada Nexa de 4%/);
assert.doesNotMatch(alignedApp, /taxa de entrada Nexa é 8%/);
assert.match(alignedApp, /carteira individual é um recurso Nexa Premium/i);
assert.match(alignedApp, /asset:\s*'USDC'/);
assert.match(alignedApp, /internal-transfer\/send-by-username/);
assert.match(alignedApp, /clientRequestId/);
assert.match(alignedApp, /financialExecutionEnabled/);
assert.match(alignedApp, /X-Nexa-App-Version/);
assert.match(alignedApp, /X-Nexa-App-Build/);
assert.match(alignedApp, /X-Nexa-Platform/);
assert.match(alignedApp, /internalTransferRequestId/);
assert.match(alignedApp, /assetBuyRequestId/);
assert.match(alignedApp, /assetSellRequestId/);
assert.match(alignedApp, /pixOutRequestId/);
assert.match(alignedApp, /depositRequestId/);
assert.match(alignedApp, /rewardJoinRequestId/);
assert.match(alignedApp, /rewards\/join/);
assert.match(alignedApp, /rewards\/withdraw/);
assert.match(alignedApp, /80% fica com o cliente e 20% com/);
assert.match(alignedApp, /Fale com a Nexa/);
assert.match(alignedApp, /Suporte pelo WhatsApp/);
assert.match(alignedApp, /551333289704/);
assert.match(alignedApp, /Linking\.openURL/);
assert.match(alignedApp, /useEmbeddedEthereumWallet/);
assert.match(alignedApp, /nexaApi\.linkWallet/);
assert.match(alignedApp, /\/deposit\/woovi-pix/);
assert.match(alignedApp, /\/payment\/pix\/quote/);
assert.match(alignedApp, /\/payment\/pix\/redemption/);
assert.doesNotMatch(alignedApp, /\/withdrawal\/pix-request/);
assert.match(alignedApp, /\/recurring-pix\/pause/);
assert.match(alignedApp, /\/recurring-pix\/cancel/);
assert.match(alignedApp, /\/recurring-pix\/link-woovi/);
assert.match(alignedApp, /Endereço exigido para autorização do Pix Automático/);
assert.match(alignedApp, /NEXA_PASSPORT/);
assert.match(alignedApp, /hasExistingWallet/);
assert.match(alignedApp, /canAccessCustody\s*=\s*isPremium\s*\|\|\s*hasExistingWallet/);
assert.match(alignedApp, /Geração de cobrança Pix está bloqueada neste build de preview/);
assert.match(alignedApp, /Solicitação de Pix está bloqueada neste build de preview/);
assert.match(alignedApp, /apiUrl=\{API\}/);
assert.match(alignedApp, /financialExecutionEnabled=\{config\.financialExecutionEnabled\}/);
assert.match(alignedApp, /POLYGON_USDC_CONTRACT/);
assert.match(alignedApp, /0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359/);
assert.match(alignedApp, /getEthereumProvider\(\)/);
assert.match(alignedApp, /eth_sendTransaction/);
assert.match(alignedApp, /wallet\/my-privy\/journal-usdc-send/);
assert.match(alignedApp, /onSendExternalUsdc=\{sendExternalPrivyUsdc\}/);
assert.match(custodyScreen, /Receber USDC externamente/);
assert.match(custodyScreen, /Enviar para carteira externa/);
assert.match(custodyScreen, /onSendExternalUsdc/);
assert.match(custodyScreen, /privyWalletReady/);
assert.match(custodyScreen, /clientHeaders/);
assert.match(custodyScreen, /apiUrl = DEFAULT_API/);
assert.match(custodyScreen, /financialExecutionEnabled = false/);
assert.match(custodyScreen, /Movimentação on-chain está bloqueada neste build de preview/);
assert.match(custodyScreen, /Confirmação de retorno está bloqueada neste build de preview/);
assert.doesNotMatch(custodyScreen, /custody\/overview\?userId=/);
assert.doesNotMatch(custodyScreen, /custody\/deposit-instructions\?userId=/);
assert.doesNotMatch(custodyScreen, /userId:\s*user\.id/);
assert.doesNotMatch(
  alignedApp,
  /\binvest(?:ir|imento|imentos|indo|ido|ida)\b|\brendimento\b|\brentabilidade\b|\bretorno financeiro\b/i,
);

// Pontes e telas antigas continuam auditadas enquanto existirem no repositório.
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
assert.match(financialBridge, /2\.0\.11/);
assert.match(financialBridge, /105/);
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

assert.match(onboarding, /isPremiumProfile/);
assert.match(onboarding, /Criar Minha Carteira/);
assert.match(onboarding, /router\.replace\('\/legacy'/);
assert.match(onboarding, /alreadyLinked/);
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
  'Nexa mobile 2.0.11 v105 validated on Expo 57: upgrade-safe session, aligned shell, idempotent financial requests, USDC/BTC/ETH/XAUT and Premium wallet boundary.',
);
