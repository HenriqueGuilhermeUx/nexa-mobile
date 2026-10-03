const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');

const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const config = read('src/config.ts');
const buy = read('app/(app)/buy-crypto.tsx');
const funding = read('app/(app)/fund-card.tsx');
const addMoney = read('app/(app)/new-order.tsx');
const layout = read('app/_layout.tsx');

// Release identity must stay internally coherent without pinning CI to one historical build.
const appVersion = String(app.expo.version || '');
const androidBuild = Number(app.expo.android?.versionCode);
const iosBuild = String(app.expo.ios?.buildNumber || '');
const releaseBuild = String(app.expo.extra?.releaseBuild || '');
assert.match(appVersion, /^\d+\.\d+\.\d+$/);
assert.ok(Number.isInteger(androidBuild) && androidBuild > 0, 'Android versionCode must be a positive integer');
assert.equal(iosBuild, String(androidBuild));
assert.match(releaseBuild, new RegExp(appVersion.replace(/\./g, '\\.')));
assert.match(releaseBuild, new RegExp(`v${androidBuild}(?:-|$)`));
assert.equal(app.expo.runtimeVersion?.policy, 'appVersion');
assert.equal(
  app.expo.updates?.url,
  'https://u.expo.dev/b3faabec-283a-4ba2-88b5-f096304e68aa',
);
assert.ok(pkg.dependencies?.['expo-updates'], 'expo-updates must be installed');
assert.equal(pkg.dependencies?.['@alchemy/wallet-apis'], '5.2.7');
assert.equal(pkg.dependencies?.['@privy-io/expo'], '0.70.4');
assert.equal(pkg.dependencies?.viem, '2.55.5');
assert.match(config, /appVersion/);
assert.match(config, /appBuild/);
assert.match(config, /androidTargetApi/);
assert.equal(app.expo.extra?.androidTargetApi, 36);
const buildProperties = (app.expo.plugins || []).find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
);
assert.ok(buildProperties, 'expo-build-properties plugin is required');
assert.equal(buildProperties[1]?.android?.compileSdkVersion, 36);
assert.equal(buildProperties[1]?.android?.targetSdkVersion, 36);
assert.equal(buildProperties[1]?.android?.enableMinifyInReleaseBuilds, true);
assert.equal(buildProperties[1]?.android?.enableShrinkResourcesInReleaseBuilds, true);

// Wallet-First: user-owned Privy wallet signs on-device and Alchemy sponsors gas.
assert.match(buy, /createSmartWalletClient/);
assert.match(buy, /alchemyWalletTransport/);
assert.match(buy, /useEmbeddedEthereumWallet/);
assert.match(buy, /useLoginWithEmail/);
assert.match(buy, /usePrivy/);
assert.match(buy, /disableSignup:\s*true/);
assert.match(buy, /loginWithCode/);
assert.match(buy, /secp256k1_sign/);
assert.match(buy, /hashAuthorization/);
assert.match(buy, /sendCalls/);
assert.match(buy, /waitForCallsStatus/);
assert.match(buy, /onWalletReconnected/);
assert.match(buy, /Atualizar autorização da compra/);
assert.doesNotMatch(buy, /@account-kit\/privy-integration/);
assert.doesNotMatch(
  buy,
  /A carteira Privy desta compra não está disponível neste dispositivo\./,
);
assert.doesNotMatch(buy, /\bPOL\b|\bMATIC\b|gas fee/i);

// Funding policy: Pix stays on Nexa + Woovi. Card/digital wallets may be routed
// across the enabled Privy/Meld providers; MoonPay must not be hard-pinned.
assert.match(layout, /PrivyElements/);
assert.match(funding, /useFundWallet/);
assert.match(funding, /asset:\s*'USDC'/);
assert.match(funding, /defaultPaymentMethod:\s*'card'/);
assert.doesNotMatch(funding, /preferredProvider:\s*'moonpay'/);
assert.match(funding, /Pix continua separado/);
assert.match(addMoney, /Adicionar por Pix/);
assert.match(addMoney, /Cartão · Apple Pay · Google Pay/);
assert.match(addMoney, /\(app\)\/fund-card/);

const allCode = [buy, funding, addMoney, layout, config].join('\n');
assert.doesNotMatch(
  allCode,
  /PRIVY_APP_SECRET\s*[:=]|PRIVY_SECRET_KEY\s*[:=]|MASTER_WALLET_PRIVATE_KEY\s*[:=]|BEGIN PRIVATE KEY/,
);

console.log(
  `Nexa ${appVersion} v${androidBuild} safety validated: user-owned Privy signing + Alchemy sponsorship + wallet-session recovery + Woovi Pix / Meld card routing boundary.`,
);