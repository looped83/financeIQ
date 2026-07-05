import { mLabel } from '../../domain/format';
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

export interface MonthlyBarChartData {
  labels: string[];
  values: number[];
  colors: string[];
}

export function getMonthlyNetChartData(a: Analysis): MonthlyBarChartData {
  const values = a.mKeys.map((m) => a.months[m]?.net ?? 0);
  return {
    labels: a.mKeys.map(mLabel),
    values,
    colors: values.map((v) => (v >= 0 ? 'rgba(16,185,129,.7)' : 'rgba(239,68,68,.7)')),
  };
}

export interface SingleSeriesChartData {
  labels: string[];
  values: number[];
}

export function getDividendChartData(a: Analysis): SingleSeriesChartData {
  return { labels: a.mKeys.map(mLabel), values: a.mKeys.map((m) => a.months[m]?.dividend ?? 0) };
}

export interface InvestChartData {
  labels: string[];
  buys: number[];
  sells: number[];
}

/** Buys are negated to draw as downward bars, matching the original. */
export function getInvestChartData(a: Analysis): InvestChartData {
  return {
    labels: a.mKeys.map(mLabel),
    buys: a.mKeys.map((m) => -(a.months[m]?.invested ?? 0)),
    sells: a.mKeys.map((m) => a.months[m]?.sold ?? 0),
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
