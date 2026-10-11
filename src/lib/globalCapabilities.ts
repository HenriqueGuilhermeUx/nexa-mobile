import { config } from '@/config';
import {
  type CountryCapabilities,
  nexaApi,
} from '@/lib/api';

export type GlobalCapabilityKey =
  | 'nexaUserTransfer'
  | 'fundUsdc'
  | 'receiveUsdc'
  | 'brazilPix'
  | 'brazilBillPay'
  | 'btc'
  | 'eth'
  | 'paxg'
  | 'buyAssets';

export type GlobalCapabilityContext = {
  countryCode: string;
  capabilities: CountryCapabilities;
};

function active(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'active';
}

export function globalCapabilityEnabled(
  capabilities: CountryCapabilities | null | undefined,
  key: GlobalCapabilityKey,
) {
  if (!capabilities) return false;

  switch (key) {
    case 'nexaUserTransfer':
      return active(capabilities.utilities?.nexaUserTransfer);
    case 'fundUsdc':
      return (
        active(capabilities.funding?.card) ||
        active(capabilities.funding?.applePay) ||
        active(capabilities.funding?.googlePay)
      );
    case 'receiveUsdc':
      return (
        active(capabilities.funding?.externalUsdc) ||
        active(capabilities.stablecoins?.usdc)
      );
    case 'brazilPix':
      return active(capabilities.utilities?.brazilPix);
    case 'brazilBillPay':
      return active(capabilities.utilities?.brazilBillPay);
    case 'btc':
      return active(capabilities.utilities?.btc);
    case 'eth':
      return active(capabilities.utilities?.eth);
    case 'paxg':
      return active(capabilities.utilities?.paxg);
    case 'buyAssets':
      return (
        active(capabilities.utilities?.btc) ||
        active(capabilities.utilities?.eth) ||
        active(capabilities.utilities?.paxg)
      );
    default:
      return false;
  }
}

export async function loadGlobalCapabilityContext(
  accessToken: string,
): Promise<GlobalCapabilityContext | null> {
  if (!config.globalProduct) return null;

  const profile = await nexaApi.me(accessToken);
  const countryCode = String(profile?.residenceCountry || '')
    .trim()
    .toUpperCase();

  if (!countryCode) {
    throw new Error(
      'Não foi possível confirmar seu país de residência. Atualize seu cadastro antes de usar esta função.',
    );
  }

  const capabilities = await nexaApi.countryCapabilities(countryCode);
  return { countryCode, capabilities };
}

export async function assertGlobalCapability(
  accessToken: string,
  key: GlobalCapabilityKey,
) {
  if (!config.globalProduct) return null;

  const context = await loadGlobalCapabilityContext(accessToken);
  if (!context || !globalCapabilityEnabled(context.capabilities, key)) {
    throw new Error(
      'Esta função ainda não está disponível para seu país ou perfil na Nexa Global.',
    );
  }

  return context;
}
