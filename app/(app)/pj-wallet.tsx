import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';

type PjWallet = {
 status:string; address?:string|null; network?:string; chainId?:number;
 balanceUsdc?:number|null; balanceStatus?:string; financialActionsEnabled?:boolean;
};
type PjActivity = {
 transactions:Array<{txHash:string;direction:string;amountUsdc:string;blockNumber:number}>;
 window?:{fromBlock:number;toBlock:number;completeHistory:boolean};
};
type PjPreview = {
 to:string;amountUsdc:string;availableUsdc:string;gasBalance:number;
 sufficientUsdc:boolean;canExecute:boolean;reason:string;
};

const API=config.apiUrl.replace(/\/$/,'');
async function authorizedGet<T>(path:string, body?:unknown):Promise<T>{
 const session=await loadNexaSession();
 if(!session?.accessToken)throw new Error('Entre na sua conta Nexa para acessar a empresa.');
 const response=await fetch(API+path,{
  method:body===undefined?'GET':'POST',
  headers:{Authorization:'Bearer '+session.accessToken,...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const raw=await response.text();
 let data:any={};try{data=raw?JSON.parse(raw):{}}catch{}
 if(!response.ok){
  if(response.status===403)throw new Error('Acesso PJ exige KYC PF aprovado, CNPJ e aprovação manual da empresa.');
  if(response.status===401)throw new Error('Sessão expirada. Entre novamente na Nexa.');
  throw new Error(String(data.message||'Não foi possível consultar a carteira PJ.'));
 }
 return data as T;
}
function roundAmount(value:unknown){
 return Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:6});
}

export default function NexaPjWalletScreen(){
 const [wallet,setWallet]=useState<PjWallet|null>(null);
 const [activity,setActivity]=useState<PjActivity|null>(null);
 const [preview,setPreview]=useState<PjPreview|null>(null);
 const [destination,setDestination]=useState('');
 const [amount,setAmount]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const verified=wallet?.status==='verified_read_only'&&/^0x[0-9a-fA-F]{40}$/.test(wallet.address||'');
 const refresh=useCallback(async()=>{
  setBusy(true);setError('');setActivity(null);setPreview(null);
  try{
   const result=await authorizedGet<PjWallet>('/merchant/pj/crypto-wallet');
   setWallet(result);
   if(result.status==='verified_read_only'){
    try{setActivity(await authorizedGet<PjActivity>('/merchant/pj/crypto-wallet/activity'))}
    catch{setActivity(null);}
   }
  }catch(e){setWallet(null);setError(e instanceof Error?e.message:'Consulta PJ indisponível')}
  finally{setBusy(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 const previewSend=async()=>{
  setError('');setPreview(null);setBusy(true);
  try{
   const result=await authorizedGet<PjPreview>('/merchant/pj/crypto-wallet/transfer-preflight',{to:destination.trim(),amountUsdc:amount.trim().replace(',','.')});
   if(result.canExecute)throw new Error('Prévia não pode habilitar movimentações financeiras.');
   setPreview(result);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar a prévia')}
  finally{setBusy(false)}
 };
 return <ScrollView contentContainerStyle={styles.container}>
  <Text style={styles.eyebrow}>NEXA PJ · EMPRESA</Text>
  <Text style={styles.title}>Carteira cripto PJ</Text>
  <Text style={styles.subtitle}>USDC na Polygon · separada da sua carteira pessoal</Text>
  <View style={styles.card}>
   <Text style={styles.label}>Conta empresarial</Text>
   {busy&&<ActivityIndicator color="#31D7FF" style={{marginVertical:12}}/>}
   {error?<Text style={styles.warning}>{error}</Text>:null}
   {verified?<View>
    <Text style={styles.amount}>{wallet?.balanceStatus==='confirmed'?roundAmount(wallet.balanceUsdc)+' USDC':'Saldo temporariamente indisponível'}</Text>
    <Text style={styles.label}>Endereço verificado da empresa</Text>
    <Text selectable style={styles.address}>{wallet?.address}</Text>
    <Pressable style={styles.button} onPress={()=>void Clipboard.setStringAsync(wallet?.address||'')}><Text style={styles.buttonText}>Copiar endereço para receber USDC</Text></Pressable>
    <Text style={styles.muted}>Somente USDC nativo na rede Polygon (137). Confirme o endereço e a rede antes de receber. O app não transforma saldo PF em saldo PJ.</Text>
   </View>:<View>
    <Text style={styles.muted}>Sua empresa precisa estar aprovada e ter uma carteira externa empresarial vinculada por assinatura, separada da sua carteira Privy PF.</Text>
    <Pressable style={styles.button} onPress={()=>void Linking.openURL('https://trynexa.com.br/merchant')}><Text style={styles.buttonText}>Abrir cadastro e conexão PJ</Text></Pressable>
   </View>}
   <Pressable style={styles.secondary} onPress={()=>void refresh()} disabled={busy}><Text style={styles.secondaryText}>Atualizar carteira PJ</Text></Pressable>
  </View>
  {verified?<View style={styles.card}>
   <Text style={styles.section}>Atividade USDC recente</Text>
   <Text style={styles.muted}>Movimentações on-chain da janela recente consultada. Não substitui o extrato contábil empresarial.</Text>
   {activity?.transactions?.length?activity.transactions.map((tx,i)=><Pressable key={tx.txHash+':'+i} style={styles.transaction} onPress={()=>void Linking.openURL('https://polygonscan.com/tx/'+encodeURIComponent(tx.txHash))}>
    <Text style={styles.transactionText}>{tx.direction==='in'?'Recebido':tx.direction==='out'?'Enviado':'Própria'} · {tx.amountUsdc} USDC</Text>
    <Text style={styles.muted}>Bloco {tx.blockNumber} · Ver na PolygonScan</Text>
   </Pressable>):<Text style={styles.muted}>Sem movimentações recentes disponíveis nessa janela.</Text>}
  </View>:null}
  {verified?<View style={styles.card}>
   <Text style={styles.section}>Conferir transferência</Text>
   <Text style={styles.warning}>Prévia somente. Nenhuma transferência, assinatura ou Pix será executado.</Text>
   <TextInput style={styles.input} placeholder="Endereço 0x de destino" placeholderTextColor="#7A90A6" value={destination} onChangeText={setDestination} autoCapitalize="none"/>
   <TextInput style={styles.input} placeholder="Valor USDC, ex.: 2,5" placeholderTextColor="#7A90A6" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>
   <Pressable style={styles.button} onPress={()=>void previewSend()} disabled={busy}><Text style={styles.buttonText}>Conferir saldo e destino</Text></Pressable>
   {preview?<Text style={styles.muted}>Destino: {preview.to}{'\n'}Valor: {preview.amountUsdc} USDC{'\n'}Saldo: {preview.availableUsdc} USDC{'\n'}Gas: {preview.gasBalance} POL{'\n'}Saldo suficiente: {preview.sufficientUsdc?'Sim':'Não'}{'\n'}Operação indisponível até ativação financeira empresarial.</Text>:null}
  </View>:null}
  <Text style={styles.footer}>Aprovação PJ e comprovação de endereço não autorizam saques ou compras. Sem acesso à carteira PF.</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 container:{flexGrow:1,padding:20,backgroundColor:'#06111F',gap:16,paddingBottom:48},
 eyebrow:{color:'#31D7FF',fontSize:12,fontWeight:'800',letterSpacing:2},
 title:{fontSize:28,color:'#F4F8FC',fontWeight:'900'},
 subtitle:{color:'#9BAEC4',fontSize:14,lineHeight:20},
 card:{backgroundColor:'#0E2138',borderWidth:1,borderColor:'#203B59',borderRadius:20,padding:18,gap:12},
 label:{color:'#9BAEC4',fontSize:12,fontWeight:'700'},
 section:{fontSize:19,color:'#F4F8FC',fontWeight:'800'},
 amount:{fontSize:30,fontWeight:'900',color:'#F4F8FC'},
 address:{color:'#31D7FF',fontSize:12,lineHeight:19},
 muted:{color:'#9BAEC4',fontSize:12,lineHeight:19},
 warning:{color:'#F8CA7C',fontSize:13,lineHeight:20},
 button:{backgroundColor:'#2675C4',borderRadius:13,padding:15,alignItems:'center'},
 buttonText:{color:'#FFFFFF',fontWeight:'800',fontSize:13,textAlign:'center'},
 secondary:{padding:12,borderWidth:1,borderColor:'#30536C',borderRadius:13,alignItems:'center'},
 secondaryText:{color:'#B3DDEB',fontWeight:'700'},
 transaction:{borderTopWidth:1,borderColor:'#203B59',paddingVertical:11,gap:4},
 transactionText:{color:'#F4F8FC',fontWeight:'700',fontSize:14},
 input:{backgroundColor:'#071628',borderWidth:1,borderColor:'#30536C',borderRadius:12,color:'#F4F8FC',padding:14},
 footer:{color:'#70879F',fontSize:11,lineHeight:18},
});
