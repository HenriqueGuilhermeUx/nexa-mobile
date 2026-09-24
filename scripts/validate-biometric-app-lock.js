const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));

const pkg = json('package.json');
const appJson = json('app.json');
const appConfig = read('app.config.js');
const appLock = read('src/lib/appLock.ts');
const gate = read('src/components/AppLockGate.tsx');
const session = read('src/lib/session.ts');
const signIn = read('app/sign-in.tsx');
const rootLayout = read('app/_layout.tsx');
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
assert.match(gate, /Entrar com senha Nexa/);
assert.match(rootLayout, /<AppLockGate>/);

assert.match(session, /SESSION_PRESENT_KEY/);
assert.match(session, /SecureStore\.setItemAsync/);
assert.doesNotMatch(session, /password/i, 'session storage must never persist a password');
assert.match(signIn, /Proteger a Nexa neste aparelho\?/);
assert.match(signIn, /enableAppLock/);
assert.match(signIn, /Sua senha não é armazenada|sua senha não é armazenada/i);

assert.match(appConfig, /version:\s*'2\.0\.19'/);
assert.match(appConfig, /versionCode:\s*114/);
assert.match(appConfig, /v114-biometric-open-finance/);

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
  'Biometric app-lock invariants OK: strong biometrics + device credential fallback, password recovery path, 30s relock, v114 identity, financial execution OFF.',
);
