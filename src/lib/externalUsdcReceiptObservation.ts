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

/** Read-only observation. Never submits tx, credits the ledger or treats a
 * connected external address as the Nexa receiving address.
 */
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
  if (data.status==='PENDING') {
    return {status:'PENDING',chainId:137,ledgerCredited:false};
  }
  if (data?.financialAction!==false || data?.blockchainSourceOfTruth!==true ||
      String(data?.txHash||'').toLowerCase()!==hash.toLowerCase() ||
      !Number.isSafeInteger(data?.confirmations) ||
      !Number.isSafeInteger(data?.confirmationsRequired) ||
      data.confirmationsRequired<12 || !Array.isArray(data?.events) ||
      !data.events.length)
    throw Error('UNTRUSTED_RECEIPT_OBSERVATION');
  const events=data.events.map((item:any)=>{
    if (!isAddress(item?.from)||!isAddress(item?.recipient)||
        !/^\d+(?:\.\d{1,6})?$/.test(String(item?.amountUsdc||''))||
        !String(item?.eventId||'').startsWith(`137:${hash.toLowerCase()}:`))
      throw Error('UNTRUSTED_RECEIPT_EVENT');
    return {from:getAddress(item.from),recipient:getAddress(item.recipient),
      amountUsdc:String(item.amountUsdc),eventId:String(item.eventId)};
  });
  if ((data.status==='CONFIRMED') !== (data.confirmations>=data.confirmationsRequired))
    throw Error('UNTRUSTED_CONFIRMATION_STATUS');
  return {status:data.status,chainId:137,txHash:hash.toLowerCase(),
    confirmations:data.confirmations,confirmationsRequired:data.confirmationsRequired,
    events,ledgerCredited:false,financialAction:false,blockchainSourceOfTruth:true};
}
