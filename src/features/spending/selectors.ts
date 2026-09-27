import { fmt, fmtD, mLabel, typeLabel } from '../../domain/format';
import { isSpend } from '../../domain/analyze';
import type { Analysis, EnrichedRow } from '../../domain/types';
import { SERIES } from '../../theme/palette';

export interface SpendingKpis {
  total: number;
  avgPerMonth: number;
  avgPerBooking: number;
  bookings: number;
  outliers: number;
}

export function getSpendingKpis(a: Analysis): SpendingKpis {
  return {
    total: Math.abs(a.totalExp),
    avgPerMonth: a.avgExp,
    avgPerBooking: a.exp.length ? Math.abs(a.totalExp) / a.exp.length : 0,
    bookings: a.exp.length,
    outliers: a.outliers.filter((r) => r._amt < 0).length,
  };
}

export interface StackedSeries {
  labels: string[];
  series: { label: string; data: number[] }[];
}

/** Sums spend per month for each key `keyOf` returns (one pass over the rows). */
function monthlyTotals(a: Analysis, keyOf: (r: EnrichedRow) => string): Map<string, number[]> {
  const index = new Map(a.mKeys.map((mk, i) => [mk, i]));
  const totals = new Map<string, number[]>();
  for (const r of a.enriched) {
    const i = index.get(r._month);
    if (i === undefined || !isSpend(r)) continue;
    const key = keyOf(r);
    let row = totals.get(key);
    if (!row) totals.set(key, (row = a.mKeys.map(() => 0)));
    row[i]! += Math.abs(r._amt);
  }
  return totals;
}

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

/** Monthly spend by transaction type: the largest types, the rest folded into "Sonstige". */
export function getTypeStackData(a: Analysis): StackedSeries {
  const totals = monthlyTotals(a, (r) => typeLabel(r._type));
  const ranked = [...totals].sort((x, y) => sum(y[1]) - sum(x[1]));
  const head = ranked.slice(0, SERIES.length);
  const rest = ranked.slice(SERIES.length);
  const series = head.map(([label, data]) => ({ label, data }));
  if (rest.length) series.push({ label: 'Sonstige', data: a.mKeys.map((_, i) => sum(rest.map(([, d]) => d[i]!))) });
  return { labels: a.mKeys.map(mLabel), series };
}

/** Monthly spend of the top payees (as many as there are series colors). */
export function getMerchantTimelineData(a: Analysis): StackedSeries {
  const totals = monthlyTotals(a, (r) => r._name || 'Ohne Namen');
  const top = [...totals].sort((x, y) => sum(y[1]) - sum(x[1])).slice(0, SERIES.length);
  return { labels: a.mKeys.map(mLabel), series: top.map(([label, data]) => ({ label, data })) };
}

export interface FixVarTimelineData {
  labels: string[];
  fixed: number[];
  variable: number[];
}

/** Monthly spend split into fixed costs (stable recurring payees) and everything else. */
export function getFixVarTimelineData(a: Analysis): FixVarTimelineData {
  const totals = monthlyTotals(a, (r) => (r._isFixed ? 'fixed' : 'variable'));
  const zeros = a.mKeys.map(() => 0);
  return { labels: a.mKeys.map(mLabel), fixed: totals.get('fixed') ?? zeros, variable: totals.get('variable') ?? zeros };
}

export interface OutlierRow {
  date: string;
  type: string;
  name: string;
  amount: string;
  zScore: string;
  level: 'Kritisch' | 'Erhöht' | 'Auffällig';
}

/** Expenses more than 2σ away from the mean, strongest first. */
export function getOutlierRows(a: Analysis, limit = 25): OutlierRow[] {
  return a.outliers.filter((r) => r._amt < 0).slice(0, limit).map((r) => ({
    date: fmtD(r._date),
    type: typeLabel(r._type),
    name: r._name || r._desc || '—',
    amount: fmt(r._amt),
    zScore: `${r._z.toFixed(1).replace('.', ',')} σ`,
    level: r._z > 4 ? 'Kritisch' : r._z > 3 ? 'Erhöht' : 'Auffällig',
  }));
}

