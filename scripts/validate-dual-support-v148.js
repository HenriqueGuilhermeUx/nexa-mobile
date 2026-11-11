'use strict';
// Pure source-level regression contract for the JS-only v148 support update.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const config=JSON.parse(read('app.json')).expo;
const eas=JSON.parse(read('eas.json'));
const pkg=JSON.parse(read('package.json'));
const links=read('src/lib/nexaSupportLinks.ts');
const app=read('src/components/AlignedLegacyApp.tsx');
const kyc=read('app/kyc.tsx');
const signIn=read('app/sign-in.tsx');
const dynamic=require('../app.config.js')({config});

assert.equal(config.version,'2.0.43','OTA must match v148 app runtime');
assert.equal(pkg.version,'2.0.43');
assert.equal(config.android.versionCode,148);
assert.equal(config.android.package,'br.com.trynexa.app');
assert.equal(config.runtimeVersion.policy,'appVersion');
assert.equal(dynamic.version,config.version);
assert.equal(dynamic.android.versionCode,148);
assert.equal(eas.build.production.channel,'production');
assert.match(links,/https:\/\/t\.me\/NexaTheoBot/);
assert.match(links,/https:\/\/wa\.me\/551333289704\?text=/);
assert.match(links,/encodeURIComponent\(message\)/);
const linkLogic=links.split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n');
assert.doesNotMatch(linkLogic,/user\?\.email|userId|accountId|\bcpf\b|accessToken|walletAddress|\bsaldo\b/i,
  'Support URL must not contain user information or session state');
assert.match(links,/topic === 'kyc'/);
assert.match(app,/async function openNexaTelegram\(\)/);
assert.match(app,/Linking\.openURL\(NEXA_TELEGRAM_SUPPORT_URL\)/);
assert.match(app,/Linking\.openURL\(nexaWhatsAppSupportUrl\(\)\)/);
assert.match(app,/title="Theo no Telegram"/);
assert.match(app,/title="Theo no WhatsApp"/);
assert.match(app,/Ajuda por WhatsApp/);
assert.match(app,/Ajuda por Telegram/);
assert.match(app,/Abrir atendimento Theo pelo Telegram/);
assert.doesNotMatch(app,/user\?\.email \? \x60E-mail:/,
  'Never prefill customer email into WhatsApp');
assert.doesNotMatch(app,/handle \? \x60Nexa ID\/usuário:/,
  'Never prefill customer account ID into WhatsApp');
for(const page of [kyc,signIn]){
  assert.match(page,/NEXA_TELEGRAM_SUPPORT_URL/);
  assert.match(page,/nexaWhatsAppSupportUrl\(/);
  assert.match(page,/Linking\.openURL/);
  assert.match(page,/Telegram/);
  assert.match(page,/WhatsApp/);
}
assert.match(kyc,/Falar com Theo no WhatsApp/);
assert.match(kyc,/Falar com Theo no Telegram/);
assert.match(signIn,/Ajuda no WhatsApp/);
assert.match(signIn,/Ajuda no Telegram/);
assert.doesNotMatch([links,kyc,signIn].join('\n'),/sendPix|depositNow|createWallet|privySecret|EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED/);
console.log('Nexa v148 OTA dual support: URL safety, visible CTAs, runtime and no native change contract PASS');
