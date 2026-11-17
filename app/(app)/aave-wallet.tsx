import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { config } from '@/config';
import { loadNexaSession } from '@/lib/session';
import {
  assertPilotQuote, inspectAavePilotReceipt, sendOneAavePilotStep,
  type PilotAction, type PilotQuote, type PilotProvider,
} from '@/lib/aavePilotWallet';
import { colors } from '@/theme';

type Status={
  success:true;pilotEnabled:boolean;supplyEnabled:boolean;withdrawEnabled:boolean;
  borrowEnabled:false;repayEnabled:false;requiresWalletConfirmation:true;
  chainId:137;message:string;
};
type QuoteResponse=PilotQuote & {
  quote:PilotQuote['quote'] & {
    usdcBalanceUnits:string;aUsdcBalanceUnits:string;gasAvailableWei:string;
    variableSupplyAprBps:number|null;frozen:boolean;active:boolean;paused:boolean;
  };
  warning:string;
};
type Pending={hash:string;kind:string;to:string;owner:string};
const API=config.apiUrl.replace(/\/$/,'');
const ADDRESS=/^0x[a-fA-F0-9]{40}$/;

function asUsdc(units:string):string {
  if(!/^[0-9]+$/.test(units))return 'indisponível';
  const value=BigInt(units);
  return (value/1000000n).toString()+','+
    (value%1000000n).toString().padStart(6,'0').replace(/0+$/,'').padEnd(2,'0');
}

function messageFrom(error:unknown):string {
  return error instanceof Error ? error.message:'Não foi possível concluir a operação.';
}

/**
 * All financial transactions stay in the user's own Privy device wallet.
 * This screen cannot transfer on its own: every approval/supply/withdraw
 * requires an independent customer click and wallet confirmation.
 *
 * Server pilot, identity, KYC, legal and wallet verification all default OFF.
 */
