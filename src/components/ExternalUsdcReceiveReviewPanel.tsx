import React, {useEffect, useRef, useState} from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/theme';
import { validateReownExternalConnection } from '@/lib/reownConnectedWalletBridge';
import {
  getReviewedExternalUsdcTransfer, getVerifiedNexaReceiveDestination,
  type ReviewedExternalUsdcTransfer,
} from '@/lib/externalUsdcReceivePreview';
import type { ExternalEip1193Provider } from '@/lib/externalWalletProviderProof';
import {observeExternalUsdcReceipt, type ExternalUsdcReceiptObservation} from '@/lib/externalUsdcReceiptObservation';

/** Financially inert: validates Privy receiver and server-supplied ERC20 calldata. */
export function ExternalUsdcReceiveReviewPanel(props: {
  accessToken: string; address: string; provider: ExternalEip1193Provider;
  market: 'BR'|'GLOBAL';
}) {
  const [amount,setAmount]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [review,setReview]=useState<ReviewedExternalUsdcTransfer|null>(null);
  const [txHash,setTxHash]=useState('');
  const [receipt,setReceipt]=useState<ExternalUsdcReceiptObservation|null>(null);
  const [receiptBusy,setReceiptBusy]=useState(false);
  const [receiptError,setReceiptError]=useState('');
  const epoch=useRef(0);
  useEffect(()=>{
    epoch.current++;
    setReview(null);
    setReceipt(null);
    setTxHash('');
    setReceiptError('');
    setReceiptBusy(false);
    setError('');
    setAmount('');
    setBusy(false);
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
  async function checkReceipt() {
    const request=++epoch.current;
    setReceipt(null);setReceiptError('');setReceiptBusy(true);
    try {
      const result=await observeExternalUsdcReceipt(props.accessToken,txHash);
      if (result.status !== 'PENDING') {
        const destination=await getVerifiedNexaReceiveDestination(props.accessToken);
        const matched=result.events?.some(event =>
          event.recipient.toLowerCase() === destination.walletAddress.toLowerCase());
        if (!matched) throw Error('RECEIPT_NOT_FOR_YOUR_NEXA_WALLET');
      }
      if(request===epoch.current) setReceipt(result);
    } catch(e) {
      if(request===epoch.current) setReceiptError(e instanceof Error && e.message==='RECEIVE_PILOT_UNAVAILABLE'
        ? 'A conferência do comprovante ainda não está liberada para esta conta QA.'
        : e instanceof Error ? e.message : 'Não foi possível conferir este comprovante.');
    } finally {if(request===epoch.current) setReceiptBusy(false);}
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
        editable={!busy}
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
      <View style={{borderTopWidth:1,borderColor:colors.border,paddingTop:12,gap:8}}>
        <Text style={{color:colors.text,fontWeight:'800'}}>Verificar recebimento já realizado</Text>
        <Text style={{color:colors.muted,fontSize:12}}>
          Informe um hash Polygon existente. A consulta não inicia transferências nem credita saldo.
        </Text>
        <TextInput accessibilityLabel="Hash Polygon da transação"
          value={txHash} autoCapitalize="none" autoCorrect={false}
          placeholder="0x... (66 caracteres)" placeholderTextColor={colors.mutedStrong}
          editable={!receiptBusy} onChangeText={v=>{epoch.current++;setTxHash(v);setReceipt(null);setReceiptError('');}}
          style={{color:colors.text,borderRadius:9,borderWidth:1,borderColor:colors.border,padding:12}} />
        <Pressable accessibilityRole="button"
          disabled={receiptBusy||!/^0x[a-fA-F0-9]{64}$/.test(txHash)}
          onPress={()=>{void checkReceipt();}}
          style={{backgroundColor:colors.elevated,padding:14,borderRadius:9}}>
          <Text style={{color:colors.text,textAlign:'center',fontWeight:'800'}}>Conferir hash (somente leitura)</Text>
        </Pressable>
        {receiptBusy?<ActivityIndicator accessibilityLabel="Conferindo blockchain" />:null}
        {receipt?<Text style={{color:receipt.status==='CONFIRMED'?colors.success:colors.warning}}>
          {receipt.status==='CONFIRMED'?'Confirmado on-chain':receipt.status==='CONFIRMING'?'Em confirmação':'Pendente'}.
          {' '}Não significa crédito em ledger Nexa.
        </Text>:null}
        {receiptError?<Text accessibilityRole="alert" style={{color:colors.danger}}>{receiptError}</Text>:null}
      </View>
    </View>
  );
}
