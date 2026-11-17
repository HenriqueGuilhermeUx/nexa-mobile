/**
 * Onda 09: consulta externa assistida, sem automacao de loja.
 * Nenhum dado de conta Nexa, email ou carteira entra na URL.
 */
export function buildPublicShoppingSearchUrl(query: string, budgetBrl?: number): string {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (normalized.length < 5 || normalized.length > 240) {
    throw new Error('Descreva o produto em 5 a 240 caracteres.');
  }
  if (budgetBrl !== undefined &&
      (!Number.isSafeInteger(budgetBrl) || budgetBrl < 1 || budgetBrl > 1000000)) {
    throw new Error('Informe um limite inteiro em reais, entre R$ 1 e R$ 1.000.000.');
  }
  const search = budgetBrl === undefined ? normalized : `${normalized} até R$ ${budgetBrl}`;
  return 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(search);
}
