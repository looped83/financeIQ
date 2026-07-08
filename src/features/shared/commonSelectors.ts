import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';

export interface MerchantRow {
  name: string;
  count: number;
  avg: string;
  total: string;
}

/** Top card-payment merchants by total spend. Used by both Übersicht and Kategorien. */
export function getTopMerchants(a: Analysis, limit = 10): MerchantRow[] {
  return Object.entries(a.merchants)
    .sort((x, y) => y[1].total - x[1].total)
    .slice(0, limit)
    .map(([name, v]) => ({ name, count: v.count, avg: fmt(v.total / v.count), total: fmt(v.total) }));
}

/**
 * Set of merchant names that qualify as *fixed costs* (Fixkosten): expenses that
 * recur across several months **with a roughly stable amount** — rent, insurance,
 * gym, streaming, loan payments. Merchants that recur but fluctuate a lot (groceries,
 * drugstores, Amazon) are deliberately excluded and treated as variable spending.
 *
 * A name qualifies when it appears as an expense in `minMonths` distinct months and
 * the coefficient of variation (std/mean) of its per-month totals stays at or below
 * `maxCv`. The default 0.30 threshold was calibrated against real transaction data:
 * insurances/rent/gym land at CV 0.0–0.22, while groceries/shopping sit at 0.39+.
 */
export function getFixedCostNames(a: Analysis, maxCv = 0.3): Set<string> {
  const nameMonthTotals = new Map<string, Map<string, number>>();
  for (const r of a.enriched) {
    if (r._amt >= 0 || r._isDiv || r._isInterest || r._isBuy || r._isSell) continue;
    const name = r._name || '';
    if (!name) continue;
    let months = nameMonthTotals.get(name);
    if (!months) { months = new Map(); nameMonthTotals.set(name, months); }
    months.set(r._month, (months.get(r._month) ?? 0) + Math.abs(r._amt));
  }

  const minMonths = a.mKeys.length >= 3 ? 3 : Math.max(2, a.mKeys.length);
  const fixed = new Set<string>();
  for (const [name, months] of nameMonthTotals) {
    if (months.size < minMonths) continue;
    const vals = [...months.values()];
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    if (mean <= 0) continue;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv <= maxCv) fixed.add(name);
  }
  return fixed;
}

export interface RecurringExpenseRow {
  name: string;
  monthCount: number;
  perMonth: string;
  perYear: string;
}

export interface RecurringExpensesSummary {
  rows: RecurringExpenseRow[];
  totalPerMonth: string;
  totalPerYear: string;
}

/** Recurring same-name/same-amount expenses across 2+ months. Used by Übersicht and Ausreißer. */
export function getRecurringExpenses(a: Analysis, limit = 8): RecurringExpensesSummary {
  const totalPerMonth = a.subscriptions.reduce((s, x) => s + x.amt, 0);
  return {
    rows: a.subscriptions.slice(0, limit).map((s) => ({
      name: s.name,
      monthCount: s.months.size,
      perMonth: fmt(s.amt),
      perYear: fmt(s.amt * 12),
    })),
    totalPerMonth: fmt(totalPerMonth),
    totalPerYear: fmt(totalPerMonth * 12),
  };
}
