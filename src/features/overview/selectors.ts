import { fmt, fmtP, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';

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

/** Which series a KPI's dot stands for; `status` marks a judged value (✓ / ⚠). */
export interface KpiCard {
  label: string;
  value: string;
  sub: string;
  dot?: 'income' | 'expense' | 'dividend' | 'invest';
  status?: 'good' | 'warn';
}

export function getOverviewKpis(a: Analysis, rates: OverviewRates): KpiCard[] {
  const positions = Object.keys(a.byAsset).length;
  return [
    { label: 'Einnahmen', value: fmt(a.totalInc), sub: `Ø ${fmt(a.avgInc)} pro Monat`, dot: 'income' },
    { label: 'Ausgaben', value: fmt(Math.abs(a.totalExp)), sub: `Ø ${fmt(a.avgExp)} pro Monat`, dot: 'expense' },
    {
      label: 'Netto-Saldo',
      value: (a.netBal > 0 ? '+' : '') + fmt(a.netBal),
      sub: `Sparquote ${fmtP(rates.savingsRate)}`,
      status: rates.savingsRate >= 15 ? 'good' : 'warn',
    },
    {
      label: 'Dividenden (netto)',
      value: fmt(a.totalDiv),
      sub: `Ø ${fmt(a.totalDiv / a.mc)} pro Monat · ${positions} ${positions === 1 ? 'Position' : 'Positionen'}`,
      dot: 'dividend',
    },
  ];
}

export interface RatioRow {
  label: string;
  value: string;
  /** Judged against a target; `null` for purely informational rows. */
  good: boolean | null;
}

export function computeFinancialRatios(a: Analysis, rates: OverviewRates): RatioRow[] {
  const { savingsRate, passiveRatio, investRate } = rates;
  const cardTotal = a.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  const cardRatio = Math.abs(a.totalExp) > 0 ? (cardTotal / Math.abs(a.totalExp)) * 100 : 0;
  const avgTxSize = a.exp.length > 0 ? Math.abs(a.totalExp) / a.exp.length : 0;
  const feeRatio = a.totalInv > 0 ? (a.totalFee / a.totalInv) * 100 : 0;

  let best = { k: '', v: -Infinity };
  let worst = { k: '', v: Infinity };
  for (const mk of a.mKeys) {
    const n = a.months[mk]?.net ?? 0;
    if (n > best.v) best = { k: mk, v: n };
    if (n < worst.v) worst = { k: mk, v: n };
  }

  return [
    { label: 'Sparquote', value: fmtP(savingsRate), good: savingsRate >= 15 },
    { label: 'Investitionsrate', value: fmtP(investRate), good: investRate >= 15 },
    { label: 'Passives Einkommen', value: fmtP(passiveRatio), good: passiveRatio >= 5 },
    { label: 'Kartenzahlungsanteil', value: fmtP(cardRatio), good: cardRatio < 50 },
    { label: 'Gebührenquote', value: a.totalInv > 0 ? fmtP(feeRatio) : '–', good: a.totalInv > 0 ? feeRatio < 0.5 : null },
    { label: 'Ø Ausgabe pro Buchung', value: fmt(avgTxSize), good: null },
    { label: 'Ø Buchungen pro Monat', value: Math.round(a.enriched.length / a.mc) + '×', good: null },
    { label: 'Bester Monat', value: `${mLabel(best.k)} (${fmt(best.v)})`, good: null },
    { label: 'Schwächster Monat', value: `${mLabel(worst.k)} (${fmt(worst.v)})`, good: worst.v >= 0 ? null : false },
  ];
}

export interface Alert {
  color: 'red' | 'yellow' | 'green' | 'blue';
  title: string;
  desc: string;
}

export function computeAlerts(a: Analysis, rates: OverviewRates): Alert[] {
  const { savingsRate, investRate } = rates;
  const alerts: Alert[] = [];

  if (a.netBal < 0) {
    alerts.push({ color: 'red', title: 'Negativer Saldo', desc: `Ausgaben übersteigen Einnahmen um ${fmt(Math.abs(a.netBal))}.` });
  }
  if (savingsRate < 10 && a.netBal >= 0) {
    alerts.push({ color: 'yellow', title: 'Niedrige Sparquote', desc: `Nur ${fmtP(savingsRate)} des Einkommens verbleibt als Netto.` });
  }
  if (a.totalDiv > 0) {
    alerts.push({ color: 'green', title: 'Passives Einkommen', desc: `${fmt(a.totalDiv)} Dividenden aus ${Object.keys(a.byAsset).length} Positionen.` });
  }
  if (a.totalInv > 0) {
    alerts.push({ color: 'green', title: 'Sparplan aktiv', desc: `${fmt(a.totalInv)} in Wertpapiere investiert (Rate: ${fmtP(investRate)}).` });
  }
  if (a.totalFee > 100) {
    alerts.push({ color: 'yellow', title: 'Handelsgebühren', desc: `${fmt(a.totalFee)} an Gebühren — Sparpläne prüfen.` });
  }
  const bigExp = a.exp.filter((r) => Math.abs(r._amt) > 500);
  if (bigExp.length) {
    alerts.push({
      color: 'yellow',
      title: `${bigExp.length} große Ausgaben`,
      desc: `Über 500 € je Buchung — ${fmt(bigExp.reduce((s, r) => s + Math.abs(r._amt), 0))} gesamt.`,
    });
  }
  if (a.mKeys.length >= 3) {
    const last3Exp = a.mKeys.slice(-3).map((mk) => Math.abs(a.months[mk]?.expense ?? 0));
    if (last3Exp[2]! > last3Exp[1]! && last3Exp[1]! > last3Exp[0]!) {
      alerts.push({
        color: 'yellow',
        title: 'Steigende Ausgaben',
        desc: `Die Ausgaben sind 3 Monate in Folge gestiegen (${last3Exp.map((v) => fmt(v)).join(' → ')}).`,
      });
    }
    const last3Inc = a.mKeys.slice(-3).map((mk) => a.months[mk]?.income ?? 0);
    if (last3Inc[2]! < last3Inc[1]! && last3Inc[1]! < last3Inc[0]!) {
      alerts.push({ color: 'yellow', title: 'Sinkende Einnahmen', desc: 'Die Einnahmen sind 3 Monate in Folge gesunken.' });
    }
  }
  if (a.subscriptions.length > 0) {
    const subTotal = a.subscriptions.reduce((s, x) => s + x.amt, 0);
    const subPct = Math.abs(a.totalExp) / a.mc > 0 ? (subTotal / (Math.abs(a.totalExp) / a.mc)) * 100 : 0;
    if (subPct > 15) {
      alerts.push({
        color: 'yellow',
        title: 'Hoher Fixkostenanteil',
        desc: `${a.subscriptions.length} wiederkehrende Ausgaben kosten Ø ${fmt(subTotal)}/Monat (${fmtP(subPct)} der Ausgaben).`,
      });
    }
  }
  const cardTotal = a.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  const cardRatio = Math.abs(a.totalExp) > 0 ? (cardTotal / Math.abs(a.totalExp)) * 100 : 0;
  if (cardRatio > 60) {
    alerts.push({ color: 'blue', title: 'Kartenlastig', desc: `${fmtP(cardRatio)} aller Ausgaben über Kartenzahlungen — Budgetierung prüfen.` });
  }
  const negMonths = a.mKeys.filter((mk) => (a.months[mk]?.net ?? 0) < 0);
  if (negMonths.length >= 2) {
    alerts.push({
      color: 'red',
      title: `${negMonths.length} negative Monate`,
      desc: `${negMonths.map(mLabel).join(', ')} — wiederkehrendes Problem.`,
    });
  }

  return alerts;
}
