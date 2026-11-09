/**
 * Evidence gate for Maya 09C. This is a client-side presentation guard, not a
 * substitute for server-side signature/merchant/DNS verification.
 * The application does not fetch offers and must not imply that it does.
 */
import { type MayaMerchantQuote } from '../lib/mayaWebActionContracts';
import { rankVerifiedQuotes, type MayaQuoteComparison } from './verifiedQuoteComparison';

export type MayaEvidenceBackedQuote = {
  quote: MayaMerchantQuote;
  evidence: {
    sourceId: string;
    sourceUrl: string;
    fetchedAt: string;
    productKey: string;
    retrievalId: string;
  };
};

export type MayaComparableGroup = {
  productKey: string;
  comparison: MayaQuoteComparison;
};

export type MayaEvidenceComparison = {
  groups: MayaComparableGroup[];
  rejectedIndices: number[];
  disclaimer: string;
};

const safeIdentifier = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{2,119}$/;

function publicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    if (!host.includes('.') || host.endsWith('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') || host.endsWith('.example') || host.endsWith('.onion')) return false;
    if (host.startsWith('[') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) return false;
    return true;
  } catch { return false; }
}

/** Evidence metadata is mandatory. Actual provenance is established ONLY by the backend. */
export function hasQuoteEvidence(item: MayaEvidenceBackedQuote, now = Date.now()): boolean {
  if (!Number.isFinite(now) || now < 0) return false;
  if (!item || !item.quote || !item.evidence) return false;
  const ev = item.evidence;
  if (!safeIdentifier.test(ev.sourceId) || !safeIdentifier.test(ev.retrievalId)) return false;
  if (!safeIdentifier.test(ev.productKey) || !publicHttpsUrl(ev.sourceUrl) || !publicHttpsUrl(item.quote.url)) return false;
  const fetchedAt = Date.parse(ev.fetchedAt);
  const observedAt = Date.parse(item.quote.observedAt);
  if (!Number.isFinite(fetchedAt) || !Number.isFinite(observedAt)) return false;
  if (fetchedAt > now || now - fetchedAt >= 24 * 60 * 60 * 1000) return false;
  if (observedAt > fetchedAt || fetchedAt - observedAt > 60 * 60 * 1000) return false;
  // Evidence must point to the same merchant host as the quoted offer.
  try {
    return new URL(ev.sourceUrl).hostname.toLowerCase() === new URL(item.quote.url).hostname.toLowerCase();
  } catch { return false; }
}

/** Never compare distinct product variants within one ordered cheapest-price list. */
export function compareEvidenceBackedQuotes(
  items: readonly MayaEvidenceBackedQuote[],
  budgetBrl?: number,
  now = Date.now(),
): MayaEvidenceComparison {
  if (items.length > 100) throw new Error('Limite de 100 ofertas por comparação.');
  const grouped = new Map<string, MayaMerchantQuote[]>();
  const rejectedIndices: number[] = [];
  items.forEach((item, index) => {
    if (!hasQuoteEvidence(item, now)) { rejectedIndices.push(index); return; }
    const key = item.evidence.productKey;
    grouped.set(key, [...(grouped.get(key) ?? []), item.quote]);
  });
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([productKey, quotes]) => ({ productKey, comparison: rankVerifiedQuotes(quotes, budgetBrl, now) }));
  return {
    groups,
    rejectedIndices,
    disclaimer: 'Origem e equivalência de produtos dependem de validação no servidor. Confirme condições com cada loja. Nenhuma compra será realizada.',
  };
}
