#!/usr/bin/env bash
# Reconstruct the exact last approved v148 Android OTA, then add only Theo
# support links. This script intentionally does not publish anything.
set -euo pipefail
: "${RUNNER_TEMP:=/tmp}"
: "${NEXA_THEO_OVERLAY_FILE:=$RUNNER_TEMP/nexa-theo-v148-ota-overlay.js}"
if [[ ! -f "$NEXA_THEO_OVERLAY_FILE" ]]; then
  echo "Missing copied Theo overlay script"; exit 1
fi
BASE_SHA=a97dea14a6235be6332fc106370c70665de9fef3
ACTIVATION_SHA=d07c2d3f58879d0352d4a41392decdac6c3b1e7b
MAIN_KYC_SHA=36378a045567c1ee8227ae7c1d0b99c0879856a0
MAYA_SHA=bf04f2df9e778e2bc183e2fc412a30988717b3e4
PJ_SHA=fbc90f6b44483f4b70718391803ba80815fb0ad9
SUPPORT_SHA=4b3847e8c027a5ec2fa5526cd95db2651213a68b
git fetch --no-tags origin main feat/aave-v148-internal-apk-20261102 feat/maya-v148-ota-compatible-20261104 release/nexa-2.0.43-v148-brasil
for sha in "$BASE_SHA" "$ACTIVATION_SHA" "$MAIN_KYC_SHA" "$MAYA_SHA" "$PJ_SHA" "$SUPPORT_SHA"; do
  git cat-file -e "$sha^{commit}" || { echo "Cannot verify approved source $sha"; exit 1; }
done
git switch --detach "$BASE_SHA"
test "$(git rev-parse HEAD)" = "$BASE_SHA"
git show "$ACTIVATION_SHA:app/index.tsx" > app/index.tsx
git show "$MAIN_KYC_SHA:app/kyc.tsx" > app/kyc.tsx
git show "$MAYA_SHA:app/assistant.tsx" > app/assistant.tsx
git show "$MAYA_SHA:app/_layout.tsx" > app/_layout.tsx
for path in 'app/sign-in.tsx' 'app/sign-up-country.tsx' 'app/(app)/pj-entry.tsx' 'app/(app)/pj-wallet.tsx'; do
  git show "$PJ_SHA:$path" > "$path"
done
git show "$SUPPORT_SHA:src/lib/nexaSupportLinks.ts" > src/lib/nexaSupportLinks.ts
node <<'NODE'
const fs=require('node:fs');
function patch(path,original,replacement,expected=1){
  let s=fs.readFileSync(path,'utf8');
  const count=s.split(original).length-1;
  if(count!==expected)throw Error('PJ composite anchor changed: '+path+' '+count);
  fs.writeFileSync(path,s.split(original).join(replacement));
}
const loginButton="              onPress={() => router.push('/sign-in')}\n            />";
const companyButton='\n            <ActionButton\n              label="Nexa Empresa · Acessar ou criar CNPJ"\n              variant="secondary"\n              onPress={() => router.push({pathname:\'/sign-in\',params:{mode:\'pj\'}} as any)}\n            />';
patch('app/index.tsx',loginButton,loginButton+companyButton,2);
patch('app/(app)/_layout.tsx',
 '<Stack.Screen name="rewards" options={{ title: \'Rewards\' }} />',
 '<Stack.Screen name="rewards" options={{ title: \'Rewards\' }} />\n      <Stack.Screen name="pj-entry" options={{ title: \'Nexa PJ · CNPJ\' }} />\n      <Stack.Screen name="pj-wallet" options={{ title: \'Nexa PJ · Carteira empresarial\' }} />',1);
patch('src/components/AlignedLegacyApp.tsx',
 '<MenuTile icon="◈" title="Carteira" subtitle="Ativos e carteira" onPress={() => setPage(\'wallet\')} />',
 '<MenuTile icon="◈" title="Carteira" subtitle="Ativos e carteira" onPress={() => setPage(\'wallet\')} />\n          <MenuTile icon="PJ" title="Nexa Empresa" subtitle="Acessar ou cadastrar CNPJ" onPress={() => router.push(\'/(app)/pj-entry\' as any)} />',1);
NODE
node "$NEXA_THEO_OVERLAY_FILE"
node <<'NODE'
const fs=require('node:fs');
const cp=require('node:child_process');
const app=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const eas=JSON.parse(fs.readFileSync('eas.json','utf8'));
const dynamic=require('./app.config.js')({config:app});
if(app.version!=='2.0.43'||pkg.version!=='2.0.43'||app.android.versionCode!==148)throw Error('Wrong v148 version');
if(dynamic.version!=='2.0.43'||dynamic.android.versionCode!==148||app.runtimeVersion?.policy!=='appVersion')throw Error('Wrong OTA runtime');
if(eas.build.production.channel!=='production'||app.android.package!=='br.com.trynexa.app')throw Error('Wrong release channel/package');
const approved=new Set([
 'app/index.tsx','app/kyc.tsx','app/assistant.tsx','app/_layout.tsx',
 'app/sign-in.tsx','app/sign-up-country.tsx','app/(app)/_layout.tsx',
 'app/(app)/pj-entry.tsx','app/(app)/pj-wallet.tsx',
 'src/components/AlignedLegacyApp.tsx','src/lib/nexaSupportLinks.ts'
]);
const changed=cp.execFileSync('git',['status','--porcelain'],{encoding:'utf8'});
for(const line of changed.split('\n').filter(Boolean)){
  const file=line.slice(3).trim();
  if(!approved.has(file))throw Error('Unapproved bundle mutation: '+file);
}
for(const file of ['app.json','app.config.js','eas.json','package.json','package-lock.json','src/lib/api.ts']){
  if(cp.execFileSync('git',['status','--porcelain','--',file],{encoding:'utf8'}).trim())
    throw Error('Native/financial config changed: '+file);
}
console.log('SAFE: only allowlisted JS/TS support + approved Maya, activation, PJ files changed');
NODE
