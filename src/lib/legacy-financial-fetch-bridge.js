import Constants from 'expo-constants';
import { Platform } from 'react-native';

let activeRestore = null;

const APP_VERSION = Constants.expoConfig?.version || '2.0.8';
const APP_BUILD = String(Constants.expoConfig?.android?.versionCode || '101');

function asJsonObject(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function responseWithCompatibleJson(response, transform) {
  const originalJson = response.json.bind(response);
  let parsed = false;
  let cached;

  return new Proxy(response, {
    get(target, property) {
      if (property === 'json') {
        return async () => {
          if (!parsed) {
            cached = transform(await originalJson());
            parsed = true;
          }
          return cached;
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * A experiência visual permanece intacta. A camada financeira adiciona o JWT,
 * remove identidades controladas pelo cliente e usa somente filas oficiais.
 * Toda chamada à API Nexa também declara versão, build e plataforma para a
 * política obrigatória de atualização.
 */
export function installLegacyFinancialFetchBridge(accessToken) {
  if (activeRestore) activeRestore();

  const previousFetch = global.fetch;
  const originalFetch = previousFetch.bind(global);

  const bridgedFetch = async (input, init = {}) => {
    const url =
      typeof input === 'string'
        ? input
        : String(input?.url || input || '');
    const isNexaApi =
      url.includes('nexa-backend-p2u0.onrender.com/api/v1') ||
      url.includes('/api/v1/');

    if (!isNexaApi) {
      return originalFetch(input, init);
    }

    const isPixQuote = url.includes('/withdrawal/pix-quote');
    const isOfficialPixRequest = url.includes('/payment/pix/redemption');
    const isInternalTransfer = url.includes(
      '/internal-transfer/send-by-username',
    );

    const headers = new Headers(init.headers || {});
    headers.set('X-Nexa-App-Version', APP_VERSION);
    headers.set('X-Nexa-App-Build', APP_BUILD);
    headers.set('X-Nexa-Platform', Platform.OS);
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    if (!headers.has('Content-Type') && init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    if (!isPixQuote && !isOfficialPixRequest && !isInternalTransfer) {
      return originalFetch(input, { ...init, headers });
    }

    if (isPixQuote) {
      return originalFetch(input, { ...init, headers });
    }

    const legacyBody = asJsonObject(init.body);

    if (isInternalTransfer) {
      return originalFetch(input, {
        ...init,
        headers,
        body: JSON.stringify({
          toUsername: String(legacyBody.toUsername || '').trim(),
          amountUsdc: Number(legacyBody.amountUsdc || 0),
          note: String(legacyBody.note || '').trim() || undefined,
          clientRequestId: String(legacyBody.clientRequestId || '').trim(),
        }),
      });
    }

    const response = await originalFetch(input, {
      ...init,
      headers,
      body: JSON.stringify({
        amountUsdc: Number(legacyBody.amountUsdc || 0),
        pixKey: String(legacyBody.pixKey || '').trim(),
      }),
    });

    return responseWithCompatibleJson(response, (data) => {
      if (!data || data.success !== true) return data;
      const estimatedPayoutBrl = Number(data.estimatedPayoutBrl || 0);
      return {
        ...data,
        status: 'pending',
        referenceId: data.paymentId,
        amountUsdc: Number(data.reservedUsdc || legacyBody.amountUsdc || 0),
        netBrl: estimatedPayoutBrl,
        to: {
          asset: 'BRL',
          netBrl: estimatedPayoutBrl,
        },
        processingDeadlineHours: 24,
        message:
          'Solicitação registrada no painel Nexa. O Pix será processado em até 24 horas após a conciliação.',
      };
    });
  };

  global.fetch = bridgedFetch;

  const restore = () => {
    if (global.fetch === bridgedFetch) global.fetch = previousFetch;
    if (activeRestore === restore) activeRestore = null;
  };
  activeRestore = restore;
  return restore;
}
