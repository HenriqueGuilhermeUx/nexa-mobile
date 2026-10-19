import { config } from '@/config';
import { isAddress } from 'viem';

export type DirectUsdcReceipt =
 | {status:'PENDING'; chainId:137; ledgerCredited:false}
 | {status:'CONFIRMING'|'CONFIRMED'; chainId:137; asset:'USDC'; txHash:string;
    confirmations:number; confirmationsRequired:number;
    events: Array<{from:string;recipient:string;amountUsdc:string;amountRaw:string;logIndex:number;eventId:string}>;
    blockchainSourceOfTruth:true; ledgerCredited:false; finalityGuaranteed:false; financialAction:false};

export async function checkDirectUsdcReceipt(input: {
  accessToken:string;
  txHash:string;
  verifiedReceivingWallet:string;
}): Promise<DirectUsdcReceipt> {
  if (!input.accessToken) throw new Error('AUTH_REQUIRED');
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) throw new Error('INVALID_TX_HASH');
  if (!isAddress(input.verifiedReceivingWallet)) throw new Error('INVALID_RECEIVING_WALLET');
  const url=`${config.apiUrl}/wallet-connect-inbound/receive/confirm?txHash=${encodeURIComponent(input.txHash)}`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${input.accessToken}`,Accept:'application/json'}});
  if (!response.ok) throw new Error(`RECEIPT_CHECK_UNAVAILABLE_${response.status}`);
  const json:unknown=await response.json();
  if (!json || typeof json!=='object') throw new Error('UNTRUSTED_RECEIPT_RESULT');
  const result=json as DirectUsdcReceipt;
  if (result.chainId!==137 || result.ledgerCredited!==false ||
      !['PENDING','CONFIRMING','CONFIRMED'].includes(result.status)) throw new Error('UNTRUSTED_RECEIPT_RESULT');
  if (result.status==='PENDING') return result;
  if (result.txHash.toLowerCase()!==input.txHash.toLowerCase() ||
      result.asset!=='USDC' || result.blockchainSourceOfTruth!==true ||
      result.finalityGuaranteed!==false || result.financialAction!==false ||
      !Number.isSafeInteger(result.confirmations) || result.confirmations<1 ||
      !Number.isSafeInteger(result.confirmationsRequired) || result.confirmationsRequired<12 ||
      !Array.isArray(result.events) || result.events.length===0) throw new Error('UNTRUSTED_RECEIPT_RESULT');
  for (const event of result.events) {
    if (!isAddress(event.from) || !isAddress(event.recipient) ||
        event.recipient.toLowerCase()!==input.verifiedReceivingWallet.toLowerCase() ||
        !/^[1-9][0-9]*$/.test(event.amountRaw) || !Number.isSafeInteger(event.logIndex) ||
        event.logIndex<0 || event.eventId!==`137:${input.txHash.toLowerCase()}:${event.logIndex}`) {
      throw new Error('UNTRUSTED_RECEIPT_RESULT');
    }
  }
  if (result.status==='CONFIRMED' && result.confirmations<result.confirmationsRequired) throw new Error('UNTRUSTED_RECEIPT_RESULT');
  return result;
}
