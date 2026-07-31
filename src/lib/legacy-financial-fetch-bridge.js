let activeRestore = null;

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
    const isPixQuote = url.includes('/withdrawal/pix-quote');
    const isOfficialPixRequest = url.includes('/payment/pix/redemption');
    const isInternalTransfer = url.includes(
      '/internal-transfer/send-by-username',
    );

    if (!isPixQuote && !isOfficialPixRequest && !isInternalTransfer) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
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
