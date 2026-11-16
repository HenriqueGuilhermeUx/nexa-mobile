import '@walletconnect/react-native-compat';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import UniversalProvider from '@walletconnect/universal-provider';
import { createPublicClient, formatUnits, http, isAddress } from 'viem';
import { polygon } from 'viem/chains';
import { config } from '@/config';

const USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' as const;
const ABI = [{name:'balanceOf',type:'function',stateMutability:'view',
  inputs:[{name:'owner',type:'address'}],outputs:[{type:'uint256'}]}] as const;
type Connection = {address:string;topic:string};
type Pairing = {provider:UniversalProvider;uri:string};

/**
 * Isolated MetaMask WalletConnect transport diagnostic. No AppKit modal, signing,
 * native wallet transfers, ledger changes or funds handling. One chain: Polygon.
 * The WalletConnect project ID and transport errors are surfaced before deep-linking.
 */
export function DirectMetaMaskQa() {
  const [stage,setStage]=useState('Pronto para conectar');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [opening,setOpening]=useState(false);
  const [connected,setConnected]=useState<Connection|null>(null);
  const [balance,setBalance]=useState<string|null>(null);
  const [balanceBusy,setBalanceBusy]=useState(false);
  const run=useRef(0);
  const providerRef=useRef<UniversalProvider|null>(null);
  const pairingRef=useRef<Pairing|null>(null);

  useEffect(()=>()=> {
    run.current++;
    pairingRef.current=null;
    const provider=providerRef.current;
    providerRef.current=null;
    if(provider?.session) void provider.disconnect().catch(()=>undefined);
  },[]);

  const safeError=(caught:unknown):string => {
    const message=caught instanceof Error?caught.message:String(caught);
    return message.replace(/wc:[^\s'"]+/gi,'[URI protegida]')
      .replace(/(symKey|wc_ev)(=|:)[^\s&]+/gi,'$1=[protegido]').slice(0,260);
  };

  function makeStorage() {
    const values=new Map<string,unknown>();
    return {
      getItem:async <T=unknown>(key:string)=>values.get(key) as T|undefined,
      setItem:async <T=unknown>(key:string,value:T)=>{values.set(key,value);},
      removeItem:async (key:string)=>{values.delete(key);},
      getKeys:async ()=>[...values.keys()],
      getEntries:async <T=unknown>()=>[...values.entries()].map(([k,v])=>[k,v as T] as [string,T]),
    };
  }

  async function openMetaMask(pairing:Pairing) {
    if(!/^wc:[^\s]{8,2048}@2\?/.test(pairing.uri)) {
      setError('O protocolo gerou um pedido não compatível com a abertura MetaMask.');
      return;
    }
    setOpening(true);
    setError('');
    try {
      await Linking.openURL('metamask://wc?uri='+encodeURIComponent(pairing.uri));
      setStage('Pedido aberto. Aprove a conexão na MetaMask e retorne à Nexa.');
    } catch(caught) {
      setError('Android não conseguiu abrir a MetaMask: '+safeError(caught));
      setStage('Falha no link Android; a proposta WalletConnect foi gerada.');
    } finally {setOpening(false);}
  }

  async function connectDirectly() {
    if(busy || connected || config.releaseChannel!=='wallet-inbound-lab' ||
       process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED!=='false') return;
    const id=++run.current;
    setBusy(true);setError('');setBalance(null);
    setStage('Etapa 1/4: inicializando o provedor WalletConnect…');
    pairingRef.current=null;
    let stop:undefined|(()=>void);
    try {
      const projectId=process.env.EXPO_PUBLIC_NEXA_REOWN_PROJECT_ID;
      if(!projectId || !/^[a-zA-Z0-9]{16,128}$/.test(projectId)) {
        throw new Error('Project ID WalletConnect ausente ou inválido no APK.');
      }
      const provider=await Promise.race([
        UniversalProvider.init({
          projectId,
          metadata:{
            name:'Nexa Wallet Connect QA',
            description:'Teste de conexão externa somente leitura',
            url:'https://trynexa.com.br',
            icons:['https://trynexa.com.br/favicon.ico'],
            redirect:{native:'nexa-walletconnect-qa://'},
          },
          storage:makeStorage(),
        }),
        new Promise<never>((_,reject)=>setTimeout(()=>
          reject(new Error('Inicialização do WalletConnect não respondeu em 20 segundos.')),20000)),
      ]);
      if(id!==run.current) return;
      providerRef.current=provider;
      setStage('Etapa 2/4: solicitando URI de conexão…');
      let resolveUri:(uri:string)=>void=()=>undefined;
      const uriReceived=new Promise<string>(resolve=>{resolveUri=resolve;});
      const onUri=(uri:string)=>{
        if(id!==run.current || typeof uri!=='string') return;
        pairingRef.current={provider,uri};
        resolveUri(uri);
        setStage('Etapa 3/4: abrindo a MetaMask…');
        void openMetaMask({provider,uri});
      };
      provider.on('display_uri',onUri);
      stop=()=>provider.off('display_uri',onUri);
      const approval=provider.connect({
        optionalNamespaces:{
          eip155:{
            chains:['eip155:137'],
            methods:['personal_sign'],
            events:['accountsChanged','chainChanged'],
          },
        },
      });
      await Promise.race([
        uriReceived,
        approval.then(()=>'session'),
        new Promise<never>((_,reject)=>setTimeout(()=>
          reject(new Error('O provedor não emitiu URI em 20 segundos (relay/projeto WalletConnect).')),20000)),
      ]);
      if(id!==run.current) return;
      setStage('Etapa 4/4: aguardando aprovação na MetaMask…');
      const session=await Promise.race([
        approval,
        new Promise<never>((_,reject)=>setTimeout(()=>
          reject(new Error('A MetaMask não aprovou o pedido em até 90 segundos.')),90000)),
      ]);
      if(id!==run.current) return;
      const accounts=session?.namespaces?.eip155?.accounts??[];
      const found=accounts.find(value=>/^eip155:137:0x[a-fA-F0-9]{40}$/.test(value));
      if(!found || !session?.topic) throw new Error('Sessão aprovada sem conta Polygon válida.');
      const address=found.split(':')[2];
      if(!isAddress(address)) throw new Error('O endereço recebido é inválido.');
      pairingRef.current=null;
      setConnected({address,topic:session.topic});
      setStage('MetaMask conectada: rede Polygon validada.');
      setError('');
    } catch(caught) {
      if(id!==run.current) return;
      setError((pairingRef.current?'A proposta foi gerada, mas falhou: ':'Falha antes da proposta: ')+safeError(caught));
      setStage('Conexão não concluída.');
    } finally {
      stop?.();
      if(id===run.current)setBusy(false);
    }
  }

  async function checkUsdc() {
    if(!connected || balanceBusy)return;
    setBalanceBusy(true);setError('');
    try {
      // Public chain read, without invoking a wallet signer or transaction.
      const client=createPublicClient({chain:polygon,
        transport:http('https://polygon-bor-rpc.publicnode.com',{timeout:16000})});
      const raw=await client.readContract({address:USDC,abi:ABI,
        functionName:'balanceOf',args:[connected.address as any]});
      if(providerRef.current?.session?.topic!==connected.topic){
        throw new Error('A sessão WalletConnect mudou. Reconecte.');
      }
      setBalance(formatUnits(raw,6));
    }catch(caught){setError('Consulta USDC falhou: '+safeError(caught));}
    finally{setBalanceBusy(false);}
  }

  async function disconnect() {
    ++run.current;
    pairingRef.current=null;
    setConnected(null);setBalance(null);setBusy(false);setError('');
    setStage('Carteira desconectada.');
    const provider=providerRef.current;
    providerRef.current=null;
    try{if(provider?.session)await provider.disconnect();}
    catch{setError('A sessão local foi encerrada, mas a carteira poderá manter o vínculo antigo.');}
  }

  if(config.releaseChannel!=='wallet-inbound-lab' ||
     process.env.EXPO_PUBLIC_NEXA_FINANCIAL_EXECUTION_ENABLED!=='false') return null;

  return (
    <View style={{backgroundColor:'#152b42',padding:16,borderRadius:12,gap:12}}>
      <Text style={{color:'#fff',fontSize:18,fontWeight:'800'}}>
        MetaMask — conexão direta QA
      </Text>
      <Text style={{color:'#c9d5e6',fontSize:13}}>
        Sem a janela Reown que ficou travada. WalletConnect na Polygon,
        sem assinatura nem transferências.
      </Text>
      <Text style={{color:'#fff'}}>{stage}</Text>
      {!connected?(
        <Pressable accessibilityRole="button" disabled={busy}
          onPress={()=>{void connectDirectly();}}
          style={{backgroundColor:'#1779d4',padding:14,borderRadius:9,opacity:busy?0.6:1}}>
          <Text style={{color:'#fff',fontWeight:'800',textAlign:'center'}}>
            {busy?'Conectando…':'Conectar MetaMask diretamente'}
          </Text>
        </Pressable>
      ):(
        <>
          <Text selectable style={{color:'#fff'}}>Endereço: {connected.address}</Text>
          <Pressable accessibilityRole="button" disabled={balanceBusy}
            onPress={()=>{void checkUsdc();}}
            style={{backgroundColor:'#286049',padding:12,borderRadius:9}}>
            <Text style={{color:'#fff',textAlign:'center',fontWeight:'700'}}>
              {balanceBusy?'Consultando…':'Consultar USDC Polygon'}
            </Text>
          </Pressable>
          {balance!==null?<Text style={{color:'#aaffcc'}}>
            Saldo externo: {balance} USDC (não é saldo Nexa)
          </Text>:null}
          <Pressable accessibilityRole="button" onPress={()=>{void disconnect();}}>
            <Text style={{color:'#fff',textAlign:'center'}}>Desconectar</Text>
          </Pressable>
        </>
      )}
      {!connected && pairingRef.current && busy?(
        <Pressable accessibilityRole="button" disabled={opening}
          onPress={()=>{if(pairingRef.current)void openMetaMask(pairingRef.current);}}
          style={{backgroundColor:'#286049',padding:12,borderRadius:9}}>
          <Text style={{color:'#fff',fontWeight:'700',textAlign:'center'}}>
            {opening?'Abrindo…':'Abrir MetaMask novamente'}
          </Text>
        </Pressable>
      ):null}
      {error?<Text accessibilityRole="alert" style={{color:'#ffbaba'}}>
        {error}
      </Text>:null}
    </View>
  );
}
