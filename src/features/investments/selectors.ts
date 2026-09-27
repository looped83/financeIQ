import { fmt, fmtP, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import { foldToSeries } from '../../theme/palette';

export interface InvestmentKpis {
  invested: number;
  sold: number;
  dividends: number;
  avgDividend: number;
  positions: number;
  /** Dividends as a share of all income. */
  passiveRate: number;
  fees: number;
}

export function getInvestmentKpis(a: Analysis): InvestmentKpis {
  return {
    invested: a.totalInv,
    sold: a.totalSold,
    dividends: a.totalDiv,
    avgDividend: a.totalDiv / a.mc,
    positions: Object.keys(a.byAsset).length,
    passiveRate: a.totalInc > 0 ? (a.totalDiv / a.totalInc) * 100 : 0,
    fees: a.totalFee,
  };
}

export interface MonthlySeries {
  labels: string[];
  values: number[];
}

/** Net dividend income per month, zero where none arrived. */
export function getDividendChartData(a: Analysis): MonthlySeries {
  return { labels: a.mKeys.map(mLabel), values: a.mKeys.map((m) => a.months[m]?.dividend ?? 0) };
}

export interface TradeVolumeData {
  labels: string[];
  buys: number[];
  sells: number[];
}

/** Buy and sell volume per month, both as positive amounts for side-by-side bars. */
export function getTradeVolumeData(a: Analysis): TradeVolumeData {
  return {
    labels: a.mKeys.map(mLabel),
    buys: a.mKeys.map((m) => a.months[m]?.invested ?? 0),
    sells: a.mKeys.map((m) => a.months[m]?.sold ?? 0),
  };
}

/** Buy volume by asset class, folded to the series palette. */
export function getAssetClassBreakdown(a: Analysis): [string, number][] {
  return foldToSeries(Object.entries(a.byAssetClass));
}

export interface DividendSecurityRow {
  name: string;
  count: number;
  amount: string;
  /** Share of all net dividends, 0–100. */
  pct: number;
  pctLabel: string;
}

export function getDividendsBySecurity(a: Analysis): DividendSecurityRow[] {
  return Object.entries(a.byAsset)
    .sort((x, y) => y[1].total - x[1].total)
    .map(([name, v]) => {
      const pct = a.totalDiv > 0 ? (v.total / a.totalDiv) * 100 : 0;
      return { name, count: v.count, amount: fmt(v.total), pct: Math.max(0, Math.min(pct, 100)), pctLabel: fmtP(pct) };
    });
}
