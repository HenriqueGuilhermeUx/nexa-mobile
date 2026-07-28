import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { registerRootComponent } from 'expo';
import PrivyRoot from './PrivyRoot';

const CURRENT_VERSION = '1.4.7';
const API_HOST = 'nexa-backend-p2u0.onrender.com';
const nativeFetch = global.fetch;

global.fetch = function nexaFetch(resource, options = {}) {
  const url = typeof resource === 'string' ? resource : String(resource?.url || '');

  if (!url.includes(API_HOST)) {
    return nativeFetch(resource, options);
  }

  const headers = {
    ...(options.headers || {}),
    'X-Nexa-App-Version': CURRENT_VERSION,
    'X-Nexa-Platform': 'android',
  };

  return nativeFetch(resource, {
    ...options,
    headers,
  });
};

registerRootComponent(PrivyRoot);
