'use strict';
// JS-only additive overlay applied AFTER reconstructing the last approved
// production v148 + activation + Maya + Nexa PJ bundle. No native modules.
const fs=require('node:fs');
const assert=require('node:assert/strict');

function patch(path,oldText,newText,expectedCount=1){
  let s=fs.readFileSync(path,'utf8');
  const count=s.split(oldText).length-1;
  if(count!==expectedCount)throw Error(path+' expected '+expectedCount+' anchors; found '+count+' for '+oldText.slice(0,60));
  fs.writeFileSync(path,s.split(oldText).join(newText));
}

function replaceBlock(path,begin,end,content){
  let s=fs.readFileSync(path,'utf8');
  const first=s.indexOf(begin);
  const last=s.indexOf(end,first);
  if(first<0||last<first||s.indexOf(begin,first+1)>=0)throw Error('Cannot safely locate '+begin+' in '+path);
  s=s.slice(0,first)+content+s.slice(last);
  fs.writeFileSync(path,s);
}

// The baseline contains previously approved financial code; only UI/text is
// inserted. Never copy the evolving Aave/Maya integration branch wholesale.
const legacy='src/components/AlignedLegacyApp.tsx';
patch(legacy,"import { config } from '@/config';",
  "import { config } from '@/config';\nimport { NEXA_TELEGRAM_SUPPORT_URL, nexaWhatsAppSupportUrl } from '@/lib/nexaSupportLinks';");
replaceBlock(legacy,"  async function openNexaSupport() {","\n  async function findRecipient()",`  async function openNexaSupport() {
    // User-initiated external chat, without account identifiers or balances.
    try {
      await Linking.openURL(nexaWhatsAppSupportUrl());
    } catch {
      setMessage('Não foi possível abrir o WhatsApp. Acesse trynexa.com.br/suporte.');
    }
  }

  async function openNexaTelegram() {
    try {
      await Linking.openURL(NEXA_TELEGRAM_SUPPORT_URL);
    } catch {
      setMessage('Não foi possível abrir o Telegram. Acesse t.me/NexaTheoBot pelo navegador.');
    }
  }
`);
patch(legacy,`          <MenuTile
            icon="◉"
            title="Fale com a Nexa"
            subtitle="Atendimento no WhatsApp"
            onPress={openNexaSupport}
            accent
          />`,
`          <MenuTile
            icon="◉"
            title="Theo no WhatsApp"
            subtitle="Abrir conversa de atendimento"
            onPress={openNexaSupport}
            accent
          />
          <MenuTile
            icon="✈"
            title="Theo no Telegram"
            subtitle="Abrir conversa de atendimento"
            onPress={openNexaTelegram}
            accent
          />`);
patch(legacy,`          <TouchableOpacity style={styles.profileMenuRow} onPress={openNexaSupport}>
            <View>
              <Text style={styles.profileMenuTitle}>Ajuda</Text>
              <Text style={styles.profileMenuText}>Falar com a equipe Nexa</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>`,
`          <TouchableOpacity style={styles.profileMenuRow} onPress={openNexaSupport} accessibilityRole="button">
            <View>
              <Text style={styles.profileMenuTitle}>Ajuda por WhatsApp</Text>
              <Text style={styles.profileMenuText}>Conversar com Theo no WhatsApp</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileMenuRow} onPress={openNexaTelegram} accessibilityRole="button">
            <View>
              <Text style={styles.profileMenuTitle}>Ajuda por Telegram</Text>
              <Text style={styles.profileMenuText}>Conversar com Theo no Telegram</Text>
            </View>
            <Text style={styles.profileMenuArrow}>›</Text>
          </TouchableOpacity>`);
