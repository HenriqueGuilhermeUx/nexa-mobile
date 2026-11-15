const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const ts = require('typescript');

const source = fs.readFileSync('src/maya-actions/communicationDraft.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, Error, String });
const make = moduleExports.createMayaCommunicationDraft;

const message = make({ kind: 'message', body: 'Olá, vamos conversar?' });
assert.strictEqual(message.shareText, 'Olá, vamos conversar?');
assert.strictEqual(message.reviewed, false);
assert.strictEqual(message.sent, false);
const email = make({ kind: 'email', subject: 'Projeto Nexa', body: 'Olá, gostaria de conversar sobre o projeto.' });
assert.strictEqual(email.shareText, 'Assunto: Projeto Nexa\n\nOlá, gostaria de conversar sobre o projeto.');
assert.strictEqual(email.sent, false);
assert.throws(() => make({ kind: 'email', subject: '', body: 'Mensagem longa' }));
assert.throws(() => make({ kind: 'request', subject: 'Assunto', body: '' }));
assert.throws(() => make({ kind: 'message', body: 'a'.repeat(3001) }));
assert.throws(() => make({ kind: 'unknown', body: 'Olá, tudo bem?' }));
const sanitized = make({ kind:'message', body:'Olá\u0000 Mundo' });
assert.strictEqual(sanitized.shareText, 'Olá Mundo');

const screen = fs.readFileSync('app/maya-comunicacao.tsx','utf8');
const layout = fs.readFileSync('app/_layout.tsx','utf8');
const actions = fs.readFileSync('app/maya-actions.tsx','utf8');
const chat = fs.readFileSync('src/components/NexaAssistantOpenFinance.tsx','utf8');
const route = fs.readFileSync('src/maya-actions/chatIntent.ts','utf8');
assert(screen.includes('loadNexaSession()') && screen.includes('nexaApi.me(session.accessToken)'), 'Require authenticated session');
assert(screen.includes('const [draft, setDraft]') && screen.includes('createMayaCommunicationDraft({ kind, subject, body })'));
assert(screen.indexOf('async function share()') < screen.indexOf('await Share.share('), 'No automatic share');
assert(screen.includes('onPress={() => { void share(); }}'), 'Share only after button press');
assert(screen.includes('setDraft(null)'), 'Changing draft must invalidate preview');
assert(screen.includes('Share.dismissedAction') && screen.includes('A Maya não confirma a entrega'), 'Do not claim delivery');
assert(!/AsyncStorage|SecureStore|fetch\(|axios\.|sendPix|executePayment|autoSend/.test(screen), 'Never store or remotely submit communication');
assert(layout.includes('name="maya-comunicacao"'), 'Missing route');
assert(actions.includes("router.push('/maya-comunicacao'"), 'Missing entry');
assert(chat.includes("pathname: '/maya-comunicacao'"), 'Missing chat navigation');
assert(route.includes("kind: 'communication_draft'"), 'Missing local intent');

console.log('PASS Maya 04: locally reviewed text, user-selected share, no auto-delivery/storage/payments');
