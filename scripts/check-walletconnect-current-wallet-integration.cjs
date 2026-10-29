'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const main = read('src/components/AlignedLegacyApp.tsx');
const funding = read('app/(app)/new-order.tsx');
const hub = read('app/(app)/wallet-connect.tsx');
const card = read('src/components/WalletConnectEntry.tsx');
const gate = read('src/lib/walletConnectProductGate.ts');
const route = read('app/(app)/external-wallet-connect.tsx');
const layout = read('app/(app)/_layout.tsx');
const manifest = JSON.parse(read('app.json')).expo;
const eas = JSON.parse(read('eas.json')).build;
const packageJson = JSON.parse(read('package.json'));
const legacy = read('app/legacy.js');

assert.equal(packageJson.version, '2.0.43', 'do not replace v148 app baseline');
assert.equal(manifest.android.versionCode, 148);
assert.equal(manifest.android.package, 'br.com.trynexa.app');
assert.match(legacy, /<AlignedLegacyApp/, 'existing authenticated product still mounts');
assert.doesNotMatch(legacy, /walletQaEntry/, 'remove QA floating overlay from product shell');

for (const [tag,regex] of Object.entries({
  'Pix create':/createWalletFirstPixCharge/,
  'Pix status':/getWalletFirstPixStatus/,
  'Pix reconciling':/reconcileWalletFirstPixCharge/,
  'Open Finance recurrence':/open-finance-recurring/,
  'Card funding':/fund-card/,
})) assert.match(funding, regex, 'existing funding must remain: '+tag);
assert.match(funding,/WalletConnectEntry context="receive"/);
for (const [tag,regex] of Object.entries({
  'Wallet home':/function Home\(\)/,
  'User wallet':/function Wallet\(\)/,
  'Movimentar':/function Move\(\)/,
  'Menu':/function Menu\(\)/,
  'Pix Deposit':/function DepositPix\(\)/,
  'Pix withdraw':/function WithdrawPix\(\)/,
  'Customer wallet address QR':/<QRCode value=\{walletAddress\}/,
  'Send to Nexa':/openWalletFirstSend/,
  'Existing Pix withdrawal':/openWalletFirstWithdraw/,
  'User statement':/function History\(\)/,
  'Custody existing':/<CustodyScreen/,
})) assert.match(main, regex, 'do not remove existing function: '+tag);
assert.match(main,/WalletConnectEntry context="home"/);
assert.match(main,/WalletConnectEntry context="receive"/);
assert.match(main,/title="WalletConnect"/);
assert.match(main,/<Text style={styles.profileMenuTitle}>WalletConnect<\/Text>/, 'WalletConnect must appear in the actual Profile menu');
assert.match(main,/function openWalletConnectHub\(\)/);
assert.match(layout,/name="wallet-connect"/);
assert.match(card,/if \(!walletConnectProductPreviewEnabled\) return null/);
assert.match(gate,/config.releaseChannel === 'wallet-inbound-lab'/);
assert.match(gate,/EXPO_PUBLIC_NEXA_WALLET_CONNECT_UI_ENABLED === 'true'/);
assert.match(gate,/EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED === 'false'/);
assert.match(gate,/walletConnectFinancialOperationsEnabled = false as const/);
assert.equal(eas['wallet-inbound-lab-v148'].env.EXPO_PUBLIC_NEXA_WALLET_CONNECT_UI_ENABLED,'true');
assert.equal(eas['wallet-inbound-lab-v148'].env.EXPO_PUBLIC_NEXA_REOWN_ENABLED,'false');
assert.equal(eas['wallet-inbound-lab-v148'].env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED,'false');
assert.notEqual(eas.production.env.EXPO_PUBLIC_NEXA_WALLET_CONNECT_UI_ENABLED,'true');
assert.match(route,/mode="view-only"/);
assert.match(route,/nexaApi.me\(session.accessToken\)/);

