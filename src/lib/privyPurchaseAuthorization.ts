let pendingIdentityToken: { token: string; expiresAt: number } | null = null;

function looksLikeJwt(value: string) {
  return value.split('.').length === 3 && value.length > 40;
}

export function stashPurchaseIdentityToken(token: string, ttlMs = 120_000) {
  const normalized = String(token || '').trim();
  if (!looksLikeJwt(normalized)) {
    throw new Error('PRIVY_IDENTITY_TOKEN_INVALID');
  }
  pendingIdentityToken = {
    token: normalized,
    expiresAt: Date.now() + Math.max(15_000, ttlMs),
  };
}

export function consumePurchaseIdentityToken() {
  const current = pendingIdentityToken;
  pendingIdentityToken = null;
  if (!current || current.expiresAt <= Date.now()) return '';
  return current.token;
}

export function clearPurchaseIdentityToken() {
  pendingIdentityToken = null;
}
