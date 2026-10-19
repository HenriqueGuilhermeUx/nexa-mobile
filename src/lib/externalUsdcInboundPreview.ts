import { config } from '@/config';
import { decodeFunctionData, parseUnits } from 'viem';

/** Preview-only mobile integration. No sending, signing, custody or crediting. */
export type InboundMarket = 'BR' | 'GLOBAL';
export type ExternalInboundPreview = {
  mode: 'PREVIEW_ONLY';
  recipient: string;
  contractAddress: string;
  chainId: 137;
  asset: 'USDC';
  amount: string;
  backendMaySign: false;
  backendMayBroadcast: false;
  pricing: {
    market: InboundMarket;
    feeBps: 0;
    feeUsdc: string;
    netUsdc: string;
    senderPaysNetworkGas: true;
  };
  transactionRequest: {
    chainId: 137;
    from: string;
    to: string;
    data: string;
    value: string;
  };
};

const USDC_TRANSFER_ABI = [{ type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const POLYGON_NATIVE_USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';

export async function previewExternalUsdcInbound(input: {
  accessToken: string;
  from: string;
  amount: string;
  market: InboundMarket;
}): Promise<ExternalInboundPreview> {
  if (!input.accessToken) throw new Error('AUTH_REQUIRED');
  if (!ADDRESS.test(input.from)) throw new Error('INVALID_EXTERNAL_WALLET');
  if (input.market !== 'BR' && input.market !== 'GLOBAL') throw new Error('UNSUPPORTED_MARKET');
  if (!AMOUNT.test(input.amount) || !/[1-9]/.test(input.amount)) throw new Error('INVALID_USDC_AMOUNT');
  const search = new URLSearchParams({ from: input.from, amount: input.amount, market: input.market });
  const res = await fetch(`${config.apiUrl}/wallet-connect-inbound/preview?${search.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`PREVIEW_UNAVAILABLE_${res.status}`);
  const data: ExternalInboundPreview = await res.json();
  if (data.mode !== 'PREVIEW_ONLY' || data.chainId !== 137 || data.asset !== 'USDC' ||
      !ADDRESS.test(data.recipient) || !ADDRESS.test(data.transactionRequest?.from) ||
      data.transactionRequest.from.toLowerCase() !== input.from.toLowerCase() ||
      data.contractAddress?.toLowerCase() !== POLYGON_NATIVE_USDC ||
      data.transactionRequest?.to?.toLowerCase() !== POLYGON_NATIVE_USDC ||
      data.transactionRequest?.chainId !== 137 || data.transactionRequest.value !== '0x0' ||
      data.backendMayBroadcast !== false || data.backendMaySign !== false ||
      data.pricing?.feeBps !== 0 || data.pricing.market !== input.market ||
      data.amount !== input.amount || data.pricing.netUsdc !== input.amount) {
    throw new Error('UNTRUSTED_INBOUND_PREVIEW');
  }
  try {
    const decoded = decodeFunctionData({ abi: USDC_TRANSFER_ABI, data: data.transactionRequest.data as `0x${string}` });
    if (decoded.functionName !== 'transfer' ||
        decoded.args[0].toLowerCase() !== data.recipient.toLowerCase() ||
        decoded.args[1] !== parseUnits(input.amount, 6)) throw new Error('UNTRUSTED_INBOUND_PREVIEW');
  } catch {
    throw new Error('UNTRUSTED_INBOUND_PREVIEW');
  }
  return data;
}
