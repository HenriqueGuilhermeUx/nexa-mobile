/**
 * Maya Web Actions: read-only price-comparison contract.
 *
 * This module prepares requests and validates displayed quotes. It does NOT
 * fetch a merchant, open a browser, create an account, pay or submit orders.
 * Those operations require a separately deployed and authorized backend.
 */
export type MayaWebActionStatus =
  | 'draft' | 'researching' | 'options_ready' | 'awaiting_approval'
  | 'executing' | 'completed' | 'blocked' | 'failed' | 'cancelled';

export interface MayaPriceComparisonDraft {
  intent: 'price_comparison';
  mode: 'read_only';
  query: string;
  budgetBrl?: number;
  category?: string;
}

export interface MayaMerchantQuote {
  merchant: string;
  product: string;
  url: string;
  observedAt: string;
  currency: string;
  itemPrice: number;
  shippingPrice?: number;
  taxes?: number;
  availability: 'available' | 'unavailable' | 'unconfirmed';
  shippingEstimate?: string;
  sourceNote?: string;
}

/** Never infer a final price when shipping, tax, or availability is unknown. */
export function comparableTotal(quote: MayaMerchantQuote): number | null {
  if (quote.currency !== 'BRL' || quote.availability !== 'available') return null;
  const prices = [quote.itemPrice, quote.shippingPrice, quote.taxes];
  if (prices.some(value => value === undefined || !Number.isFinite(value) || Number(value) < 0)) return null;
  return Math.round((Number(quote.itemPrice) + Number(quote.shippingPrice) + Number(quote.taxes)) * 100) / 100;
}

/** The backend must additionally enforce DNS/IP/redirect restrictions and site policy. */
export function isPlausiblePublicOffer(quote: MayaMerchantQuote, currentTime = Date.now()): boolean {
  if (!quote.merchant.trim() || !quote.product.trim() || !Number.isFinite(quote.itemPrice) || quote.itemPrice < 0) return false;
  try {
    const url = new URL(quote.url);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.')) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (/^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return false;
  } catch { return false; }
  const observedTime = Date.parse(quote.observedAt);
  return Number.isFinite(observedTime) && observedTime <= currentTime && currentTime - observedTime < 24 * 60 * 60 * 1000;
}

export function createPriceComparisonDraft(query: string, budgetBrl?: number): MayaPriceComparisonDraft {
  const cleaned = query.trim();
  if (cleaned.length < 5 || cleaned.length > 500) throw new Error('Descreva o produto ou serviço em até 500 caracteres.');
  if (budgetBrl !== undefined && (!Number.isFinite(budgetBrl) || budgetBrl <= 0 || budgetBrl > 1000000)) {
    throw new Error('Informe um orçamento válido.');
  }
  return { intent: 'price_comparison', mode: 'read_only', query: cleaned, ...(budgetBrl === undefined ? {} : { budgetBrl }) };
}