export default function AaveCustomerWalletScreen() {
  const embedded=useEmbeddedEthereumWallet() as any;
  const wallets=(embedded.wallets||[]) as any[];
  const [status,setStatus]=useState<Status|null>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [action,setAction]=useState<PilotAction>('SUPPLY');
  const [amount,setAmount]=useState('1');
  const [consent,setConsent]=useState(false);
  const [prepared,setPrepared]=useState<QuoteResponse|null>(null);
  const [pending,setPending]=useState<Pending|null>(null);
  const [lastHash,setLastHash]=useState('');
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');

  async function api(path:string, method:'GET'|'POST'='GET',body?:unknown):Promise<any>{
    if(!API.startsWith('https://'))throw Error('API segura da Nexa indisponível');
    const session=await loadNexaSession();
    if(!session?.accessToken)throw Error('Entre novamente na Nexa.');
    const response=await fetch(API+'/invest-credit/aave/pilot/'+path,{
      method,
      headers:{
        Authorization:'Bearer '+session.accessToken,
        'X-Nexa-App-Version':config.appVersion,
        'X-Nexa-App-Build':config.appBuild,
        'X-Nexa-Platform':Platform.OS,
        ...(body?{'Content-Type':'application/json'}:{}),
      },
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    if(!response.ok){
      if(response.status===403)return Promise.reject(Error('Conta ou carteira ainda não autorizada para o piloto Aave.'));
      if(response.status===503)return Promise.reject(Error('Condições Aave indisponíveis. Nenhuma operação foi iniciada.'));
      throw Error('Não foi possível verificar a operação Aave ('+response.status+').');
    }
    return response.json();
  }

  useEffect(()=>{
    let mounted=true;
    api('status').then((v:Status)=>{
      if(!mounted)return;
      if(v.success!==true||v.chainId!==137||v.requiresWalletConfirmation!==true||
        v.borrowEnabled!==false||v.repayEnabled!==false)throw Error('Status Aave inválido');
      setStatus(v);
    }).catch(()=>{
      if(mounted)setError('Não foi possível confirmar o acesso Aave. Nenhuma operação habilitada.');
    }).finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[]);

  function clearPlan(){
    setPrepared(null);
    setPending(null);
    setError('');
    setNotice('');
  }

  function walletFor(owner:string):any {
    const match=wallets.find(w=>
      ADDRESS.test(String(w?.address||'')) &&
      String(w.address).toLowerCase()===owner.toLowerCase());
    if(!match)throw Error('Abra sua carteira Privy vinculada à Nexa neste dispositivo.');
    return match;
  }
  async function walletProvider(wallet:any):Promise<PilotProvider>{
    const provider=typeof wallet.getProvider==='function'
      ? await wallet.getProvider()
      : typeof wallet.getEthereumProvider==='function'
        ? await wallet.getEthereumProvider():null;
    if(!provider||typeof provider.request!=='function')
      throw Error('A carteira Privy não disponibilizou uma autorização segura.');
    return provider;
  }

  async function prepare(){
    if(!status?.pilotEnabled||!consent||pending||working)return;
    clearPlan();
    setWorking(true);
    try{
      // Never trust a client-side amount as authorization: server recomputes
      // units from decimal string and enforces the user's bound wallet.
      const data=await api('prepare','POST',{
        action,amountUsdc:amount.replace(',','.'),chainId:137,riskAcknowledged:true,
      }) as QuoteResponse;
      const match=walletFor(data.walletAddress);
      assertPilotQuote(data,match.address);
      setPrepared(data);
      setNotice('Confira os detalhes antes de autorizar cada transação na carteira.');
    }catch(e){setError(messageFrom(e));}
    finally{setWorking(false);}
  }

  async function confirmStep(){
    if(!status?.pilotEnabled||!prepared||pending||working)return;
    setWorking(true);setError('');
    try{
      const wallet=walletFor(prepared.walletAddress);
      const steps=assertPilotQuote(prepared,wallet.address);
      // Customer explicitly authorizes exactly ONE step per click.
      const step=steps[0];
      const provider=await walletProvider(wallet);
      const hash=await sendOneAavePilotStep(provider,prepared,wallet.address,0);
      setLastHash(hash);
      setPrepared(null);
      setPending({hash,kind:step.kind,to:step.to,owner:wallet.address});
      setNotice('Transação enviada. Não repita enquanto a blockchain confirma.');
    }catch(e){setError(messageFrom(e));}
    finally{setWorking(false);}
  }

  async function checkReceipt(){
    if(!pending||working)return;
    setWorking(true);setError('');
    try{
      const wallet=walletFor(pending.owner);
      const provider=await walletProvider(wallet);
      const outcome=await inspectAavePilotReceipt(provider,pending.hash,pending.owner,pending.to);
      if(outcome==='pending'){
        setNotice('Ainda aguardando confirmação na Polygon. Não envie novamente.');
      }else if(outcome==='failed'){
        setPending(null);
        setNotice('A blockchain recusou a transação. O gás gasto pode não ser recuperado.');
      }else {
        const kind=pending.kind;
        setPending(null);
        setNotice(kind==='APPROVAL'
          ? 'Autorização limitada confirmada. Revise novamente antes de aplicar USDC.'
          : kind==='SUPPLY'
            ? 'Depósito Aave confirmado na Polygon. Atualize sua posição para visualizar aTokens.'
            : 'Retirada Aave confirmada na Polygon. O USDC retornou para sua carteira.');
      }
    }catch(e){setError(messageFrom(e));}
    finally{setWorking(false);}
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>NEXA · AAVE V3 · POLYGON</Text>
      <Text style={styles.title}>Use sua própria carteira</Text>
      <Text style={styles.body}>Aplicar USDC e retirar da Aave, quando seu acesso estiver autorizado. Você confirma cada transação na Privy. A Nexa não recebe seus fundos.</Text>
      {loading?<ActivityIndicator color={colors.cyan}/>:null}
      <View style={styles.card}>
        <Text style={styles.head}>Disponibilidade</Text>
        <Text style={styles.body}>{status?.pilotEnabled
          ? 'Piloto de carteira habilitado para esta conta.'
          : status?.message||'A movimentação Aave ainda não está habilitada para esta conta.'}</Text>
        <Text style={styles.sub}>Crédito e amortização ainda não disponíveis.</Text>
      </View>
      {status?.pilotEnabled?(
        <View style={styles.card}>
          <Text style={styles.head}>Qual operação deseja fazer?</Text>
          <View style={styles.row}>
            <Pressable style={[styles.choice,action==='SUPPLY'&&styles.selected]}
              onPress={()=>{setAction('SUPPLY');clearPlan();}} disabled={working||!!pending}>
              <Text style={styles.choiceText}>Aplicar USDC</Text>
            </Pressable>
            <Pressable style={[styles.choice,action==='WITHDRAW'&&styles.selected]}
              onPress={()=>{setAction('WITHDRAW');clearPlan();}} disabled={working||!!pending}>
              <Text style={styles.choiceText}>Retirar USDC</Text>
            </Pressable>
          </View>
          <Text style={styles.sub}>Quantidade em USDC (piloto: 1 a 100 por solicitação)</Text>
          <TextInput style={styles.field} value={amount}
            keyboardType="decimal-pad" placeholder="1,00" placeholderTextColor="#8AA1BA"
            editable={!working&&!pending}
            onChangeText={value=>{setAmount(value);clearPlan();}}/>
          <Pressable style={styles.checkboxRow}
            disabled={working||!!pending}
            onPress={()=>{setConsent(v=>!v);clearPlan();}}>
            <Text style={styles.checkbox}>{consent?'☑':'☐'}</Text>
            <Text style={styles.sub}>Entendo que há risco de perda, falhas de contratos, taxa variável, gas POL e possíveis restrições de liquidez.</Text>
          </Pressable>
          <Pressable style={[styles.button,(!consent||working||!!pending)&&styles.disabled]}
            disabled={!consent||working||!!pending} onPress={prepare}>
            <Text style={styles.buttonText}>{working?'Consultando…':'Revisar operação real'}</Text>
          </Pressable>
        </View>
      ):null}
      {prepared&&status?.pilotEnabled?(
        <View style={styles.card}>
          <Text style={styles.head}>Revise antes de confirmar</Text>
          <Text style={styles.body}>Operação: {prepared.action==='SUPPLY'?'Aplicar':'Retirar'} {asUsdc(prepared.amountBaseUnits)} USDC</Text>
          <Text style={styles.sub}>Carteira: {prepared.walletAddress.slice(0,10)}…{prepared.walletAddress.slice(-6)}</Text>
          <Text style={styles.sub}>Saldo USDC na carteira: {asUsdc(prepared.quote.usdcBalanceUnits)}</Text>
          <Text style={styles.sub}>Posição Aave em aUSDC: {asUsdc(prepared.quote.aUsdcBalanceUnits)}</Text>
          <Text style={styles.sub}>APR variável observado: {prepared.quote.variableSupplyAprBps==null
            ? 'Não disponível':(prepared.quote.variableSupplyAprBps/100).toFixed(2)+'% a.a. (não garantido)'}</Text>
          <Text style={styles.sub}>Etapa atual: {prepared.quote.steps[0]?.kind==='APPROVAL'
            ? 'Aprovar um valor EXATO de USDC para o Pool Aave':'Confirmar transação Aave'}</Text>
          <Text style={styles.warning}>{prepared.warning}</Text>
          <Pressable style={[styles.button,working&&styles.disabled]} disabled={working}
            onPress={confirmStep}>
            <Text style={styles.buttonText}>Confirmar esta etapa na carteira</Text>
          </Pressable>
        </View>
      ):null}
      {pending?(
        <View style={styles.card}>
          <Text style={styles.head}>Confirmação blockchain pendente</Text>
          <Text style={styles.sub}>Hash: {pending.hash.slice(0,14)}…{pending.hash.slice(-8)}</Text>
          <Text style={styles.warning}>Não repita a transação. Aguarde ou confira a confirmação.</Text>
          <Pressable style={[styles.button,working&&styles.disabled]} onPress={checkReceipt} disabled={working}>
            <Text style={styles.buttonText}>Verificar confirmação</Text>
          </Pressable>
        </View>
      ):null}
      {notice?<Text style={styles.notice}>{notice}</Text>:null}
      {error?<Text style={styles.error}>{error}</Text>:null}
      {lastHash&&!pending?<Text style={styles.sub}>Última transação: {lastHash.slice(0,14)}…</Text>:null}
      <Text style={styles.footer}>Aave é um protocolo independente e não garante rendimentos, liquidez ou restituição. A Nexa não executa operações sem confirmação individual na carteira. Nenhum empréstimo está habilitado nesta fase.</Text>
      <Pressable onPress={()=>router.back()} style={styles.link}><Text style={styles.linkText}>Voltar</Text></Pressable>
    </ScrollView>
  );
}
const styles=StyleSheet.create({
  container:{flexGrow:1,padding:22,gap:16,backgroundColor:colors.background},
  eyebrow:{color:colors.cyan,fontSize:12,fontWeight:'800',letterSpacing:1},
  title:{color:colors.text,fontSize:30,fontWeight:'900'},
  body:{color:colors.text,fontSize:15,lineHeight:23},
  sub:{color:'#B4C8DD',fontSize:13,lineHeight:20,flexShrink:1},
  head:{fontSize:18,color:colors.text,fontWeight:'800'},
  card:{gap:12,borderWidth:1,borderColor:'#26465F',backgroundColor:'#0B233B',padding:18,borderRadius:18},
  row:{flexDirection:'row',gap:10},
  choice:{flex:1,alignItems:'center',padding:11,borderWidth:1,borderColor:'#3E5A73',borderRadius:12},
  selected:{borderColor:colors.cyan,backgroundColor:'#134365'},
  choiceText:{color:colors.text,fontWeight:'700',fontSize:13},
  field:{borderColor:'#4A657E',borderWidth:1,borderRadius:12,padding:14,fontSize:18,color:colors.text},
  checkboxRow:{flexDirection:'row',alignItems:'flex-start',gap:8},
  checkbox:{color:colors.cyan,fontSize:24},
  button:{padding:16,alignItems:'center',borderRadius:12,backgroundColor:'#136BEA'},
  disabled:{opacity:.4},
  buttonText:{color:'#FFFFFF',fontWeight:'800'},
  warning:{color:'#F3C86B',fontSize:13,lineHeight:20},
  notice:{color:'#35D69A',fontWeight:'700',lineHeight:20},
  error:{color:'#FF7A8D',fontWeight:'700',lineHeight:20},
  footer:{color:'#AABBD0',fontSize:12,lineHeight:18},
  link:{padding:12,alignSelf:'center'},
  linkText:{color:colors.cyan,fontWeight:'700'},
});
