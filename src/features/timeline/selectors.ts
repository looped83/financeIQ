import { fmt, fmtP, mLabel, typeLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { TimelineView } from '../../state/appState';

export interface DatedPoint {
  x: string;
  y: number;
}

export interface MainChartData {
  isDate: boolean;
  labels: string[] | undefined;
  cumData: number[] | DatedPoint[];
  maData: number[] | DatedPoint[];
}

/** 1:1 port of the original's `buildTLChart(a, view)`. For the daily view, both the
 *  cumulative series and its moving average are `{x, y}` points keyed by ISO date (fed
 *  to a Chart.js time-scale); for monthly/quarterly they're plain numbers against
 *  category labels. The moving average is deliberately computed over the *cumulative*
 *  series itself (not over daily/monthly deltas) — a smoothed cumulative curve, matching
 *  the original exactly. */
export function computeMainChartData(a: Analysis, view: TimelineView): MainChartData {
  if (view === 'daily') {
    const daily: Record<string, number> = {};
    for (const r of a.cash) {
      const dk = r._date.toISOString().substring(0, 10);
      daily[dk] = (daily[dk] ?? 0) + r._amt;
    }
    const dKeys = Object.keys(daily).sort();
    let cum = 0;
    const cumData: DatedPoint[] = dKeys.map((dk) => {
      cum += daily[dk]!;
      return { x: dk, y: cum };
    });
    const maData: DatedPoint[] = cumData.map((p, i) => {
      const w = cumData.slice(Math.max(0, i - 29), i + 1).map((x) => x.y);
      return { x: p.x, y: w.reduce((s, v) => s + v, 0) / w.length };
    });
    return { isDate: true, labels: undefined, cumData, maData };
  }

  if (view === 'monthly') {
    const labels = a.mKeys.map(mLabel);
    let cum = 0;
    const cumData = a.mKeys.map((m) => {
      cum += a.months[m]?.net ?? 0;
      return cum;
    });
    const maData = cumData.map((_v, i) => {
      const w = cumData.slice(Math.max(0, i - 2), i + 1);
      return w.reduce((s, x) => s + x, 0) / w.length;
    });
    return { isDate: false, labels, cumData, maData };
  }

  // quarterly
  const qMap: Record<string, number> = {};
  for (const mk of a.mKeys) {
    const [y, m] = mk.split('-');
    const q = `${y}-Q${Math.ceil(parseInt(m!, 10) / 3)}`;
    qMap[q] = (qMap[q] ?? 0) + (a.months[mk]?.net ?? 0);
  }
  const qKeys = Object.keys(qMap).sort();
  let cum = 0;
  const cumData = qKeys.map((q) => {
    cum += qMap[q]!;
    return cum;
  });
  const maData = cumData.map((_v, i) => {
    const w = cumData.slice(Math.max(0, i - 1), i + 1);
    return w.reduce((s, x) => s + x, 0) / w.length;
  });
  return { isDate: false, labels: qKeys, cumData, maData };
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
