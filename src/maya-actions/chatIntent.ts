/**
 * Conservative, local-only Maya Action intent router.
 *
 * Explicit commands only. A third-party site is NEVER opened here, and
 * financial/payment requests are left for their existing authenticated flows.
 */
export type MayaLocalActionIntent =
  | { kind: 'shopping_search'; query: string }
  | { kind: 'reminder_draft'; description: string };

const FINANCIAL_INTENT = /\b(?:pix|usdc|btc|bitcoin|ethereum|cripto(?:moeda)?s?|d[oó]lar(?:es)?|transfer[iê]r?|transfira|saldo|extrato|banco|cart[aã]o|investimento|saque|dep[oó]sito)\b/i;
const SEARCH_VERB = /\b(?:pesquise|pesquisar|procure|buscar|busque|encontre|compare)\b/i;
const OFFER_TERM = /\b(?:pre[cç]os?|ofertas?|promo[cç][aã]o|promo[cç][oõ]es|lojas?|shopping)\b/i;
const REMINDER_TERM = /\b(?:me\s+lembre|lembre[ -]me|crie\s+um\s+lembrete|agende\s+um\s+lembrete|me\s+avise)\b/i;

export function parseMayaLocalActionIntent(input: string): MayaLocalActionIntent | null {
  const text = input.trim().replace(/\s+/g, ' ').slice(0, 500);
  if (!text || FINANCIAL_INTENT.test(text)) return null;
  const command = text.replace(/^maya\s*[,.:!]?\s*/i, '').trim();
  if (REMINDER_TERM.test(command)) {
    return { kind: 'reminder_draft', description: command.slice(0, 500) };
  }
  if (SEARCH_VERB.test(command) && OFFER_TERM.test(command)) {
    return { kind: 'shopping_search', query: command.slice(0, 240) };
  }
  return null;
}
