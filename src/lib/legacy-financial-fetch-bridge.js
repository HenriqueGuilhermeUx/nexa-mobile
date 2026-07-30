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
 * A experiência visual legada continua intacta, mas os dois pedidos de saque
 * deixam de usar a antiga fila paralela. A cotação recebe autenticação e a
 * confirmação é enviada diretamente para /payment/pix/redemption.
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
    const isPixRequest = url.includes('/withdrawal/pix-request');

    if (!isPixQuote && !isPixRequest) {
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
    const targetUrl = url.replace(
      '/withdrawal/pix-request',
      '/payment/pix/redemption',
    );
    const response = await originalFetch(targetUrl, {
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
