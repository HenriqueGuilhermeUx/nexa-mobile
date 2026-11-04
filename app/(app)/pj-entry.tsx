import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';

type Request = {id:string;cnpj:string;status:string;documentReceived?:boolean;companyAccessEnabled?:boolean};
const API=config.apiUrl.replace(/\/$/,'');
const digits=(value:string)=>value.replace(/\D/g,'');
async function pjApi<T>(path:string,body?:object):Promise<T>{
 const session=await loadNexaSession();
 if(!session?.accessToken)throw new Error('Entre na Nexa com sua conta pessoal para continuar.');
 const response=await fetch(API+path,{
  method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+session.accessToken,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const raw=await response.text();let data:any={};try{data=raw?JSON.parse(raw):{}}catch{}
 if(!response.ok){
  const msg=Array.isArray(data.message)?data.message.join(', '):String(data.message||'Não foi possível consultar a empresa.');
  if(response.status===401)throw new Error('Sessão expirada. Entre novamente na Nexa.');
  if(response.status===403)throw new Error('Conclua primeiro o KYC da pessoa responsável pela empresa.');
  throw new Error(msg);
 }
 return data as T;
}
export default function NexaPjEntry(){
 const params=useLocalSearchParams<{cnpj?:string}>();
 const [cnpj,setCnpj]=useState(digits(String(params.cnpj||'')));
 const [company,setCompany]=useState('');
 const [requests,setRequests]=useState<Request[]>([]);
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [email,setEmail]=useState('');
 const [initialized,setInitialized]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);setMessage('');
  try{
   const [session,items]=await Promise.all([loadNexaSession(),pjApi<Request[]>('/merchant/pj/requests')]);
   if(!Array.isArray(items))throw new Error('Resposta de empresas inválida.');
   setEmail(session?.email||'');setRequests(items);
   if(items.length===1&&!cnpj)setCnpj(items[0].cnpj);
  }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível consultar a empresa.')}
  finally{setLoading(false);setInitialized(true)}
 },[cnpj]);
 useEffect(()=>{if(!initialized)void refresh()},[initialized,refresh]);
 const selected=requests.find(r=>digits(r.cnpj)===digits(cnpj));
 const isValid=digits(cnpj).length===14;
 const submit=async()=>{
  if(!isValid){setMessage('Informe o CNPJ da empresa com 14 dígitos.');return}
  if(selected){setMessage('Solicitação já registrada. Consulte a situação abaixo.');return}
  if(company.trim().length<3){setMessage('Informe o nome da empresa.');return}
  setLoading(true);setMessage('');
  try{
   const merchant=await pjApi<{id:string}>('/merchant/register',{
    businessName:company.trim(),cnpj:digits(cnpj),email,phone:'',
    settlementCurrency:'USDC',settlementWalletMode:'NEXA_WALLET',
   });
   if(!merchant.id)throw new Error('Não foi possível identificar a empresa registrada.');
   await pjApi('/merchant/pj/apply',{merchantId:merchant.id});
   const updated=await pjApi<Request[]>('/merchant/pj/requests');
   setRequests(Array.isArray(updated)?updated:[]);
   setMessage('Solicitação PJ criada. Envie o contrato social no portal seguro para análise manual.');
  }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível registrar sua empresa.')}
  finally{setLoading(false)}
 };
 const status=selected?.status;
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
  <Text style={styles.eyebrow}>NEXA EMPRESAS</Text>
  <Text style={styles.title}>Acessar ou criar conta PJ</Text>
  <Text style={styles.paragraph}>A empresa utiliza o CNPJ, mas a identidade e a senha continuam sendo as do responsável Nexa. Sua carteira pessoal permanece separada.</Text>
  <View style={styles.card}>
   <Text style={styles.label}>CNPJ da empresa</Text>
   <TextInput value={cnpj} onChangeText={value=>{setCnpj(digits(value).slice(0,14));setMessage('')}} style={styles.field} placeholder="14 números" placeholderTextColor="#7990A7" keyboardType="numeric" maxLength={14}/>
   {loading?<ActivityIndicator color="#31D7FF"/>:null}
   {!selected&&isValid?<><Text style={styles.label}>Nome empresarial</Text><TextInput style={styles.field} value={company} onChangeText={setCompany} placeholder="Razão social ou nome da empresa" placeholderTextColor="#7990A7"/><Pressable onPress={()=>void submit()} disabled={loading} style={styles.action}><Text style={styles.actionText}>Solicitar abertura PJ</Text></Pressable></>:null}
   {selected?<View style={styles.status}>
    <Text style={styles.statusTitle}>{status==='approved'?'Empresa aprovada':status==='rejected'?'Solicitação rejeitada':status==='pending_review'?'Em análise':'Aguardando documento'}</Text>
    <Text style={styles.paragraph}>CNPJ {selected.cnpj}. {status==='approved'?'A conta empresarial está aprovada. Carteira cripto sujeita a vínculo verificado.':'Acesso financeiro indisponível até concluir as verificações.'}</Text>
    {status==='approved'?<Pressable style={styles.action} onPress={()=>router.push('/(app)/pj-wallet' as any)}><Text style={styles.actionText}>Abrir carteira cripto PJ</Text></Pressable>:null}
    <Pressable style={styles.secondary} onPress={()=>void Linking.openURL('https://trynexa.com.br/merchant')}><Text style={styles.secondaryText}>{status==='awaiting_document'?'Enviar contrato social no portal':'Abrir acompanhamento no portal'}</Text></Pressable>
   </View>:null}
   {message?<Text style={styles.warning}>{message}</Text>:null}
   <Pressable style={styles.secondary} onPress={()=>void refresh()} disabled={loading}><Text style={styles.secondaryText}>Consultar situação</Text></Pressable>
  </View>
  <Text style={styles.note}>A escolha Empresa não altera sua conta PF, não aprova automaticamente um CNPJ e não habilita transferências. Envio de contrato e revisão continuam protegidos.</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#06111F'},content:{padding:20,gap:16,paddingBottom:48},
 eyebrow:{color:'#31D7FF',fontSize:12,letterSpacing:2,fontWeight:'800'},
 title:{color:'#F4F8FC',fontSize:28,fontWeight:'900'},paragraph:{color:'#B4C4D7',fontSize:13,lineHeight:20},
 card:{backgroundColor:'#0E2138',borderRadius:20,padding:18,borderWidth:1,borderColor:'#203B59',gap:14},
 label:{color:'#C3D4E7',fontWeight:'700',fontSize:13},
 field:{backgroundColor:'#071628',borderWidth:1,borderColor:'#30536C',color:'white',padding:14,borderRadius:12},
 action:{backgroundColor:'#2776C9',padding:15,borderRadius:12,alignItems:'center'},
 actionText:{color:'#FFFFFF',fontWeight:'800'},
 secondary:{padding:13,borderWidth:1,borderColor:'#30536C',borderRadius:12,alignItems:'center'},
 secondaryText:{color:'#A9DFF6',fontWeight:'700'},
 status:{gap:10},statusTitle:{color:'#E9F7FF',fontWeight:'800',fontSize:17},
 warning:{color:'#FFCB82',fontSize:13,lineHeight:19},note:{color:'#8DA5BE',fontSize:12,lineHeight:19},
});