patch(legacy,
`          <Text style={styles.highlightText}>Fale com a Nexa pelo WhatsApp ou peça ajuda ao seu Assistente.</Text>`,
`          <Text style={styles.highlightText}>Escolha WhatsApp ou Telegram para conversar com o Theo. Não envie CPF, documentos, senhas ou códigos pelo chat.</Text>`);
patch(legacy,`              <Text style={styles.staffPrimaryActionText}>WhatsApp</Text>
            </TouchableOpacity>
            {config.assistantEnabled ? (`,
`              <Text style={styles.staffPrimaryActionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffSecondaryAction,isPremium ? styles.premiumBorder : null]}
              onPress={openNexaTelegram}
              accessibilityRole="button"
              accessibilityLabel="Abrir atendimento Theo pelo Telegram"
            >
              <Text style={styles.staffSecondaryActionText}>Telegram</Text>
            </TouchableOpacity>
            {config.assistantEnabled ? (`);

// Keep the PJ company mode and login intact. Add only voluntary support actions.
const login='app/sign-in.tsx';
patch(login,"import { nexaApi, tokensFromLogin } from '@/lib/api';",
  "import { nexaApi, tokensFromLogin } from '@/lib/api';\nimport { NEXA_TELEGRAM_SUPPORT_URL, nexaWhatsAppSupportUrl } from '@/lib/nexaSupportLinks';");
patch(login,"  return (\n    <Screen>",
`  async function openSupport(channel: 'whatsapp' | 'telegram') {
    try {
      await Linking.openURL(channel === 'whatsapp' ? nexaWhatsAppSupportUrl() : NEXA_TELEGRAM_SUPPORT_URL);
    } catch {
      setError('Não foi possível abrir o atendimento. Acesse trynexa.com.br/suporte.');
    }
  }

  return (
    <Screen>`);
patch(login,
`      <Text style={styles.securityNote}>Biometria pode proteger o acesso depois do primeiro login neste aparelho.</Text>`,
`      <Text style={styles.securityNote}>Biometria pode proteger o acesso depois do primeiro login neste aparelho.</Text>
      <Text style={styles.securityNote}>Dificuldade para entrar? Fale com Theo sem compartilhar CPF, senha ou códigos pelo chat.</Text>
      <View style={styles.supportActions}>
        <ActionButton label="Ajuda no WhatsApp" variant="secondary" onPress={() => void openSupport('whatsapp')} />
        <ActionButton label="Ajuda no Telegram" variant="secondary" onPress={() => void openSupport('telegram')} />
      </View>`);
patch(login,`  topSpace: { height: spacing.lg },`,
`  topSpace: { height: spacing.lg },
  supportActions: { gap: spacing.sm, marginTop: spacing.sm },`);

const links=fs.readFileSync('src/lib/nexaSupportLinks.ts','utf8');
const kyc=fs.readFileSync('app/kyc.tsx','utf8');
const app=fs.readFileSync(legacy,'utf8');
const signin=fs.readFileSync(login,'utf8');
const index=fs.readFileSync('app/index.tsx','utf8');
assert.match(links,/https:\/\/t\.me\/NexaTheoBot/);
assert.match(links,/https:\/\/wa\.me\/551333289704/);
assert.match(app,/title="Nexa Empresa"/);
assert.match(app,/title="Theo no Telegram"/);
assert.match(app,/title="Theo no WhatsApp"/);
assert.match(app,/Ajuda por Telegram/);
assert.match(app,/Ajuda por WhatsApp/);
assert.match(app,/Linking\.openURL\(NEXA_TELEGRAM_SUPPORT_URL\)/);
assert.doesNotMatch(app,/user\?\.email \? `E-mail:/);
assert.doesNotMatch(app,/handle \? `Nexa ID\/usuário:/);
assert.match(signin,/companyMode/);
assert.match(signin,/Ajuda no Telegram/);
assert.match(signin,/Ajuda no WhatsApp/);
assert.match(kyc,/Falar com Theo no Telegram/);
assert.match(kyc,/Falar com Theo no WhatsApp/);
assert.match(index,/sem precisar depositar agora/);
assert.match(fs.readFileSync('app/assistant.tsx','utf8'),/Maya/);
console.log('Nexa v148 cumulative composite: activation + Maya + PJ + Theo dual support PASS');
