/**
 * Maya Actions D — transforma somente dados financeiros existentes em texto útil.
 * Nunca calcula saldo, não interpreta valores ambíguos, não expõe IDs/CPF/chaves.
 */
export type MayaReadOnlyRecord = {
  status: string;
  dateLabel: string | null;
  title: string;
  amountLabel: string | null;
};
export type MayaReadOnlyActivity = {
  returnedCount: number;
  recent: MayaReadOnlyRecord[];
};
const statuses: Record<string, string> = {
  paid: 'Pagamento confirmado',
  failed: 'Não concluída',
  credited: 'Crédito confirmado',
  completed: 'Concluída',
  confirmed: 'Confirmada',
  pending: 'Aguardando confirmação',
  processing: 'Em processamento',
  created: 'Criada',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  expired: 'Expirada',
  in_review: 'Em análise',
  rejected: 'Recusada',
};
const titles: Record<string, string> = {
  deposit: 'Entrada na Nexa',
  fiat_deposit: 'Entrada em reais',
  redemption: 'Resgate Pix',
  pix_redemption: 'Resgate Pix',
  buy: 'Compra',
  sell: 'Venda',
  swap: 'Conversão',
  entry: 'Entrada',
  exit: 'Saída',
};
function listFromResponse(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  for (const key of ['items', 'orders', 'records', 'transactions', 'data']) {
    const candidate = data[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object' && Array.isArray((candidate as Record<string, unknown>).items)) {
      return (candidate as Record<string, unknown>).items as unknown[];
    }
  }
  return null;
}
function amountFrom(obj: Record<string, unknown>): string | null {
  const currency = typeof obj.currency === 'string' ? obj.currency.toUpperCase() : '';
  const direct = obj.amountBrl ?? obj.amountBRL ?? obj.amount_brl;
  const raw = direct !== undefined ? direct : currency === 'BRL' ? obj.amount : undefined;
  // Monetary values are ambiguous without an explicit BRL unit: do not guess.
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1e12) return null;
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function normalizeMayaReadOnlyActivity(payload: unknown): MayaReadOnlyActivity | null {
  const records = listFromResponse(payload);
  if (!records) return null;
  return {
    returnedCount: records.length,
    recent: records.slice(0, 8).map((item): MayaReadOnlyRecord => {
      if (!item || typeof item !== 'object') {
        return { status: 'Situação não informada', dateLabel: null, title: 'Movimentação', amountLabel: null };
      }
      const obj = item as Record<string, unknown>;
      const rawStatus = typeof obj.status === 'string' ? obj.status.trim().toLowerCase() : '';
      const status = statuses[rawStatus] || 'Situação não informada';
      const rawType = typeof obj.type === 'string' ? obj.type.trim().toLowerCase() :
        typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : '';
      const title = titles[rawType] || 'Movimentação';
      const date = typeof obj.createdAt === 'string' ? obj.createdAt :
        typeof obj.created_at === 'string' ? obj.created_at :
        typeof obj.date === 'string' ? obj.date : null;
      const timestamp = date ? Date.parse(date) : NaN;
      const dateLabel = Number.isFinite(timestamp) ?
        new Date(timestamp).toLocaleDateString('pt-BR') : null;
      return { status, dateLabel, title, amountLabel: amountFrom(obj) };
    }),
  };
}
