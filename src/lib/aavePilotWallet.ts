import { encodeFunctionData, parseAbi, getAddress } from 'viem';

/**
 * Privy EIP-1193 signer for authenticated Nexa Polygon Aave native USDC.
 * Each call is explicitly approved by the customer in the wallet UI.
 * No automatic retries, third-party beneficiary, server signer or limitless
 * ERC20 allowance. The server pilot flag is OFF unless approved separately.
 */
export const PILOT_CHAIN_ID = 137;
export const PILOT_USDC = getAddress('0x3c499c542cef5e3811e1192ce70d8cC03d5c3359');
export const PILOT_POOL = getAddress('0x794a61358D6845594F94dc1DB02A252b5b4814aD');
const TOKEN_ABI = parseAbi(['function approve(address spender,uint256 amount) returns (bool)']);
const POOL_ABI = parseAbi([
  'function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)',
  'function withdraw(address asset,uint256 amount,address to) returns (uint256)',
]);
const HASH=/^0x[a-fA-F0-9]{64}$/;
const HEX=/^0x(?:[a-fA-F0-9]{2})*$/;
const MAX=100_000_000n;
const MIN=1_000_000n;
export type PilotAction = 'SUPPLY' | 'WITHDRAW';
export type PilotKind = 'APPROVAL' | PilotAction;
export type PilotStep = {
  kind: PilotKind;
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  requiresExplicitWalletConfirmation: true;
};
export type PilotQuote = {
  success: true;
  mode: 'USER_SIGNED_AAVE_PILOT';
  transactionPrepared: true;
  transactionSent: false;
  executionEnabledOnServer: false;
  requiresExplicitWalletConfirmation: true;
  action: PilotAction;
  amountBaseUnits: string;
  walletAddress: string;
  chainId: number;
  expiresAt: string;
  quote: {steps: PilotStep[]};
};
export interface PilotProvider {
  request(args: {method:string; params?: unknown[]}): Promise<unknown>;
}

function exactData(step: PilotStep, quote: PilotQuote): string {
  const amount=BigInt(quote.amountBaseUnits);
  const owner=getAddress(quote.walletAddress);
  if(step.kind==='APPROVAL') {
    return encodeFunctionData({abi:TOKEN_ABI,functionName:'approve',args:[PILOT_POOL,amount]});
  }
  if(step.kind==='SUPPLY') {
    return encodeFunctionData({abi:POOL_ABI,functionName:'supply',
      args:[PILOT_USDC,amount,owner,0]});
  }
  if(step.kind==='WITHDRAW') {
    return encodeFunctionData({abi:POOL_ABI,functionName:'withdraw',
      args:[PILOT_USDC,amount,owner]});
  }
  throw new Error('Operação Aave não reconhecida');
}

export function assertPilotQuote(quote: PilotQuote, activeWallet: string): PilotStep[] {
  if(!quote || quote.success!==true || quote.mode!=='USER_SIGNED_AAVE_PILOT' ||
    quote.transactionPrepared!==true || quote.transactionSent!==false ||
    quote.executionEnabledOnServer!==false ||
    quote.requiresExplicitWalletConfirmation!==true ||
    quote.chainId!==137 || !['SUPPLY','WITHDRAW'].includes(quote.action)) {
    throw new Error('Plano Aave não autorizado');
  }
  let owner:string, active:string, amount:bigint;
  try {
    owner=getAddress(quote.walletAddress);
    active=getAddress(activeWallet);
    amount=BigInt(quote.amountBaseUnits);
  } catch {
    throw new Error('Carteira ou quantidade Aave inválida');
  }
  if(owner!==active || amount<MIN || amount>MAX ||
    !/^[1-9][0-9]*$/.test(quote.amountBaseUnits)) {
    throw new Error('Carteira ou limite de USDC diferente do autorizado');
  }
  const deadline=new Date(quote.expiresAt).getTime();
  if(!Number.isFinite(deadline) || deadline<=Date.now() ||
    deadline-Date.now()>35_000) throw new Error('Condições Aave expiradas; revise novamente');
  if(!Array.isArray(quote.quote?.steps)) throw new Error('Nenhuma transação Aave preparada');
  const steps=quote.quote.steps;
  const expectedKinds=quote.action==='WITHDRAW'?['WITHDRAW']:
    (steps.length===2?['APPROVAL','SUPPLY']:['SUPPLY']);
  if(steps.length!==expectedKinds.length) throw new Error('Sequência Aave não reconhecida');

  steps.forEach((step,i)=>{
    if(!step || step.kind!==expectedKinds[i] ||
      step.requiresExplicitWalletConfirmation!==true ||
      step.chainId!==PILOT_CHAIN_ID ||
      getAddress(step.from)!==active ||
      getAddress(step.to)!==(step.kind==='APPROVAL'?PILOT_USDC:PILOT_POOL) ||
      step.value!=='0x0' || !HEX.test(step.data) ||
      step.data.toLowerCase()!==exactData(step,quote).toLowerCase()) {
      throw new Error('Contrato, destinatário ou dados Aave diferentes do autorizado');
    }
  });
  return steps;
}

/**
 * Request a single wallet-confirmed transaction. The caller MUST show a
 * separate confirmation screen for each step, never send sequentially here.
 */
export async function sendOneAavePilotStep(
  provider: PilotProvider,
  quote: PilotQuote,
  activeWallet: string,
  stepIndex: number,
): Promise<string> {
  const steps=assertPilotQuote(quote,activeWallet);
  if(!Number.isInteger(stepIndex) || stepIndex<0 || stepIndex>=steps.length) {
    throw new Error('Etapa Aave inválida');
  }
  const step=steps[stepIndex];
  const activeChain=String(await provider.request({method:'eth_chainId',params:[]})).toLowerCase();
  if(activeChain!=='0x89' && activeChain!=='137') {
    throw new Error('Conecte a carteira à rede Polygon antes de confirmar');
  }
  // One eth_sendTransaction per explicit user gesture. Never sign keys on server.
  const hash=await provider.request({
    method:'eth_sendTransaction',
    params:[{from:activeWallet,to:step.to,data:step.data,value:'0x0'}],
  });
  if(typeof hash!=='string'||!HASH.test(hash)) throw new Error('A carteira não retornou hash válido');
  return hash;
}

/**
 * Bounded finality observation. A null result means still pending, not a
 * failed transaction or approval to send another transaction.
 */
export async function inspectAavePilotReceipt(
  provider: PilotProvider,
  hash: string,
  expectedFrom: string,
  expectedTo: string,
): Promise<'confirmed'|'pending'|'failed'> {
  if(!HASH.test(hash)) throw new Error('Hash de transação inválido');
  const data=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});
  if(data==null) return 'pending';
  if(typeof data!=='object'||Array.isArray(data)) throw new Error('Recibo Aave inválido');
  const receipt=data as Record<string,unknown>;
  if(String(receipt.transactionHash||'').toLowerCase()!==hash.toLowerCase()||
     getAddress(String(receipt.from||''))!==getAddress(expectedFrom)||
     getAddress(String(receipt.to||''))!==getAddress(expectedTo)||
     !receipt.blockHash || !HASH.test(String(receipt.blockHash))) {
    throw new Error('Recibo Aave não corresponde à carteira e ao contrato');
  }
  if(receipt.status==='0x1')return 'confirmed';
  if(receipt.status==='0x0')return 'failed';
  throw new Error('Status de transação Aave inválido');
}
