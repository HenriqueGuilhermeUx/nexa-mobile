// Nexa 2.0.42 v147 store icon-hotfix regression guard.
const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const legacy = read('src/components/AlignedLegacyApp.tsx');
const kyc = read('app/kyc.tsx');
const welcome = read('app/ecosystem-welcome.tsx');
const config = read('src/config.ts');
const onboarding = read('src/lib/onboarding.ts');
const rootLayout = read('app/_layout.tsx');
const forceGate = read('src/components/ForceUpdateGate.tsx');
const api = read('src/lib/api.ts');

assert(app.version === '2.0.42', 'Nexa app version must remain 2.0.42');
assert(pkg.version === '2.0.42', 'Package version must remain 2.0.42');
assert(Number(app.android?.versionCode) === 147, 'Android versionCode must be 147');
assert(String(app.ios?.buildNumber) === '147', 'iOS buildNumber must be 147');
assert(app.android?.package === 'br.com.trynexa.app', 'Android package changed');
assert(app.ios?.bundleIdentifier === 'br.com.trynexa.app', 'iOS bundle identifier changed');

const bottomNav = [
  "['home', 'home', 'Início']",
  "['assets', 'assets', 'Ativos']",
  "['move', 'move', 'Movimentar']",
  "['history', 'history', 'Histórico']",
  "['profile', 'profile', 'Perfil']",
];
let previousIndex = -1;
for (const item of bottomNav) {
  const index = legacy.indexOf(item);
  assert(index > previousIndex, `Bottom navigation missing/reordered: ${item}`);
  previousIndex = index;
}

for (const label of [
  '>Segurança<',
  '>Nexa ID<',
  '>Premium<',
  '>Ajuda<',
  '>Termos e privacidade<',
]) {
  assert(legacy.includes(label), `Existing Profile option missing: ${label}`);
}

const termsIndex = legacy.indexOf('Termos e privacidade');
const ecosystemIndex = legacy.indexOf('SOBERANIA DIGITAL');
assert(termsIndex >= 0 && ecosystemIndex > termsIndex, 'Ecosystem must remain after existing Profile options');
assert(legacy.includes('DocWallet Docs'), 'DocWallet Docs missing from Profile ecosystem');
assert(legacy.includes('Health Wallet'), 'Health Wallet missing from Profile ecosystem');
assert(legacy.includes('openEcosystemProduct'), 'Ecosystem open action missing');
assert(legacy.includes('downloadEcosystemProduct'), 'Ecosystem download action missing');

assert(config.includes('EXPO_PUBLIC_NEXA_ECOSYSTEM_ONBOARDING_ENABLED'), 'Post-KYC ecosystem flag missing');
assert(kyc.includes("next.kycStatus === 'approved'"), 'KYC approval gate changed');
assert(kyc.includes('shouldShowEcosystemWelcome(profile)'), 'Post-KYC ecosystem introduction is not gated');
assert(welcome.includes('Agora não — continuar na Nexa'), 'Optional continue path missing');
assert(welcome.includes('Ativar e conhecer'), 'Optional product activation missing');
assert(welcome.includes('A ativação é opcional'), 'Optional activation disclosure missing');

for (const route of [
  "'/onboarding-pix'",
  "'/onboarding-wallet'",
  "'/wallet-ownership'",
  "'/legacy'",
]) {
  assert(onboarding.includes(route), `Existing onboarding route missing: ${route}`);
}

assert(!welcome.includes('/deposit'), 'Post-KYC ecosystem screen must not execute financial flows');
assert(!welcome.includes('/withdraw'), 'Post-KYC ecosystem screen must not execute financial flows');
assert(!welcome.includes('/swap'), 'Post-KYC ecosystem screen must not execute financial flows');
assert(!welcome.includes('/transfer'), 'Post-KYC ecosystem screen must not execute financial flows');

assert(rootLayout.includes('<ForceUpdateGate>'), 'Root mandatory-update gate missing');
assert(forceGate.includes('Atualização obrigatória'), 'Mandatory update screen missing');
assert(forceGate.includes('FORCE_UPDATE_EVENT'), 'Runtime mandatory-update listener missing');
assert(forceGate.includes("'X-Nexa-Platform': Platform.OS"), 'Version check must declare runtime platform');
assert(api.includes("response.status === 426"), 'API client must react to mandatory update HTTP 426');
assert(api.includes("APP_UPDATE_REQUIRED"), 'API client mandatory update code handling missing');
assert(api.includes('notifyForceUpdateRequired(payload)'), 'API client must notify root update gate');

console.log('PASS: v147 store icon hotfix preserved product/navigation/security boundaries.');
