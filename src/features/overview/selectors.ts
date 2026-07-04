import { fmt, fmtP, mLabel, typeLabel } from '../../domain/format';
import type { Analysis, EnrichedRow } from '../../domain/types';

export interface OverviewRates {
  savingsRate: number;
  passiveRatio: number;
  investRate: number;
}

export function computeOverviewRates(a: Analysis): OverviewRates {
  return {
    savingsRate: a.totalInc > 0 ? (a.netBal / a.totalInc) * 100 : 0,
    passiveRatio: a.totalInc > 0 ? (a.totalDiv / a.totalInc) * 100 : 0,
    investRate: a.totalInc > 0 ? (a.totalInv / a.totalInc) * 100 : 0,
  };
}

export interface KpiCard {
  label: string;
  value: string;
  cls: string;
  sub: string;
}

export function getOverviewKpis(a: Analysis, rates: OverviewRates): KpiCard[] {
  const { savingsRate, investRate } = rates;
  return [
    { label: 'Gesamteinnahmen', value: fmt(a.totalInc), cls: 'income', sub: `Ø ${fmt(a.avgInc)}/Monat` },
    { label: 'Gesamtausgaben', value: fmt(Math.abs(a.totalExp)), cls: 'expense', sub: `Ø ${fmt(a.avgExp)}/Monat` },
    { label: 'Netto-Saldo', value: fmt(a.netBal), cls: 'balance', sub: a.netBal >= 0 ? 'Positiv ✓' : 'Negativ ⚠️' },
    { label: 'Investiert', value: fmt(a.totalInv), cls: 'invest', sub: `Verkauft: ${fmt(a.totalSold)}` },
    { label: 'Dividenden', value: fmt(a.totalDiv), cls: 'dividend', sub: `${Object.keys(a.byAsset).length} Positionen` },
    {
      label: 'Sparquote',
      value: fmtP(savingsRate),
      cls: savingsRate >= 20 ? 'income' : savingsRate >= 10 ? 'warn' : 'expense',
      sub: `Investitionsrate: ${fmtP(investRate)}`,
    },
  ];
}

export interface Last6MonthsChartData {
  labels: string[];
  income: number[];
  expense: number[];
}

export function getLast6MonthsChartData(a: Analysis): Last6MonthsChartData {
  const l6 = a.mKeys.slice(-6);
  return {
    labels: l6.map(mLabel),
    income: l6.map((m) => a.months[m]?.income ?? 0),
    expense: l6.map((m) => Math.abs(a.months[m]?.expense ?? 0)),
  };
}

export interface VolumeByTypeChartData {
  labels: string[];
  values: number[];
}

/** Top 8 transaction types by total volume (income + |expense|), for the donut chart. */
export function getVolumeByTypeChartData(a: Analysis): VolumeByTypeChartData {
  const entries = Object.entries(a.byType)
    .sort((x, y) => y[1].income + Math.abs(y[1].expense) - (x[1].income + Math.abs(x[1].expense)))
    .slice(0, 8);
  return {
    labels: entries.map(([t]) => typeLabel(t)),
    values: entries.map(([, v]) => v.income + Math.abs(v.expense)),
  };
}

export interface SavingsRateTrendData {
  labels: string[];
  savingsRate: number[];
  target: number[];
}

export function getSavingsRateTrendData(a: Analysis): SavingsRateTrendData {
  return {
    labels: a.mKeys.map(mLabel),
    savingsRate: a.mKeys.map((mk) => a.months[mk]!.savingsRate),
    target: a.mKeys.map(() => 20),
  };
}

export interface TopExpenseCategoriesData {
  labels: string[];
  values: number[];
}

export function getTopExpenseCategoriesData(a: Analysis, limit = 5): TopExpenseCategoriesData {
  const entries = Object.entries(a.expCat).sort((x, y) => y[1] - x[1]).slice(0, limit);
  return { labels: entries.map(([k]) => k), values: entries.map(([, v]) => v) };
}

export interface RatioRow {
  label: string;
  value: string;
  good: boolean;
}

export function computeFinancialRatios(a: Analysis, rates: OverviewRates): RatioRow[] {
  const { savingsRate, passiveRatio, investRate } = rates;
  const cardTotal = a.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  const cardRatio = Math.abs(a.totalExp) > 0 ? (cardTotal / Math.abs(a.totalExp)) * 100 : 0;
  const avgTxSize = a.exp.length > 0 ? Math.abs(a.totalExp) / a.exp.length : 0;
  const feeRatio = a.totalInv > 0 ? (a.totalFee / a.totalInv) * 100 : 0;
  const taxRatio = a.totalDiv > 0 ? (a.totalTax / (a.totalDiv + a.totalTax)) * 100 : 0;

  const maxMonth = a.mKeys.reduce(
    (best, mk) => {
      const n = a.months[mk]?.net ?? 0;
      return n > best.v ? { k: mk, v: n } : best;
    },
    { k: '', v: -Infinity },
  );
  const minMonth = a.mKeys.reduce(
    (worst, mk) => {
      const n = a.months[mk]?.net ?? 0;
      return n < worst.v ? { k: mk, v: n } : worst;
    },
    { k: '', v: Infinity },
  );

  return [
    { label: 'Sparquote (Netto/Einnahmen)', value: fmtP(savingsRate), good: savingsRate >= 15 },
    { label: 'Passives Einkommen', value: fmtP(passiveRatio), good: passiveRatio >= 5 },
    { label: 'Investitionsrate', value: fmtP(investRate), good: investRate >= 15 },
    { label: 'Kartenzahlungsanteil', value: fmtP(cardRatio), good: cardRatio < 50 },
    { label: 'Ø Ausgabe pro Transaktion', value: fmt(avgTxSize), good: true },
    { label: 'Gebührenquote', value: a.totalInv > 0 ? fmtP(feeRatio) : '-', good: feeRatio < 0.5 },
    { label: 'Steuerbelastung Dividenden', value: a.totalDiv > 0 ? fmtP(taxRatio) : '-', good: false },
    { label: 'Ø Monats-Transaktionen', value: Math.round(a.enriched.length / a.mc) + '×', good: true },
    { label: 'Bester Monat', value: `${mLabel(maxMonth.k)} (${fmt(maxMonth.v)})`, good: true },
    { label: 'Schwächster Monat', value: `${mLabel(minMonth.k)} (${fmt(minMonth.v)})`, good: minMonth.v >= 0 },
  ];
}

