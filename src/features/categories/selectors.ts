import { fmt } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import { getTopMerchants, type MerchantRow } from '../shared/commonSelectors';

export { getTopMerchants, type MerchantRow };

export interface ExpenseCategoryDonutData {
  labels: string[];
  values: number[];
  total: number;
}

/** Top N expense categories by total, plus their combined sum (for percentage labels). */
export function getExpenseCategoryDonutData(a: Analysis, limit = 10): ExpenseCategoryDonutData {
  const entries = Object.entries(a.expCat).sort((x, y) => y[1] - x[1]).slice(0, limit);
  return {
    labels: entries.map(([t]) => t),
    values: entries.map(([, v]) => v),
    total: entries.reduce((s, [, v]) => s + v, 0),
  };
}

export interface CategoryLegendRow {
  label: string;
  value: string;
  pct: number;
  pctLabel: string;
}

export function getExpenseCategoryLegend(a: Analysis, limit = 10): CategoryLegendRow[] {
  const { labels, values, total } = getExpenseCategoryDonutData(a, limit);
  return labels.map((label, i) => {
    const v = values[i]!;
    const pct = total > 0 ? (v / total) * 100 : 0;
    return { label, value: fmt(v), pct, pctLabel: pct.toFixed(1) + '%' };
  });
}

export interface IncomeExpenseByTypeData {
  labels: string[];
  income: number[];
  expense: number[];
}

/** Top N transaction types by combined income+expense volume, for the horizontal bar chart. */
export function getIncomeExpenseByTypeData(a: Analysis, limit = 12): IncomeExpenseByTypeData {
  const tInc: Record<string, number> = {};
  const tExp: Record<string, number> = {};
  for (const r of a.inc) tInc[r._type] = (tInc[r._type] ?? 0) + r._amt;
  for (const r of a.exp) tExp[r._type] = (tExp[r._type] ?? 0) + Math.abs(r._amt);

  const allTypes = [...new Set([...a.inc.map((r) => r._type), ...a.exp.map((r) => r._type)])];
  const topTypes = allTypes
    .sort((x, y) => (tInc[y] ?? 0) + (tExp[y] ?? 0) - ((tInc[x] ?? 0) + (tExp[x] ?? 0)))
    .slice(0, limit);

  return {
    labels: topTypes,
    income: topTypes.map((t) => tInc[t] ?? 0),
    expense: topTypes.map((t) => tExp[t] ?? 0),
  };
}

export interface AssetClassChartData {
  labels: string[];
  values: number[];
}

export function getAssetClassChartData(a: Analysis): AssetClassChartData {
  const entries = Object.entries(a.byAssetClass).sort((x, y) => y[1] - x[1]);
  return { labels: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
}

export interface DividendSecurityRow {
  name: string;
  count: number;
  brutto: string;
  steuer: string;
  netto: string;
  pctLabel: string;
}

export function getDividendsBySecurity(a: Analysis): DividendSecurityRow[] {
  return Object.entries(a.byAsset)
    .sort((x, y) => y[1].total - x[1].total)
    .map(([name, v]) => ({
      name,
      count: v.count,
      brutto: fmt(v.total + v.tax),
      steuer: fmt(v.tax),
      netto: fmt(v.total),
      pctLabel: (a.totalDiv > 0 ? (v.total / a.totalDiv) * 100 : 0).toFixed(1) + '%',
    }));
}
