import { decodeFunctionResult, encodeFunctionData, formatUnits, isAddress } from 'viem';
import type { ExternalEip1193Provider } from './externalWalletProviderProof';

const USDC = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
const ABI = [{
  type:'function',
  name:'balanceOf',
  stateMutability:'view',
  inputs:[{name:'account',type:'address'}],
  outputs:[{name:'balance',type:'uint256'}],
}] as const;

/**
 * Read-only connected wallet balance. The EIP-1193 signer is not asked to send
 * any transaction; results describe the external wallet, not Nexa ledger.
 */
export async function readConnectedExternalUsdc(input: {
  provider: ExternalEip1193Provider;
  address: string;
}) {
  if (!isAddress(input.address)) throw new Error('INVALID_WALLET_ADDRESS');
  const chain = String(await input.provider.request({method:'eth_chainId'})).toLowerCase();
  if (chain !== '0x89' && chain !== '137') throw new Error('POLYGON_REQUIRED');
  const accounts = await input.provider.request({method:'eth_accounts'});
  if (!Array.isArray(accounts) || !accounts.some(a =>
    typeof a === 'string' && a.toLowerCase() === input.address.toLowerCase())) {
    throw new Error('CONNECTED_ACCOUNT_CHANGED');
  }
  const calldata = encodeFunctionData({
    abi: ABI, functionName: 'balanceOf', args:[input.address as `0x${string}`],
  });
  const result = await input.provider.request({method:'eth_call',params:[
    {to:USDC,data:calldata},'latest',
  ]});
  if (typeof result !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(result)) {
    throw new Error('INVALID_USDC_BALANCE_RESPONSE');
  }
  let raw: bigint;
  try {
    raw = decodeFunctionResult({abi:ABI,functionName:'balanceOf',data:result as `0x${string}`});
  } catch {
    throw new Error('INVALID_USDC_BALANCE_RESPONSE');
  }
  // Account/network could have changed while RPC was pending.
  const chainAfter = String(await input.provider.request({method:'eth_chainId'})).toLowerCase();
  const accountsAfter = await input.provider.request({method:'eth_accounts'});
  if ((chainAfter !== '0x89' && chainAfter !== '137') ||
      !Array.isArray(accountsAfter) || !accountsAfter.some(a =>
        typeof a === 'string' && a.toLowerCase() === input.address.toLowerCase())) {
    throw new Error('CONNECTED_ACCOUNT_CHANGED');
  }
  return {
    address:input.address,
    token:USDC,
    chainId:137 as const,
    balanceRaw:raw.toString(),
    balanceUsdc:formatUnits(raw,6),
    walletLocation:'external' as const,
    ledgerCredited:false as const,
    financialAction:false as const,
  };
}
