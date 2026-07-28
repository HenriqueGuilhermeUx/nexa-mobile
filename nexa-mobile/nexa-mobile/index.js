import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { registerRootComponent } from 'expo';
import PrivyRoot from './PrivyRoot';

const CURRENT_VERSION = '1.4.7';
const API_HOST = 'nexa-backend-p2u0.onrender.com';
const API_BASE = 'https://' + API_HOST + '/api/v1';
const nativeFetch = global.fetch;

const settlementProfilesByUserId = new Map();
global.__nexaSettlementProfilesByUserId = settlementProfilesByUserId;
global.__nexaSettlementProfile = null;

function requestUrl(resource) {
  return typeof resource === 'string' ? resource : String(resource?.url || '');
}

function requestMethod(resource, options) {
  return String(options?.method || resource?.method || 'GET').toUpperCase();
}

function buildHeaders(resource, options, extraHeaders = {}) {
  const headers = new Headers(resource?.headers || undefined);
  const suppliedHeaders = new Headers(options?.headers || undefined);
  suppliedHeaders.forEach((value, name) => headers.set(name, value));
  headers.set('X-Nexa-App-Version', CURRENT_VERSION);
  headers.set('X-Nexa-Platform', 'android');
  Object.entries(extraHeaders).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      headers.set(name, String(value));
    }
  });
  return headers;
}

function responseJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function parseBody(body) {
  if (typeof body !== 'string') return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function isAuthEndpoint(url, method) {
  return (
    method === 'POST' &&
    (url.endsWith('/auth/login') || url.endsWith('/auth/register'))
  );
}

async function classifyAuthenticatedSession(authResponse) {
  try {
    if (!authResponse?.ok) return;
    const authData = await authResponse.clone().json();
    const accessToken = String(authData?.accessToken || '').trim();
    const userId = String(authData?.user?.id || '').trim();
    if (!accessToken || !userId) return;

    const profileResponse = await nativeFetch(
      API_BASE + '/direct-settlement/profile',
      {
        method: 'GET',
        headers: buildHeaders(null, null, {
          Authorization: 'Bearer ' + accessToken,
        }),
      },
    );
    const profileData = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profileData?.profile) return;

    settlementProfilesByUserId.set(userId, profileData.profile);
    global.__nexaSettlementProfile = profileData.profile;
  } catch {
    // Perfil desconhecido permanece bloqueado para criação de carteira gerenciada.
  }
}

function managedWalletCreationDecision(options) {
  const body = parseBody(options?.body);
  const userId = String(body?.userId || '').trim();
  const profile =
    settlementProfilesByUserId.get(userId) || global.__nexaSettlementProfile;

  if (profile?.isLegacyBeta || profile?.settlementProfile === 'legacy_beta') {
    return { allow: true, profile };
  }

  return { allow: false, profile: profile || null };
}

global.fetch = async function nexaFetch(resource, options = {}) {
  const url = requestUrl(resource);
  const method = requestMethod(resource, options);

  if (!url.includes(API_HOST)) {
    return nativeFetch(resource, options);
  }

  if (method === 'POST' && url.endsWith('/wallet/create')) {
    const decision = managedWalletCreationDecision(options);
    if (!decision.allow) {
      return responseJson(409, {
        success: false,
        code: 'MANAGED_WALLET_CREATION_BLOCKED',
        message:
          'A criação de carteira gerenciada foi bloqueada para este perfil. Usuários de liquidação direta devem concluir o onboarding Privy.',
      });
    }
  }

  const response = await nativeFetch(resource, {
    ...options,
    headers: buildHeaders(resource, options),
  });

  if (isAuthEndpoint(url, method)) {
    await classifyAuthenticatedSession(response);
  }

  return response;
};

registerRootComponent(PrivyRoot);