const receiveApi=read('src/lib/externalUsdcReceivePreview.ts');
const receiveReview=read('src/components/ExternalUsdcReceiveReviewPanel.tsx');
const staging=read('src/components/StagedExternalWalletConnect.tsx');
assert.match(staging, /ExternalUsdcReceiveReviewPanel/, 'connected wallet must expose reviewed inbound USDC');
assert.match(receiveReview, /getVerifiedNexaReceiveDestination/, 'Privy-verified receiver must be fetched');
assert.match(receiveReview, /validateReownExternalConnection/, 'EVM account must be checked before and after review');
assert.match(receiveApi, /LIVE_PRIVY_USER_AND_WALLET_AUDIT/, 'never accept cached receiving address');
assert.match(receiveApi, /decodeFunctionData/, 'decode and validate ERC20 calldata');
assert.match(receiveApi, /creditsLedger !== false/, 'read-only preview must never claim ledger credit');
assert.match(receiveApi, /backendMayBroadcast !== false/, 'the preview must not allow broadcasting');
assert.match(receiveApi, /getAddress\(NATIVE_POLYGON_USDC\)/, 'native Polygon USDC is mandatory');
for(const content of [receiveApi,receiveReview]) {
  for(const forbidden of ['eth_sendTransaction','wallet_sendCalls','eth_signTransaction',
    'wallet_switchEthereumChain','/wallet/my-privy/journal-usdc-send']) {
    assert.ok(!content.includes(forbidden),'the inbound review must remain financially inert: '+forbidden);
  }
}
assert.match(hub,/Transferência guiada e conciliação WalletConnect: em homologação/);
assert.match(hub,/Envio para carteira externa conectada: indisponível neste piloto/);
assert.match(hub,/O saldo da carteira externa não é saldo Nexa/);
for(const filename of [
  'app/(app)/wallet-connect.tsx',
  'src/components/WalletConnectEntry.tsx',
  'src/lib/walletConnectProductGate.ts',
]) {
  const contents = read(filename);
  for(const prohibited of ['eth_sendTransaction','wallet_sendCalls','eth_signTransaction',
    'approve(', '/wallet-v15/transfer/', '/wallet-connect-inbound/ownership/link',
    '/wallet-connect-inbound/inbound/credit']) {
    assert.ok(!contents.includes(prohibited),filename+' must not execute transfers or mutate balances: '+prohibited);
  }
}
const custody=read('nexa-mobile/nexa-mobile/CustodyScreen.js');
const legacyRouter=read('app/legacy.js');
assert.match(staging, /reviewNexaExternalWithdrawalDestination/, 'Reown QA must offer outbound review navigation');
assert.match(staging, /validateReownExternalConnection/, 'Reown outbound address must be checked before prefill');
assert.match(staging, /open:'custody',externalRecipient:current.address/, 'reuse custody rather than add new transfer code');
assert.match(legacyRouter, /walletConnectProductPreviewEnabled/, 'restrict external destination routing to QA');
assert.match(legacyRouter, /requestedPage === 'custody'/, 'never prefill unrelated screens');
assert.match(main, /initialExternalRecipient=\{initialExternalRecipient\}/, 'keep main Wallet custody callback');
assert.match(custody, /const \[externalToAddress, setExternalToAddress\] = useState\(reviewedRecipient\)/);
assert.match(custody, /onSendExternalUsdc/, 'existing outgoing Privy signer must remain wired');
assert.match(custody, /financialExecutionEnabled/, 'financial execution check must remain');
const receiptClient = read('src/lib/externalUsdcReceiptObservation.ts');
const receiptPanel = read('src/components/ExternalUsdcReceiveReviewPanel.tsx');
assert.match(receiptClient, /receive\/confirm\?txHash=/, 'receipt must use authenticated backend read-only endpoint');
assert.match(receiptClient, /method:'GET'/, 'receipt lookup must be non-mutating');
assert.match(receiptClient, /ledgerCredited!==false/, 'receipt must reject purported ledger credits');
assert.match(receiptClient, /confirmationsRequired<12/, 'receipt must require minimum confirmation policy');
assert.match(receiptPanel, /observeExternalUsdcReceipt\(props.accessToken,txHash\)/);
assert.match(receiptPanel, /Não significa crédito em ledger Nexa/);
for(const prohibited of ['eth_sendTransaction','wallet_sendCalls','eth_signTransaction',
  'eth_sendRawTransaction','approve(','/transfer/onchain-direct/confirm']) {
  assert.ok(!receiptClient.includes(prohibited) && !receiptPanel.includes(prohibited),
    'receipt observation must never submit transactions: '+prohibited);
}
console.log('PASS: v148 intact; Pix, wallet, send, cash-out, history and existing profile preserved');
console.log('PASS: WalletConnect entry in funding, wallet, home, move and menu; QA-only view mode');
console.log('PASS: no real transfers, custody changes or ledger credits from new UI');
