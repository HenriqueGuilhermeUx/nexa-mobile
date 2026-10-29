import React, {useEffect, useRef, useState} from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/theme';
import { validateReownExternalConnection } from '@/lib/reownConnectedWalletBridge';
import {
  getReviewedExternalUsdcTransfer, getVerifiedNexaReceiveDestination,
  type ReviewedExternalUsdcTransfer,
} from '@/lib/externalUsdcReceivePreview';
import type { ExternalEip1193Provider } from '@/lib/externalWalletProviderProof';

/** Financially inert: validates Privy receiver and server-supplied ERC20 calldata. */
export function ExternalUsdcReceiveReviewPanel(props: {
  accessToken: string; address: string; provider: ExternalEip1193Provider;
  market: 'BR'|'GLOBAL';
}) {
  const [amount,setAmount]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [review,setReview]=useState<ReviewedExternalUsdcTransfer|null>(null);
  const epoch=useRef(0);
  useEffect(()=>{
    epoch.current++;
    setReview(null);
    setError('');
    setAmount('');
    return ()=>{epoch.current++;};
  },[props.accessToken,props.address,props.provider,props.market]);
  async function requestPreview() {
    if (busy) return;
    const current=++epoch.current;
    setReview(null);setError('');setBusy(true);
    try {
      const initial=await validateReownExternalConnection({
        address:props.address,provider:props.provider,
      });
      const destination=await getVerifiedNexaReceiveDestination(props.accessToken);
      const result=await getReviewedExternalUsdcTransfer({
        accessToken:props.accessToken,sourceAddress:initial.address,
        destination,amountUsdc:amount.trim().replace(',','.'),
        market:props.market,
      });
      const finalCheck=await validateReownExternalConnection({
        address:props.address,provider:props.provider,
      });
      if (finalCheck.address.toLowerCase()!==initial.address.toLowerCase() ||
          finalCheck.provider!==initial.provider) {
        throw Error('WALLET_CHANGED_DURING_REVIEW');
      }
      if(current===epoch.current) setReview(result);
    } catch(e) {
      if(current===epoch.current) setError(e instanceof Error ?
        (e.message==='RECEIVE_PILOT_UNAVAILABLE'
          ? 'O backend de recebimento está indisponível ou sua conta não foi habilitada neste piloto.'
          : e.message) : 'Não foi possível preparar esta consulta.');
    } finally {
      if(current===epoch.current) setBusy(false);
    }
  }
  return (
    <View style={{gap:10,padding:14,borderWidth:1,borderRadius:12,
      borderColor:colors.borderStrong,backgroundColor:colors.panel}}>
      <Text style={{color:colors.text,fontWeight:'800',fontSize:17}}>
        Trazer USDC para a Nexa — revisão
      </Text>
      <Text style={{color:colors.muted,fontSize:13}}>
        Consulta autenticada do destino Privy e da instrução USDC Polygon.
        Nenhuma assinatura nem transferência é executada aqui.
      </Text>
      <TextInput accessibilityLabel="Quantidade USDC para revisão"
        keyboardType="decimal-pad" placeholder="Ex.: 2,50 USDC"
        placeholderTextColor={colors.mutedStrong}
        value={amount} onChangeText={v=>{epoch.current++;setAmount(v);setReview(null);setError('');}}
        style={{borderRadius:9,borderWidth:1,borderColor:colors.border,
          color:colors.text,padding:12}} />
      <Pressable accessibilityRole="button" disabled={busy}
        onPress={()=>{void requestPreview();}}
        style={{backgroundColor:colors.primary,padding:14,borderRadius:9,opacity:busy?0.5:1}}>
        <Text style={{color:colors.text,textAlign:'center',fontWeight:'800'}}>
          Conferir recebimento (não transfere)
        </Text>
      </Pressable>
      {busy?<ActivityIndicator accessibilityLabel="Conferindo endereço Nexa" />:null}
      {review?(
        <View style={{gap:5}}>
          <Text style={{color:colors.success,fontWeight:'700'}}>Prévia conferida com o backend QA</Text>
          <Text selectable style={{color:colors.text}}>Origem: {review.transactionRequest.from}</Text>
          <Text selectable style={{color:colors.text}}>Destino Privy auditado: {review.recipient}</Text>
          <Text style={{color:colors.text}}>Rede Polygon · USDC {review.amount} · Taxa Nexa 0%</Text>
          <Text style={{color:colors.warning}}>
            Apenas revisão: ainda não envie fundos. A etapa de assinatura e confirmação on-chain
            depende da homologação do fluxo completo.
          </Text>
        </View>
      ):null}
      {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
    </View>
  );
}
