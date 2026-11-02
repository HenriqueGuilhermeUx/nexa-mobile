import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {loadNexaSession} from '@/lib/session';
import {config} from '@/config';

type Availability={available:boolean;reason?:string};
type Consent={granted:boolean;version?:number};
type Report={kind:string;mode:string;financialExecutionEnabled:boolean;investmentAdviceEnabled:boolean;combinedValue:null;observations?:Array<{message?:string}|string>;warnings?:string[]};
const enabled=process.env.EXPO_PUBLIC_NEXA_MAYA_PREMIUM_ENABLED==='true';
export default function MayaPremiumScreen(){
 const [token,setToken]=useState('');
 const [availability,setAvailability]=useState<Availability|null>(null);
 const [consent,setConsent]=useState<Consent|null>(null);
 const [report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const base=config.apiUrl.replace(/\/$/,'');
 async function request(path:string,method='GET',signal?:AbortSignal){
  const response=await fetch(base+path,{method,signal,headers:{Authorization:'Bearer '+token,Accept:'application/json','Cache-Control':'no-store'}});
  if(!response.ok)throw new Error(response.status===401?'Sua sessão expirou. Entre novamente.':'Serviço indisponível ou acesso não autorizado.');
  return response.json();
 }
 useEffect(()=>{
  let alive=true;
  loadNexaSession().then(session=>{
   if(!alive)return;
   if(!session){router.replace('/sign-in');return;}
   setToken(session.accessToken);
  }).catch(()=>{if(alive)setError('Não foi possível verificar a sessão.');});
  return ()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(!token||!enabled)return;
  const abort=new AbortController();
  Promise.all([
   fetch(base+'/agentic/accounts/availability',{headers:{Authorization:'Bearer '+token},signal:abort.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error('API indisponível');return r.json();}),
   fetch(base+'/agentic/accounts/consent',{headers:{Authorization:'Bearer '+token},signal:abort.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Consentimento indisponível');return r.json();})
  ]).then(([a,c])=>{if(!abort.signal.aborted){setAvailability(a);setConsent(c);}}).catch(()=>{if(!abort.signal.aborted)setError('Maya Premium ainda não disponível neste ambiente.');});
  return ()=>abort.abort();
 },[token]);
 async function change(grant:boolean){
  setBusy(true);setError('');setReport(null);
  try{
   const c=await request('/agentic/accounts/consent',grant?'POST':'DELETE');
   if(c.granted!==grant)throw Error('Autorização não confirmada.');
   setConsent(c);setAvailability(await request('/agentic/accounts/availability'));
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 async function consult(){
  if(!availability?.available||!consent?.granted)return;
  setBusy(true);setError('');setReport(null);
  try{
   const r:Report=await request('/agentic/consultant-review/my-finances');
   if(r.kind!=='NEXA_AGENTICS_CONSULTANT_REVIEW'||r.financialExecutionEnabled!==false||r.investmentAdviceEnabled!==false||r.combinedValue!==null)
    throw Error('Resposta inválida da consulta.');
   setReport(r);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 return <ScrollView contentContainerStyle={styles.page}>
  <Text style={styles.title}>Maya · Consultora Premium</Text>
  <Text style={styles.text}>Análises informativas da sua conta Nexa. Sem pagamentos, transferências ou recomendações de investimento.</Text>
  {!enabled?<Text style={styles.text}>Disponível em breve para clientes Premium convidados.</Text>:null}
  {enabled&&!consent&&!error?<ActivityIndicator/>:null}
  {consent?<View>
   <Text style={styles.text}>{consent.granted?'Consultas autorizadas. Você pode revogar a qualquer momento.':'Autorize explicitamente para permitir consultas aos seus dados financeiros.'}</Text>
   <Pressable disabled={busy} style={styles.button} onPress={()=>change(!consent.granted)}><Text style={styles.buttonText}>{consent.granted?'Revogar autorização':'Autorizar consultas'}</Text></Pressable>
  </View>:null}
  {availability?.available&&consent?.granted?<Pressable disabled={busy} style={styles.button} onPress={consult}><Text style={styles.buttonText}>Consultar minhas finanças</Text></Pressable>:null}
  {availability&&!availability.available?<Text style={styles.text}>Acesso ainda não liberado para esta conta Premium.</Text>:null}
  {busy?<ActivityIndicator/>:null}
  {error?<Text style={styles.error}>{error}</Text>:null}
  {report?<View><Text style={styles.title}>Resumo informativo</Text>{(report.observations||[]).map((o,i)=><Text key={i} style={styles.text}>• {typeof o==='string'?o:o.message||'Observação disponível'}</Text>)}<Text style={styles.text}>Fontes podem se sobrepor. Nenhum saldo é somado ou tratado como disponível para saque.</Text></View>:null}
 </ScrollView>;
}
const styles=StyleSheet.create({page:{flexGrow:1,padding:24,backgroundColor:'#06111F',gap:18},title:{color:'#FFFFFF',fontSize:23,fontWeight:'700'},text:{color:'#D5E1EE',fontSize:15,lineHeight:23},error:{color:'#FFB0B0'},button:{backgroundColor:'#2777CC',padding:15,borderRadius:12},buttonText:{color:'#FFFFFF',fontWeight:'700',textAlign:'center'}});
