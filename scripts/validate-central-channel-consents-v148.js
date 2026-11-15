const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const screen=fs.readFileSync(path.join(__dirname,'../app/central-nexa.tsx'),'utf8');
const find=(needle)=>assert.ok(screen.includes(needle), 'missing: '+needle);
for(const marker of [
  'type ExternalChannel', 'type ExternalPurpose','CONSENT_NOTICE_VERSION',
  "'/central-nexa/channel-consents'", "loadNexaSession()",
  "Authorization:'Bearer ' + session.accessToken",
  "channelConsentState === 'ready'",
  'channelConsentSaving', 'channelConsents[key] === true',
  'setChannelConsent(option.channel,option.purpose,!enabled)',
  "found.optedIn !== optedIn", "setNotice('Não conseguimos confirmar sua escolha.",
  'Você escolhe cada canal', 'O canal precisa ser verificado antes de qualquer envio.',
  'registerNexaCentralServicePush', 'revokeNexaCentralServicePush',
  'noteDepositGuideOpened', 'sendInternalMessage',
])find(marker);
assert.equal((screen.match(/purpose:'service'/g)||[]).length,2);
assert.equal((screen.match(/purpose:'marketing'/g)||[]).length,2);
assert.ok(!/setChannelConsents\(\{[^}]*true/.test(screen),'No implicit opt-in');
assert.ok(!/if\s*\(response\.ok\)\s*setChannelConsents/.test(screen),'Require payload verification');
console.log('Central Nexa channel consent static checks passed');
