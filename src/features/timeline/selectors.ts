import { fmt, fmtP, mLabel, typeLabel } from '../../domain/format';
import { movingAverage } from '../../domain/stats';
import type { Analysis } from '../../domain/types';
import type { TimelineView } from '../../state/appState';

export interface DatedPoint {
  /** Day as UTC milliseconds (bookings are dated at UTC midnight). */
  x: number;
  y: number;
}

export type MainChartData =
  | { isDate: true; cumData: DatedPoint[]; maData: DatedPoint[]; /** First day of every month in range. */ monthTicks: number[] }
  | { isDate: false; labels: string[]; cumData: number[]; maData: number[] };

function cumulate(values: number[]): number[] {
  let cum = 0;
  return values.map((v) => (cum += v));
}

/**
 * Cumulative cashflow plus a moving average of that cumulative curve (30 days,
 * 3 months or 2 quarters). The daily view returns {x, y} points on a linear time
 * axis with one tick per month; monthly/quarterly are plain category series.
 */
export function computeMainChartData(a: Analysis, view: TimelineView): MainChartData {
  if (view === 'daily') {
    const daily = new Map<number, number>();
    for (const r of a.cash) daily.set(r._date.getTime(), (daily.get(r._date.getTime()) ?? 0) + r._amt);
    const days = [...daily.keys()].sort((x, y) => x - y);
    const cum = cumulate(days.map((d) => daily.get(d)!));
    const ma = movingAverage(cum, 30);
    return {
      isDate: true,
      cumData: days.map((x, i) => ({ x, y: cum[i]! })),
      maData: days.map((x, i) => ({ x, y: ma[i]! })),
      monthTicks: a.mKeys.map((mk) => Date.UTC(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1, 1)),
    };
  }
  if (view === 'monthly') {
    const cumData = cumulate(a.mKeys.map((m) => a.months[m]?.net ?? 0));
    return { isDate: false, labels: a.mKeys.map(mLabel), cumData, maData: movingAverage(cumData, 3) };
  }
  const qMap = new Map<string, number>();
  for (const mk of a.mKeys) {
    const q = `${mk.slice(0, 4)}-Q${Math.ceil(parseInt(mk.slice(5, 7), 10) / 3)}`;
    qMap.set(q, (qMap.get(q) ?? 0) + (a.months[mk]?.net ?? 0));
  }
  const keys = [...qMap.keys()].sort();
  const cumData = cumulate(keys.map((q) => qMap.get(q)!));
  const labels = keys.map((q) => `${q.slice(5)} ${q.slice(2, 4)}`); // "2024-Q1" → "Q1 24"
  return { isDate: false, labels, cumData, maData: movingAverage(cumData, 2) };
}

export interface SingleSeriesChartData {
  labels: string[];
  values: number[];
}

export function getMonthlyNetChartData(a: Analysis): SingleSeriesChartData {
  return { labels: a.mKeys.map(mLabel), values: a.mKeys.map((m) => a.months[m]?.net ?? 0) };
}

export interface IncomeExpenseData {
  labels: string[];
  income: number[];
  expense: number[];
}

/** Income and (absolute) expense per month. */
export function getMonthlyIncomeExpenseData(a: Analysis): IncomeExpenseData {
  return {
    labels: a.mKeys.map(mLabel),
    income: a.mKeys.map((m) => a.months[m]?.income ?? 0),
    expense: a.mKeys.map((m) => Math.abs(a.months[m]?.expense ?? 0)),
  };
}

export interface CumulativeIncExpChartData {
  labels: string[];
  cumInc: number[];
  cumExp: number[];
}

export function getCumulativeIncExpChartData(a: Analysis): CumulativeIncExpChartData {
  let cumI = 0;
  let cumE = 0;
  return {
    labels: a.mKeys.map(mLabel),
    cumInc: a.mKeys.map((m) => {
      cumI += a.months[m]?.income ?? 0;
      return cumI;
    }),
    cumExp: a.mKeys.map((m) => {
      cumE += Math.abs(a.months[m]?.expense ?? 0);
      return cumE;
    }),
  };
}

export interface IncomeSourceRow {
  label: string;
  count: number;
  total: string;
  pct: number;
  pctLabel: string;
}

/** Income grouped by transaction type, largest first, with its share of all income. */
export function getIncomeSources(a: Analysis): IncomeSourceRow[] {
  const byType: Record<string, { total: number; count: number }> = {};
  for (const r of a.inc) {
    const t = typeLabel(r._type);
    const entry = (byType[t] ??= { total: 0, count: 0 });
    entry.total += r._amt;
    entry.count++;
  }
  return Object.entries(byType)
    .sort((x, y) => y[1].total - x[1].total)
    .map(([label, v]) => {
      const pct = a.totalInc > 0 ? (v.total / a.totalInc) * 100 : 0;
      return { label, count: v.count, total: fmt(v.total), pct: Math.min(pct, 100), pctLabel: fmtP(pct) };
    });
}
