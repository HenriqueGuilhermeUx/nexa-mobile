import { Linking, Platform } from 'react-native';

import { config } from '@/config';
import { nexaApi } from '@/lib/api';

export type NexaEcosystemProduct = 'docwallet' | 'healthwallet';

const PRODUCT_URLS: Record<NexaEcosystemProduct, () => string> = {
  docwallet: () => config.docWalletUrl,
  healthwallet: () => config.healthWalletUrl,
};

const PRODUCT_ENABLED: Record<NexaEcosystemProduct, () => boolean> = {
  docwallet: () => config.docWalletEnabled,
  healthwallet: () => config.healthWalletEnabled,
};

const PRODUCT_DOWNLOAD_URLS: Record<
  NexaEcosystemProduct,
  { android: () => string; ios: () => string }
> = {
  docwallet: {
    android: () => config.docWalletPlayStoreUrl,
    ios: () => config.docWalletAppStoreUrl,
  },
  healthwallet: {
    android: () => config.healthWalletPlayStoreUrl,
    ios: () => config.healthWalletAppStoreUrl,
  },
};

export function ecosystemProductEnabled(product: NexaEcosystemProduct) {
  return config.ecosystemEnabled && PRODUCT_ENABLED[product]();
}

function appendNexaToken(baseUrl: string, token: string) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}nexaToken=${encodeURIComponent(token)}&source=nexa`;
}

export async function openNexaEcosystemProduct(
  accessToken: string,
  product: NexaEcosystemProduct,
) {
  if (!ecosystemProductEnabled(product)) {
    throw new Error('Este produto ainda não está habilitado no ecossistema Nexa.');
  }

  const response = await nexaApi.createNexaIdAccessToken(accessToken);
  const token = String(response?.token || '').trim();

  if (response?.success !== true || !token) {
    throw new Error(
      response?.message || 'Não foi possível criar o acesso seguro com Nexa ID.',
    );
  }

  const url = appendNexaToken(PRODUCT_URLS[product](), token);
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('Não foi possível abrir este produto agora.');
  }

  await Linking.openURL(url);
}


export function ecosystemDownloadAvailable(product: NexaEcosystemProduct) {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  return Boolean(PRODUCT_DOWNLOAD_URLS[product][platform]());
}

export async function downloadNexaEcosystemProduct(product: NexaEcosystemProduct) {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const url = String(PRODUCT_DOWNLOAD_URLS[product][platform]() || '').trim();

  if (!url) {
    throw new Error(
      platform === 'ios'
        ? 'O link da App Store ainda não está disponível para este app.'
        : 'O link da loja ainda não está disponível para este app.',
    );
  }

  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('Não foi possível abrir a loja de aplicativos agora.');
  }

  await Linking.openURL(url);
}
