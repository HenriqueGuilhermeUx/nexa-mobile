const assert = require('node:assert/strict');
const fs = require('node:fs');

const util = fs.readFileSync('src/lib/externalWalletWatch.ts','utf8');
const screen = fs.readFileSync('app/(app)/external-wallets.tsx','utf8');
const layout = fs.readFileSync('app/(app)/_layout.tsx','utf8');
const shell = fs.readFileSync('src/components/AlignedLegacyApp.tsx','utf8');
const appConfig = JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const docs = fs.readFileSync('docs/nexa-external-wallet-simple-and-usdc-to-pix-20261116.md','utf8');

assert.equal(appConfig.android.package,'br.com.trynexa.app');
assert.equal(appConfig.android.versionCode,148);
assert.equal(appConfig.ios.bundleIdentifier,'br.com.trynexa.app');
assert.match(util,/EXPO_PUBLIC_NEXA_EXTERNAL_WALLET_WATCH_ENABLED === 'true'/);
assert.match(util,/SHA256/);
assert.match(util,/SecureStore\.setItemAsync/);
assert.match(util,/MAX_WALLETS = 5/);
assert.match(util,/getChainId\(\)/);
assert.match(util,/chainId !== 137/);
assert.match(util,/balanceOf/);
assert.match(util,/formatUnits\(raw, 6\)/);
assert.match(util,/0x3c499c542cef5e3811e1192ce70d8cc03d5c3359/i);
assert.match(screen,/loadNexaSession/);
assert.match(screen,/nexaApi\.me\(session\.accessToken\)/);
assert.match(screen,/wallet-v15\/me/);
assert.match(screen,/Apenas visualizar/);
assert.match(screen,/não comprova que ele é seu/);
assert.match(screen,/não está na Nexa|não é saldo Nexa|NÃO É SALDO NEXA/);
assert.match(screen,/ainda indisponível|Ainda indisponível/);
assert.match(screen,/link\.metamask\.io\/dapp/);
assert.match(layout,/name="external-wallets"/);
assert.match(shell,/externalWalletFeaturesEnabled\(\)/);
assert.match(shell,/Adicionar carteira externa/);
assert.match(shell,/title="Carteira cripto"/);
assert.match(shell,/Outra wallet → Nexa/);
assert.match(shell,/Acompanhe USDC de outra carteira/);
assert.match(docs,/financialExecutionAllowed=false/);
assert.match(docs,/conciliação/);

// No off-chain or on-chain money movement can be added through this pilot.
const forbidden = ['eth_sendTransaction','wallet_sendCalls','sendTransaction(',
  'writeContract(','personal_sign','eth_sign','wallet-ownership/verify',
  '/payment/create','/pix/pay','ledger/credit','/transfer/execute',
  '@walletconnect','@reown','signMessage('];
for (const token of forbidden) {
  assert.ok(!util.includes(token),'read-only utility contains forbidden operation: '+token);
  assert.ok(!screen.includes(token),'pilot screen contains forbidden operation: '+token);
}
console.log('PASS: authentic Nexa user + per-user local address storage; public USDC Polygon read only');
console.log('PASS: existing verified wallet receive route, MetaMask browser fallback, no send/sign/ledger or Pix');
console.log('PASS: production identifiers preserved; feature disabled by default');
