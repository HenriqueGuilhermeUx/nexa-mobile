import '@walletconnect/react-native-compat';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import SignClient from '@walletconnect/sign-client';
import { createPublicClient, formatUnits, http, isAddress } from 'viem';
import { polygon } from 'viem/chains';
import { config } from '@/config';

const USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' as const;
const ABI = [{name:'balanceOf',type:'function',stateMutability:'view',
  inputs:[{name:'owner',type:'address'}],outputs:[{type:'uint256'}]}] as const;
type WalletSession = {address:string;topic:string};
const errorText = (caught:unknown) => {
  const message=caught instanceof Error?caught.message:String(caught);
  // Never expose a pairing URI, its symKey, or an encoded deep-link in UI/logs.
  const scrubbed=message.replace(/wc:[^\s'"]+/gi,'[protocolo protegido]')
    .replace(/metamask:\/\/[^\s'"]+/gi,'[link protegido]')
    .replace(/(symKey|wc_ev)(=|:)[^\s&]+/gi,'$1=[protegido]');
  return scrubbed.slice(0,200);
};
function inMemoryStorage() {
  const data=new Map<string,unknown>();
  return {
    getItem:async <T=unknown>(key:string)=>data.get(key) as T|undefined,
    setItem:async <T=unknown>(key:string,value:T)=>{data.set(key,value);},
    removeItem:async (key:string)=>{data.delete(key);},
    getKeys:async ()=>[...data.keys()],
    getEntries:async <T=unknown>()=>[...data.entries()].map(([k,v])=>[k,v as T] as [string,T]),
  };
}
/**
 * Direct WalletConnect SignClient pairing QA: independent of AppKit and its
 * controller. Uses a fresh requiredNamespace proposal and returns URI directly.
 * No transaction, signing, ledger, custody, or production exposure.
 */
export function DirectMetaMaskSignClientQa() {
  const [step,setStep]=useState('Pronto para conectar.');
  const [detail,setDetail]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [opening,setOpening]=useState(false);
  const [session,setSession]=useState<WalletSession|null>(null);
  const [balance,setBalance]=useState<string|null>(null);
  const [balanceBusy,setBalanceBusy]=useState(false);
  const attempt=useRef(0);
  const clientRef=useRef<SignClient|null>(null);
  const pendingUriRef=useRef<string|null>(null);

  useEffect(()=>()=> {
    attempt.current++;
    pendingUriRef.current=null;
    const client=clientRef.current;
    clientRef.current=null;
    const sessions=client?.session.getAll()??[];
    for(const value of sessions){
      void client?.disconnect({topic:value.topic,reason:{code:6000,message:'QA session closed'}})
        .catch(()=>undefined);
    }
  },[]);

  async function launchMetaMask() {
    const uri=pendingUriRef.current;
    if(!uri || !/^wc:[^\s]{8,2048}@2\?/.test(uri)){
      setError('WC-URI: o SignClient ainda não produziu uma proposta válida.');
      return;
    }
    setOpening(true);setError('');
    try {
      await Linking.openURL('metamask://wc?uri='+encodeURIComponent(uri));
      setStep('3/4 — MetaMask acionada. Confirme a sessão no aplicativo.');
    }catch(caught){
      setStep('3/4 — O Android não conseguiu abrir a MetaMask.');
      setError('WC-DEEPLINK: '+errorText(caught));
    }finally{setOpening(false);}
  }

  async function connect() {
    if(busy || session || config.releaseChannel!=='wallet-inbound-lab' ||
       process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED!=='false')return;
    const id=++attempt.current;
    setError('');setDetail('');setBalance(null);setBusy(true);
    pendingUriRef.current=null;
    try{
      const projectId=process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID;
      if(!projectId || !/^[A-Za-z0-9]{16,128}$/.test(projectId)){
        throw new Error('WC-CONFIG: Project ID não está configurado no APK.');
      }
      setStep('1/4 — Inicializando SignClient…');
      const sign=await Promise.race([
        SignClient.init({
          projectId,
          metadata:{
            name:'Nexa Wallet QA',
            description:'Conectar carteira externa à Nexa — teste somente leitura',
            url:'https://trynexa.com.br',
            icons:['https://trynexa.com.br/favicon.ico'],
            redirect:{native:'nexa-walletconnect-qa://'},
          },
          storage:inMemoryStorage(),
        }),
        new Promise<never>((_,reject)=>setTimeout(()=>reject(
          new Error('WC-INIT: o cliente não inicializou em 20 segundos. Verifique relay/Project ID.')),20000)),
      ]);
      if(id!==attempt.current)return;
      clientRef.current=sign;
      const relay=sign.core.relayer;
      setDetail('Relay após inicialização: '+(relay.connected?'conectado':'não conectado'));
      setStep('2/4 — Criando proposta WalletConnect diretamente…');
      const result=await Promise.race([
        sign.connect({requiredNamespaces:{
          eip155:{
            chains:['eip155:137'],
            methods:['personal_sign'],
            events:['accountsChanged','chainChanged'],
          },
        }}),
        new Promise<never>((_,reject)=>setTimeout(()=>reject(
          new Error('WC-RELAY: a proposta não foi criada em 20 segundos; estado do relay: '+(relay.connected?'conectado':'desconectado')+'.')),20000)),
      ]);
      if(id!==attempt.current)return;
      const uri=result.uri;
      if(!uri){
        throw new Error('WC-URI: o SignClient não retornou URI; não foi solicitado reaproveitamento de sessão.');
      }
      if(!/^wc:[^\s]{8,2048}@2\?/.test(uri)){
        throw new Error('WC-URI-FORMAT: formato inesperado da proposta WalletConnect.');
      }
      pendingUriRef.current=uri;
      setDetail('URI gerada pelo SignClient. Relay: '+(relay.connected?'conectado':'desconectado')+'.');
      // The URI is kept in memory only. Never show, log, or copy it.
      void launchMetaMask();
      setStep('3/4 — Solicitando autorização à MetaMask…');
      const approved=await Promise.race([
        result.approval(),
        new Promise<never>((_,reject)=>setTimeout(()=>reject(
          new Error('WC-APPROVAL: proposta criada, mas MetaMask não aprovou em 90 segundos.')),90000)),
      ]);
      if(id!==attempt.current)return;
      const accounts=approved.namespaces?.eip155?.accounts??[];
      const match=accounts.find(a=>/^eip155:137:0x[a-fA-F0-9]{40}$/.test(a));
      if(!match || !approved.topic)throw new Error('WC-ACCOUNT: MetaMask aprovou sem conta Polygon válida.');
      const address=match.split(':')[2];
      if(!isAddress(address))throw new Error('WC-ACCOUNT: endereço EVM inválido.');
      pendingUriRef.current=null;
      setSession({address,topic:approved.topic});
      setStep('4/4 — MetaMask conectada com sucesso!');
      setDetail('Rede Polygon (137) autorizada. Nenhuma transação realizada.');
      setError('');
      sign.on('session_delete',()=>{
        if(id!==attempt.current)return;
        pendingUriRef.current=null;
        setSession(null);setBalance(null);
        setStep('MetaMask desconectou a sessão.');
      });
    }catch(caught){
      if(id!==attempt.current)return;
      setStep('Conexão interrompida antes da autorização.');
      setError(errorText(caught));
    }finally{
      if(id===attempt.current)setBusy(false);
    }
  }

  async function checkBalance() {
    if(!session || balanceBusy)return;
    setError('');setBalanceBusy(true);
    try{
      const chain=createPublicClient({chain:polygon,
        transport:http('https://polygon-bor-rpc.publicnode.com',{timeout:16000})});
      const amount=await chain.readContract({address:USDC,abi:ABI,
        functionName:'balanceOf',args:[session.address as '0x'+string]});
      // Refresh the session from SignClient before associating a blockchain result.
      const current=clientRef.current?.session.get(session.topic);
      if(!current?.topic || !current.namespaces?.eip155?.accounts?.includes('eip155:137:'+session.address)){
        throw new Error('A conta conectada mudou; reconecte antes de consultar.');
      }
      setBalance(formatUnits(amount,6));
    }catch(caught){setError('WC-BALANCE: '+errorText(caught));}
    finally{setBalanceBusy(false);}
  }

  async function disconnect() {
    ++attempt.current;
    setSession(null);setBalance(null);setError('');setBusy(false);
    pendingUriRef.current=null;setStep('Carteira desconectada.');
    const client=clientRef.current;
    const sessions=client?.session.getAll()??[];
    for(const item of sessions){
      try{await client?.disconnect({topic:item.topic,reason:{code:6000,message:'QA sign out'}});}
      catch{setError('O vínculo local foi encerrado; confira conexões antigas na MetaMask.');}
    }
    clientRef.current=null;
  }

  if(config.releaseChannel!=='wallet-inbound-lab' ||
     process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED!=='false') return null;
  return (
    <View style={{padding:18,gap:12,backgroundColor:'#172b44',borderRadius:14}}>
      <Text style={{color:'white',fontWeight:'800',fontSize:19}}>MetaMask — conexão direta</Text>
      <Text style={{color:'#d4e5ff',fontSize:13}}>
        Teste isolado: o SignClient cria a proposta de conexão sem abrir o AppKit.
        Apenas conexão e consulta de saldo USDC Polygon.
      </Text>
      <Text style={{color:'white',fontWeight:'700'}}>{step}</Text>
      {detail?<Text style={{color:'#c4e6d4'}}>{detail}</Text>:null}
      {!session?(
        <Pressable accessibilityRole="button" disabled={busy}
          onPress={()=>{void connect();}}
          style={{backgroundColor:'#1680da',padding:15,borderRadius:10,opacity:busy?0.6:1}}>
          <Text style={{color:'white',fontWeight:'700',textAlign:'center'}}>
            {busy?'Conectando…':'Conectar MetaMask (SignClient)'}
          </Text>
        </Pressable>
      ):(
        <>
          <Text selectable style={{color:'white'}}>Endereço conectado: {session.address}</Text>
          <Pressable accessibilityRole="button" disabled={balanceBusy}
            onPress={()=>{void checkBalance();}}
            style={{backgroundColor:'#28614a',padding:14,borderRadius:10}}>
            <Text style={{color:'white',fontWeight:'700',textAlign:'center'}}>
              {balanceBusy?'Consultando…':'Consultar USDC Polygon'}
            </Text>
          </Pressable>
          {balance!==null?<Text style={{color:'#bbffdf'}}>
            Saldo externo: {balance} USDC. Não é saldo Nexa.
          </Text>:null}
          <Pressable accessibilityRole="button" onPress={()=>{void disconnect();}}>
            <Text style={{color:'white',textAlign:'center'}}>Desconectar</Text>
          </Pressable>
        </>
      )}
      {busy && pendingUriRef.current?(
        <Pressable accessibilityRole="button" disabled={opening}
          onPress={()=>{void launchMetaMask();}}
          style={{backgroundColor:'#28614a',padding:13,borderRadius:9}}>
          <Text style={{color:'white',textAlign:'center',fontWeight:'700'}}>
            {opening?'Abrindo…':'Abrir MetaMask novamente'}
          </Text>
        </Pressable>
      ):null}
      {error?<Text accessibilityRole="alert" style={{color:'#ffb9b9'}}>{error}</Text>:null}
    </View>
  );
}
