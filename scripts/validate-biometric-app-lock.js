const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const pkg = json('package.json');
const appJson = json('app.json');
const appConfigFactory = require('../app.config.js');
const dynamicConfig = appConfigFactory({ config: appJson.expo });
const appLock = read('src/lib/appLock.ts');
const gate = read('src/components/AppLockGate.tsx');
const session = read('src/lib/session.ts');
const signIn = read('app/sign-in.tsx');
const rootLayout = read('app/_layout.tsx');
const security = read('app/security.tsx');
const alignedApp = read('src/components/AlignedLegacyApp.tsx');
const openFinance = read('app/open-finance.tsx');
const eas = json('eas.json');

assert.match(
  String(pkg.dependencies?.['expo-local-authentication'] || ''),
  /^~57\.0\./,
  'expo-local-authentication must stay on the Expo SDK 57 line',
);

const plugins = appJson?.expo?.plugins || [];
assert.ok(
  plugins.some((plugin) =>
    Array.isArray(plugin)
      ? plugin[0] === 'expo-local-authentication'
      : plugin === 'expo-local-authentication',
  ),
  'expo-local-authentication config plugin is required',
);

assert.match(appLock, /biometricsSecurityLevel:\s*'strong'/);
assert.match(appLock, /disableDeviceFallback:\s*false/);
assert.match(appLock, /requireConfirmation:\s*true/);
assert.match(appLock, /LocalAuthentication\.authenticateAsync/);
assert.match(appLock, /isAppLockEnabled/);
assert.match(appLock, /reauthenticateSensitiveAction/);

assert.match(gate, /BACKGROUND_RELOCK_MS\s*=\s*30_000/);
assert.match(gate, /AppState\.addEventListener\('change'/);
assert.match(gate, /clearNexaTokens/);
assert.match(gate, /router\.replace\('\/sign-in'/);
assert.match(gate, /Entrar com senha Nexa/);
assert.match(rootLayout, /<AppLockGate>/);
assert.match(rootLayout, /name="security"/);

assert.match(session, /SESSION_PRESENT_KEY/);
assert.match(session, /SecureStore\.setItemAsync/);
assert.doesNotMatch(session, /password/i, 'session storage must never persist a password');
assert.match(signIn, /Proteger a Nexa neste aparelho\?/);
assert.match(signIn, /enableAppLock/);
assert.match(signIn, /Sua senha não é armazenada|sua senha não é armazenada/i);

assert.match(security, /Segurança da Nexa/);
assert.match(security, /enableAppLock/);
assert.match(security, /disableAppLock/);
assert.match(security, /authenticateDevice/);
assert.match(security, /biometria para a Nexa/i);
assert.match(security, /senha Nexa nunca é armazenada/i);
assert.match(alignedApp, /router\.push\('\/security'\)/);
assert.match(alignedApp, /title="Segurança"/);

assert.match(openFinance, /reauthenticateSensitiveAction/);
assert.match(openFinance, /Autorizar entrada via Open Finance/);
assert.match(openFinance, /Confirme sua identidade para iniciar a autorização no seu banco/);

// Release identity and OTA runtime boundary must remain coherent across app.json and app.config.js.
const appVersion = String(appJson.expo.version || '');
const androidBuild = Number(appJson.expo.android?.versionCode);
const iosBuild = String(appJson.expo.ios?.buildNumber || '');
const releaseBuild = String(appJson.expo.extra?.releaseBuild || '');
assert.match(appVersion, /^\d+\.\d+\.\d+$/);
assert.ok(Number.isInteger(androidBuild) && androidBuild > 0, 'Android versionCode must be a positive integer');
assert.equal(iosBuild, String(androidBuild));
assert.equal(dynamicConfig.version, appVersion);
assert.equal(Number(dynamicConfig.android?.versionCode), androidBuild);
assert.equal(String(dynamicConfig.ios?.buildNumber), iosBuild);
assert.equal(String(dynamicConfig.extra?.releaseBuild || ''), releaseBuild);
assert.match(releaseBuild, new RegExp(appVersion.replace(/\./g, '\\.')));
assert.match(releaseBuild, new RegExp(`v${androidBuild}(?:-|$)`));
assert.equal(appJson.expo.runtimeVersion?.policy, 'appVersion');
assert.equal(
  appJson.expo.updates?.url,
  'https://u.expo.dev/b3faabec-283a-4ba2-88b5-f096304e68aa',
);
assert.ok(pkg.dependencies?.['expo-updates'], 'expo-updates dependency is required');

const release = eas?.build?.['production-open-finance-aab'];
assert.ok(release, 'production-open-finance-aab profile is required');
assert.equal(release.android?.buildType, 'app-bundle');
assert.equal(
  release.env?.EXPO_PUBLIC_NEXA_API_URL,
  'https://nexa-backend-p2u0.onrender.com/api/v1',
);
assert.equal(
  release.env?.EXPO_PUBLIC_NEXA_EFI_OPEN_FINANCE_API_URL,
  'https://nexa-backend-p2u0.onrender.com/api/v1',
);
assert.equal(release.env?.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED, 'false');
assert.equal(release.env?.EXPO_PUBLIC_NEXA_EFI_OPEN_FINANCE_RECURRING_ENABLED, 'false');

console.log(
  `Nexa ${appVersion} v${androidBuild} security invariants OK: strong biometrics, OTA runtime boundary, fresh Nexa password fallback, 30s relock and sensitive Open Finance re-auth.`,
);