// Moved to features/shared/commonSelectors.ts (also used by Kategorien) —
// re-exported here so existing imports from './selectors' keep working.
export { getTopMerchants, type MerchantRow } from '../shared/commonSelectors';

export interface IncomeSourceRow {
  label: string;
  count: number;
  total: string;
  pct: number;
  pctLabel: string;
}

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

// Moved to features/shared/commonSelectors.ts (also used by Ausreißer) —
// re-exported here so existing imports from './selectors' keep working.
export {
  getRecurringExpenses,
  type RecurringExpenseRow,
  type RecurringExpensesSummary,
} from '../shared/commonSelectors';

export interface Alert {
  color: 'red' | 'yellow' | 'green' | 'blue';
  text: string;
}

export function computeAlerts(a: Analysis, rates: OverviewRates): Alert[] {
  const { savingsRate, investRate } = rates;
  const alerts: Alert[] = [];

  if (a.netBal < 0) {
    alerts.push({ color: 'red', text: `<strong>Negativer Saldo:</strong> Ausgaben übersteigen Einnahmen um ${fmt(Math.abs(a.netBal))}.` });
  }
  if (savingsRate < 10 && a.netBal >= 0) {
    alerts.push({ color: 'yellow', text: `<strong>Niedrige Sparquote:</strong> Nur ${fmtP(savingsRate)} des Einkommens verbleibt als Netto.` });
  }
  if (a.totalDiv > 0) {
    alerts.push({ color: 'green', text: `<strong>Passives Einkommen:</strong> ${fmt(a.totalDiv)} Dividenden aus ${Object.keys(a.byAsset).length} Positionen.` });
  }
  if (a.totalInv > 0) {
    alerts.push({ color: 'green', text: `<strong>Sparplan aktiv:</strong> ${fmt(a.totalInv)} in Wertpapiere investiert (Rate: ${fmtP(investRate)}).` });
  }
  if (a.totalFee > 100) {
    alerts.push({ color: 'yellow', text: `<strong>Handelsgebühren:</strong> ${fmt(a.totalFee)} an Gebühren — Sparpläne prüfen.` });
  }
  const bigExp = a.exp.filter((r) => Math.abs(r._amt) > 500);
  if (bigExp.length) {
    alerts.push({
      color: 'yellow',
      text: `<strong>${bigExp.length} große Ausgaben</strong> (>500€) — ${fmt(bigExp.reduce((s, r) => s + Math.abs(r._amt), 0))} gesamt.`,
    });
  }
  if (a.mKeys.length >= 3) {
    const last3Exp = a.mKeys.slice(-3).map((mk) => Math.abs(a.months[mk]?.expense ?? 0));
    if (last3Exp[2]! > last3Exp[1]! && last3Exp[1]! > last3Exp[0]!) {
      alerts.push({
        color: 'yellow',
        text: `<strong>Steigende Ausgaben:</strong> Die Ausgaben sind 3 Monate in Folge gestiegen (${last3Exp.map((v) => fmt(v)).join(' → ')}).`,
      });
    }
    const last3Inc = a.mKeys.slice(-3).map((mk) => a.months[mk]?.income ?? 0);
    if (last3Inc[2]! < last3Inc[1]! && last3Inc[1]! < last3Inc[0]!) {
      alerts.push({ color: 'yellow', text: `<strong>Sinkende Einnahmen:</strong> Die Einnahmen sind 3 Monate in Folge gesunken.` });
    }
  }
  if (a.subscriptions.length > 0) {
    const subTotal = a.subscriptions.reduce((s, x) => s + x.amt, 0);
    const subPct = Math.abs(a.totalExp) / a.mc > 0 ? (subTotal / (Math.abs(a.totalExp) / a.mc)) * 100 : 0;
    if (subPct > 15) {
      alerts.push({
        color: 'yellow',
        text: `<strong>Hoher Fixkostenanteil:</strong> ${a.subscriptions.length} wiederkehrende Ausgaben kosten Ø ${fmt(subTotal)}/Monat (${fmtP(subPct)} der Ausgaben).`,
      });
    }
  }
  const cardTotal = a.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  const cardRatio = Math.abs(a.totalExp) > 0 ? (cardTotal / Math.abs(a.totalExp)) * 100 : 0;
  if (cardRatio > 60) {
    alerts.push({ color: 'blue', text: `<strong>Kartenlastig:</strong> ${fmtP(cardRatio)} aller Ausgaben über Kartenzahlungen — Budgetierung prüfen.` });
  }
  const negMonths = a.mKeys.filter((mk) => (a.months[mk]?.net ?? 0) < 0);
  if (negMonths.length >= 2) {
    alerts.push({
      color: 'red',
      text: `<strong>${negMonths.length} negative Monate:</strong> ${negMonths.map(mLabel).join(', ')} — wiederkehrendes Problem.`,
    });
  }

  return alerts;
}

export function getTopTransactions(a: Analysis, limit = 12): EnrichedRow[] {
  return [...a.cash].sort((x, y) => Math.abs(y._amt) - Math.abs(x._amt)).slice(0, limit);
}
