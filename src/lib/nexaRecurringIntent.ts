export type RecurringFundingIntent = {
  kind: 'open_finance_recurring_funding';
  amountBrl: number;
  dayOfMonth: number;
  quantity: number;
  bankHint?: string;
  originalText: string;
};

function normalize(text: string) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(text: string) {
  const mil = text.match(/(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*mil\b/i);
  if (mil) {
    const value = Number(mil[1].replace(',', '.'));
    return Number.isFinite(value) ? value * 1000 : null;
  }

  const money = text.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/i);
  if (money) {
    const value = Number(money[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  const beforeReais = text.match(/\b([\d.]+(?:,\d{1,2})?)\s*reais\b/i);
  if (beforeReais) {
    const value = Number(beforeReais[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  const loose = text.match(/\b(\d{2,6})\b/);
  if (loose) {
    const value = Number(loose[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function parseDay(text: string) {
  const patterns = [
    /todo\s+dia\s+(\d{1,2})\b/i,
    /todo\s+mes\s+(?:no\s+)?dia\s+(\d{1,2})\b/i,
    /mensal(?:mente)?\s+(?:no\s+)?dia\s+(\d{1,2})\b/i,
    /\bdia\s+(\d{1,2})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isInteger(value) && value >= 1 && value <= 28) return value;
  }

  return null;
}

function parseBankHint(text: string) {
  const patterns = [
    /\b(?:do|da)\s+([a-z0-9 ]+?)\s+(?:todo|todos|mensal|mensalmente|no\s+dia|dia)\b/i,
    /\b(?:banco)\s+([a-z0-9 ]+?)\s+(?:todo|todos|mensal|mensalmente|no\s+dia|dia)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const bank = String(match?.[1] || '').trim();
    if (bank && bank.length <= 50) return bank;
  }

  return undefined;
}

export function parseRecurringFundingIntent(
  originalText: string,
): RecurringFundingIntent | null {
  const text = normalize(originalText);
  if (!text) return null;

  const recurringSignal =
    /todo\s+dia\s+\d{1,2}\b/.test(text) ||
    /todo\s+mes/.test(text) ||
    /mensal(?:mente)?/.test(text);

  const fundingSignal =
    /\b(traz|trazer|puxa|puxar|manda|mandar|transfere|transferir|aporta|aportar|coloca|colocar)\b/.test(
      text,
    ) || /\bpara\s+(?:a\s+)?nexa\b/.test(text);

  if (!recurringSignal || !fundingSignal) return null;

  const amountBrl = parseAmount(text);
  const dayOfMonth = parseDay(text);
  if (!amountBrl || !dayOfMonth) return null;

  if (amountBrl < 1 || amountBrl > 5000) return null;

  return {
    kind: 'open_finance_recurring_funding',
    amountBrl,
    dayOfMonth,
    quantity: 12,
    bankHint: parseBankHint(text),
    originalText,
  };
}

export function recurringIntentSummary(intent: RecurringFundingIntent) {
  return `R$ ${intent.amountBrl.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} todo dia ${String(intent.dayOfMonth).padStart(2, '0')} por ${
    intent.quantity
  } meses`;
}
