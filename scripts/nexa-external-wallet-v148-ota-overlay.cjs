'use strict';
/**
 * Additive, JS-only overlay for the last approved v148 production composite
 * (activation + Maya + Nexa PJ + Theo). Run AFTER nexa-theo-v148-compose.sh.
 */
const fs=require('node:fs');
const assert=require('node:assert/strict');
function patch(path,oldText,newText){
  let s=fs.readFileSync(path,'utf8');
  const count=s.split(oldText).length-1;
  if(count!==1)throw Error('External-wallet overlay anchor changed: '+path+' count='+count+' '+oldText.slice(0,60));
  fs.writeFileSync(path,s.replace(oldText,newText));
}
const legacy='src/components/AlignedLegacyApp.tsx';
const lib='src/lib/externalWalletWatch.ts';
const page='app/(app)/external-wallets.tsx';
for(const path of [lib,page])if(!fs.existsSync(path))throw Error('Missing watch-only source: '+path);
patch('app/(app)/_layout.tsx',
  '<Stack.Screen name="rewards" options={{ title: \'Rewards\' }} />',
  '<Stack.Screen name="rewards" options={{ title: \'Rewards\' }} />\n      <Stack.Screen name="external-wallets" options={{ title: \'Carteiras externas\' }} />');
patch(legacy,
  "import { config } from '@/config';",
  "import { config } from '@/config';\nimport { externalWalletFeaturesEnabled } from '@/lib/externalWalletWatch';");
patch(legacy,
  '<MenuTile icon="◈" title="Carteira" subtitle="Ativos e carteira" onPress={() => setPage(\'wallet\')} />',
  '<MenuTile icon="◈" title="Carteira" subtitle="Ativos e carteira" onPress={() => setPage(\'wallet\')} />\n          {externalWalletFeaturesEnabled() ? (\n            <MenuTile icon="◈" title="Carteiras externas" subtitle="Acompanhar USDC na Polygon" onPress={() => router.push(\'/(app)/external-wallets\' as any)} />\n          ) : null}');
patch(legacy,
  '          <MenuTile icon="＋" title="Adicionar" subtitle="Pix → USDC" onPress={openWalletFirstDeposit} />',
  '          <MenuTile icon="＋" title="Adicionar" subtitle="Pix → USDC" onPress={openWalletFirstDeposit} />\n          {externalWalletFeaturesEnabled() ? (\n            <MenuTile icon="◈" title="Carteira cripto" subtitle="Outra wallet → Nexa" onPress={() => router.push(\'/(app)/external-wallets\' as any)} />\n          ) : null}');
const pixMove=[
'          <TouchableOpacity style={styles.moveCard} onPress={openWalletFirstDeposit} activeOpacity={0.82}>',
'            <View style={styles.moveIcon}><NexaIcon name="plus" color="#31D7FF" size={24} /></View>',
'            <Text style={styles.moveTitle}>Adicionar</Text>',
'            <Text style={styles.moveText}>Comece com Pix e receba USDC na sua wallet.</Text>',
'          </TouchableOpacity>'
].join('\n');
const cryptoMove=[
'          {externalWalletFeaturesEnabled() ? (',
'            <TouchableOpacity style={styles.moveCard}',
"              onPress={() => router.push('/(app)/external-wallets' as any)} activeOpacity={0.82}>",
'              <View style={styles.moveIcon}><NexaIcon name="receive" color="#31D7FF" size={24} /></View>',
'              <Text style={styles.moveTitle}>Carteira cripto</Text>',
'              <Text style={styles.moveText}>Acompanhe USDC de outra carteira e veja como trazer à Nexa.</Text>',
'            </TouchableOpacity>',
'          ) : null}'
].join('\n');
patch(legacy,pixMove,pixMove+'\n'+cryptoMove);
const card=[
'        {externalWalletFeaturesEnabled() ? (',
'          <Card>',
'            <Text style={styles.sectionKicker}>CARTEIRAS EXTERNAS</Text>',
'            <Text style={styles.highlightTitle}>MetaMask e outras wallets, sem complicação.</Text>',
'            <Text style={styles.highlightText}>Consulte USDC da Polygon de um endereço público, sem WalletConnect. Para trazer à Nexa, utilize o endereço de recebimento autenticado.</Text>',
"            <PrimaryButton title=\"Adicionar carteira externa\" onPress={() => router.push('/(app)/external-wallets' as any)} secondary />",
'          </Card>',
'        ) : null}'
].join('\n');
patch(legacy,'        ) : null}\n\n        <View style={styles.quickActionsRow}>','        ) : null}\n\n'+card+'\n        <View style={styles.quickActionsRow}>');
const all=fs.readFileSync(legacy,'utf8');
const watch=fs.readFileSync(lib,'utf8');
const screen=fs.readFileSync(page,'utf8');
assert.match(all,/Theo no Telegram/);
assert.match(all,/Theo no WhatsApp/);
assert.match(all,/Nexa Empresa/);
assert.match(all,/Carteira cripto/);
assert.match(all,/Open Finance/);
assert.match(watch,/balanceOf/);
assert.match(watch,/EXPO_PUBLIC_NEXA_EXTERNAL_WALLET_WATCH_ENABLED !== 'false'/);
assert.match(screen,/loadNexaSession/);
assert.match(screen,/nexaApi\.me/);
assert.match(screen,/wallet-v15\/me/);
assert.match(screen,/ainda indisponível|Ainda indisponível/);
for(const word of ['eth_sendTransaction','signMessage(','writeContract(','@walletconnect','@reown']){
  if(watch.includes(word)||screen.includes(word))throw Error('Financial/wallet signing operation disallowed: '+word);
}
console.log('PASS wallet watch-only overlay: Pix, Open Finance, PJ, Maya, Theo preserved; no transfer/signature.');
