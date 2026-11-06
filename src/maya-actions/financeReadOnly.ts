/**
 * Onda 03 — leitura de registros já retornados pela API Nexa.
 * Não agrega bancos externos, não infere saldo nem consulta Open Finance.
 * Um payload desconhecido é indisponível, nunca "zero transações".
 */
export type MayaReadOnlyRecord = {
  status: string;
  dateLabel: string | null;
};
export type MayaReadOnlyActivity = {
  returnedCount: number;
  recent: MayaReadOnlyRecord[];
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

export function normalizeMayaReadOnlyActivity(payload: unknown): MayaReadOnlyActivity | null {
  const records = listFromResponse(payload);
  if (!records) return null;
  return {
    returnedCount: records.length,
    recent: records.slice(0, 8).map(item => {
      if (!item || typeof item !== 'object') {
        return { status: 'Estado não informado', dateLabel: null };
      }
      const obj = item as Record<string, unknown>;
      const rawStatus = typeof obj.status === 'string' ? obj.status.trim() : '';
      const status = rawStatus && rawStatus.length <= 48 ? rawStatus : 'Estado não informado';
      const date = typeof obj.createdAt === 'string' ? obj.createdAt :
        typeof obj.created_at === 'string' ? obj.created_at : null;
      const timestamp = date ? Date.parse(date) : NaN;
      const dateLabel = Number.isFinite(timestamp) ?
        new Date(timestamp).toLocaleDateString('pt-BR') : null;
      return { status, dateLabel };
    }),
  };
}
