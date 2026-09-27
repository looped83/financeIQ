import { fmt, typeLabel } from '../../domain/format';
import { memoize } from '../../domain/memo';
import type { Analysis } from '../../domain/types';
import { foldToSeries } from '../../theme/palette';

export interface MerchantRow {
  name: string;
  count: number;
  avg: string;
  total: string;
}

/** Top card-payment merchants by total spend (Ausgaben). */
export function getTopMerchants(a: Analysis, limit = 10): MerchantRow[] {
  return Object.entries(a.merchants)
    .sort((x, y) => y[1].total - x[1].total)
    .slice(0, limit)
    .map(([name, v]) => ({ name, count: v.count, avg: fmt(v.total / v.count), total: fmt(v.total) }));
}

export interface FixedCostRow {
  name: string;
  monthCount: number;
  /** Average amount in the months it was paid. */
  perMonth: number;
}

export interface FixedCosts {
  /** Largest first. */
  rows: FixedCostRow[];
  /** Sum of every row's monthly amount — what the fixed costs add up to in a typical month. */
  totalPerMonth: number;
}

/** Fixed costs (see `markFixedCosts` in domain/analyze) paid within `a`, one row per payee. */
export const getFixedCosts = memoize((a: Analysis): FixedCosts => {
  const byName = new Map<string, { total: number; months: Set<string> }>();
  for (const r of a.enriched) {
    if (!r._isFixed) continue;
    const e = byName.get(r._name) ?? { total: 0, months: new Set<string>() };
    e.total += Math.abs(r._amt);
    e.months.add(r._month);
    byName.set(r._name, e);
  }
  const rows = [...byName]
    .map(([name, e]) => ({ name, monthCount: e.months.size, perMonth: e.total / e.months.size }))
    .sort((x, y) => y.perMonth - x.perMonth);
  return { rows, totalPerMonth: rows.reduce((s, r) => s + r.perMonth, 0) };
});

export interface SpendBreakdown {
  /** Largest first, folded to the series palette plus a trailing "Sonstige". */
  entries: [string, number][];
  total: number;
}

/**
 * Where the money went, by payee or by transaction type. Dividend/interest
 * corrections are excluded (they are not spending). A payee without a name falls
 * back to its type label so nameless card payments don't vanish.
 */
export function getSpendBreakdown(a: Analysis, by: 'payee' | 'type'): SpendBreakdown {
  const totals = new Map<string, number>();
  for (const r of a.exp) {
    if (r._isDiv || r._isInterest) continue;
    const key = by === 'payee' ? r._name || typeLabel(r._type) : typeLabel(r._type);
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(r._amt));
  }
  const entries = foldToSeries([...totals]);
  return { entries, total: entries.reduce((s, [, v]) => s + v, 0) };
}
