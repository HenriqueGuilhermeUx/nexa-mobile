import { config } from '@/config';
import { getAddress, isAddress } from 'viem';

export type ExternalUsdcReceiptObservation = {
  status: 'PENDING' | 'CONFIRMING' | 'CONFIRMED';
  chainId: 137;
  txHash?: string;
  confirmations?: number;
  confirmationsRequired?: number;
  events?: {from:string; recipient:string; amountUsdc:string; eventId:string}[];
  ledgerCredited: false;
  financialAction?: false;
  blockchainSourceOfTruth?: true;
};

/** Read-only; never signs, broadcasts, or changes Nexa ledger. */
export async function observeExternalUsdcReceipt(accessToken:string, txHash:string):
  Promise<ExternalUsdcReceiptObservation> {
  if (!accessToken) throw Error('NEXA_SESSION_REQUIRED');
  const hash=txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw Error('INVALID_POLYGON_TX_HASH');
  const response=await fetch(
    `${config.apiUrl}/wallet-connect-inbound/receive/confirm?txHash=${encodeURIComponent(hash)}`,
    {method:'GET',headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'}},
  );
  if ([403,404,503].includes(response.status)) throw Error('RECEIVE_PILOT_UNAVAILABLE');
  if (!response.ok) throw Error('RECEIPT_OBSERVATION_FAILED');
  const data=await response.json();
  if (data?.ledgerCredited!==false || data?.chainId!==137 ||
      !['PENDING','CONFIRMING','CONFIRMED'].includes(data?.status))
    throw Error('UNTRUSTED_RECEIPT_OBSERVATION');
  if (data.status==='PENDING')
    return {status:'PENDING',chainId:137,ledgerCredited:false};
  if (data?.financialAction!==false || data?.blockchainSourceOfTruth!==true ||
      String(data?.txHash||'').toLowerCase()!==hash.toLowerCase() ||
      !Number.isSafeInteger(data?.confirmations) ||
      !Number.isSafeInteger(data?.confirmationsRequired) ||
      data.confirmations<0 || data.confirmationsRequired<12 ||
      !Array.isArray(data?.events) || !data.events.length || data.events.length>100)
    throw Error('UNTRUSTED_RECEIPT_OBSERVATION');
  const seenEventIds = new Set<string>();
  const events=data.events.map((item:any)=>{
    const eventId=String(item?.eventId||'');
    const logIndex=eventId.split(':')[2];
    if (!isAddress(item?.from)||!isAddress(item?.recipient)||
        !/^\d+(?:\.\d{1,6})?$/.test(String(item?.amountUsdc||''))||
        eventId !== `137:${hash.toLowerCase()}:${logIndex}` ||
        !/^\d+$/.test(logIndex||'') || !Number.isSafeInteger(Number(logIndex)) ||
        String(Number(logIndex)) !== logIndex ||
        !/[^0.]/.test(String(item.amountUsdc)) || seenEventIds.has(eventId))
      throw Error('UNTRUSTED_RECEIPT_EVENT');
    seenEventIds.add(eventId);
    return {from:getAddress(item.from),recipient:getAddress(item.recipient),
      amountUsdc:String(item.amountUsdc),eventId};
  });
  if ((data.status==='CONFIRMED') !== (data.confirmations>=data.confirmationsRequired))
    throw Error('UNTRUSTED_CONFIRMATION_STATUS');
  return {status:data.status,chainId:137,txHash:hash.toLowerCase(),
    confirmations:data.confirmations,confirmationsRequired:data.confirmationsRequired,
    events,ledgerCredited:false,financialAction:false,blockchainSourceOfTruth:true};
}
