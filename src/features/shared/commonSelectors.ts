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
