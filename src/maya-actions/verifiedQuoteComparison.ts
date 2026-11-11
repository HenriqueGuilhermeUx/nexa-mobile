/**
 * Maya Actions 09C — deterministic, read-only comparison of verified quotes.
 * Quotes must come from a separately authorized retrieval service. This
 * function never fetches a URL, makes a purchase or guesses missing costs.
 */
import { comparableTotal, isPlausiblePublicOffer, type MayaMerchantQuote } from '../lib/mayaWebActionContracts';

export interface MayaRankedQuote {
  quote: MayaMerchantQuote;
  totalBrl: number;
  withinBudget: boolean;
}

export interface MayaQuoteComparison {
  ranked: MayaRankedQuote[];
  excluded: { index: number; reason: 'invalid_or_stale' | 'incomplete_total' }[];
  evaluatedAt: string;
  disclaimer: string;
}

export function rankVerifiedQuotes(
  quotes: readonly MayaMerchantQuote[],
  budgetBrl?: number,
  evaluatedAt = Date.now(),
): MayaQuoteComparison {
  // Date.toISOString accepts only the ECMAScript TimeClip range; reject bad backend clocks before processing.
  if (!Number.isFinite(evaluatedAt) || evaluatedAt < 0 || evaluatedAt > 8.64e15) throw new Error('Horário de avaliação inválido.');
  if (budgetBrl !== undefined && (!Number.isFinite(budgetBrl) || budgetBrl <= 0 || budgetBrl > 1000000)) {
    throw new Error('Orçamento inválido.');
  }
  if (!Array.isArray(quotes)) throw new Error('Lote de ofertas inválido.');
  if (quotes.length > 100) throw new Error('Limite de 100 ofertas por comparação.');
  const ranked: MayaRankedQuote[] = [];
  const excluded: MayaQuoteComparison['excluded'] = [];
  quotes.forEach((quote, index) => {
    // Malformed backend entries must be excluded, never crash the whole comparison.
    if (!quote || typeof quote !== 'object' || typeof quote.merchant !== 'string' ||
        typeof quote.product !== 'string' || typeof quote.url !== 'string' ||
        typeof quote.observedAt !== 'string' || !isPlausiblePublicOffer(quote, evaluatedAt)) {
      excluded.push({ index, reason: 'invalid_or_stale' });
      return;
    }
    const totalBrl = comparableTotal(quote);
    // A backend can return individually finite amounts whose sum overflows.
    // Never rank an infinite or otherwise non-finite checkout total.
    if (totalBrl === null || !Number.isFinite(totalBrl)) {
      excluded.push({ index, reason: 'incomplete_total' });
      return;
    }
    ranked.push({ quote, totalBrl, withinBudget: budgetBrl === undefined || totalBrl <= budgetBrl });
  });
  ranked.sort((a, b) => a.totalBrl - b.totalBrl ||
    a.quote.merchant.localeCompare(b.quote.merchant, 'pt-BR') ||
    a.quote.url.localeCompare(b.quote.url));
  return {
    ranked,
    excluded,
    evaluatedAt: new Date(evaluatedAt).toISOString(),
    disclaimer: 'Ofertas informativas: confirme preço, disponibilidade, frete e condições diretamente com a loja antes de comprar.',
  };
}
