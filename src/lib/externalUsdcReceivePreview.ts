import { config } from '@/config';
import { decodeFunctionData, getAddress, isAddress, parseUnits } from 'viem';

const NATIVE_POLYGON_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const ERC20_TRANSFER = [{
  type: 'function',
  name: 'transfer',
  stateMutability: 'nonpayable',
  inputs: [{name:'to',type:'address'},{name:'value',type:'uint256'}],
  outputs: [{name:'success',type:'bool'}],
}] as const;

export type VerifiedNexaReceiveDestination = {
  walletAddress: string;
  chainId: 137;
  asset: 'USDC';
  feeBps: 0;
  source: 'LIVE_PRIVY_USER_AND_WALLET_AUDIT';
  financialAction: false;
  ledgerCredited: false;
};

export type ReviewedExternalUsdcTransfer = {
  mode: 'PREVIEW_ONLY';
  recipient: string;
  amount: string;
  pricing: { feeBps: 0; feeUsdc: string; netUsdc: string; market: 'BR'|'GLOBAL' };
  transactionRequest: {chainId: 137; from: string; to: string; data: string; value: '0x0'};
  financialAction: false;
};

function assertAccount(value: unknown): string {
  if (typeof value !== 'string' || !isAddress(value)) throw Error('INVALID_EVM_WALLET');
  return getAddress(value);
}
function assertUsdcAmount(value: string) {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(value) ||
      parseUnits(value, 6) <= 0n) throw Error('USDC_AMOUNT_MUST_HAVE_AT_MOST_SIX_DECIMALS');
  return value;
}
async function receiveGet(accessToken: string, suffix: string): Promise<any> {
  if (!accessToken) throw Error('NEXA_SESSION_REQUIRED');
  // The app's existing authenticated API base is the only destination.
  const response = await fetch(`${config.apiUrl}/wallet-connect-inbound/${suffix}`, {
    method: 'GET', headers: {Authorization:`Bearer ${accessToken}`,Accept:'application/json'},
  });
  if (response.status === 403 || response.status === 404 || response.status === 503) {
    throw Error('RECEIVE_PILOT_UNAVAILABLE');
  }
  if (!response.ok) throw Error('RECEIVE_API_REQUEST_FAILED');
  return response.json();
}

/** Only accept a destination freshly verified against the logged-in user by Privy. */
export async function getVerifiedNexaReceiveDestination(accessToken: string):
  Promise<VerifiedNexaReceiveDestination> {
  const response = await receiveGet(accessToken, 'receive');
  const walletAddress = assertAccount(response?.walletAddress);
  if (response?.chainId !== 137 || response?.asset !== 'USDC' ||
      response?.source !== 'LIVE_PRIVY_USER_AND_WALLET_AUDIT' ||
      response?.feeBps !== 0 || response?.financialAction !== false ||
      response?.ledgerCredited !== false ||
      getAddress(String(response?.contractAddress || '')) !== getAddress(NATIVE_POLYGON_USDC)) {
    throw Error('UNTRUSTED_NEXA_RECEIVER');
  }
  return {walletAddress,chainId:137,asset:'USDC',feeBps:0,
    source:'LIVE_PRIVY_USER_AND_WALLET_AUDIT',financialAction:false,ledgerCredited:false};
}

/**
 * Validates the server's preview against the CURRENT external account and
 * the fresh Privy-verified destination. Returns a review object, not a signer.
 * This function NEVER calls an EVM provider or broadcasts anything.
 */
export async function getReviewedExternalUsdcTransfer(input: {
  accessToken: string; sourceAddress: string; destination: VerifiedNexaReceiveDestination;
  amountUsdc: string; market: 'BR'|'GLOBAL';
}): Promise<ReviewedExternalUsdcTransfer> {
  const from = assertAccount(input.sourceAddress);
  const to = assertAccount(input.destination.walletAddress);
  const amount = assertUsdcAmount(input.amountUsdc);
  if (from.toLowerCase() === to.toLowerCase()) throw Error('SELF_TRANSFER_FORBIDDEN');
  const query = new URLSearchParams({from,amount,market:input.market});
  const r = await receiveGet(input.accessToken, `preview?${query.toString()}`);
  const tx = r?.transactionRequest;
  const pricing = r?.pricing;
  if (r?.mode !== 'PREVIEW_ONLY' || r?.destinationSource !== 'LIVE_PRIVY_USER_AND_WALLET_AUDIT' ||
      r?.chainId !== 137 || r?.asset !== 'USDC' || r?.creditsLedger !== false ||
      r?.backendMaySign !== false || r?.backendMayBroadcast !== false ||
      r?.requiresExternalWalletSignature !== true || r?.recipient !== to ||
      r?.amount !== amount || getAddress(String(r?.contractAddress || '')) !==
        getAddress(NATIVE_POLYGON_USDC) ||
      pricing?.feeBps !== 0 || pricing?.feeUsdc !== '0' ||
      pricing?.netUsdc !== amount || pricing?.market !== input.market ||
      pricing?.mode !== 'PREVIEW_ONLY' ||
      tx?.chainId !== 137 || tx?.value !== '0x0' ||
      assertAccount(tx?.from) !== from ||
      assertAccount(tx?.to) !== getAddress(NATIVE_POLYGON_USDC)) {
    throw Error('UNTRUSTED_INBOUND_PREVIEW');
  }
  let decoded: ReturnType<typeof decodeFunctionData>;
  try {
    decoded = decodeFunctionData({abi:ERC20_TRANSFER,data:tx.data as `0x${string}`});
  } catch { throw Error('UNTRUSTED_ERC20_CALLDATA'); }
  if (decoded.functionName !== 'transfer' ||
      getAddress(String(decoded.args[0])) !== to ||
      decoded.args[1] !== parseUnits(amount, 6)) {
    throw Error('UNTRUSTED_ERC20_CALLDATA');
  }
  return {mode:'PREVIEW_ONLY',recipient:to,amount,pricing:{
    feeBps:0,feeUsdc:'0',netUsdc:amount,market:input.market},
    transactionRequest:{chainId:137,from,to:getAddress(NATIVE_POLYGON_USDC),
      data:tx.data as string,value:'0x0'},financialAction:false};
}
