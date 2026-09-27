import { fmt, fmtP, mLabel } from '../../domain/format';
import { TARGETS } from '../../domain/targets';
import { linReg } from '../../domain/stats';
import type { Analysis } from '../../domain/types';
import { getFixedCosts } from '../shared/commonSelectors';

export interface OverviewRates {
  savingsRate: number;
  passiveRatio: number;
  investRate: number;
}

/** Share of spending paid by card, in %. */
export function cardShare(a: Analysis): number {
  const card = a.mKeys.reduce((s, mk) => s + a.months[mk]!.cardExpense, 0);
  return a.totalExp < 0 ? (card / Math.abs(a.totalExp)) * 100 : 0;
}

/** Buys minus sells — what actually stayed invested. */
export function netInvested(a: Analysis): number {
  return a.totalInv - a.totalSold;
}

export function computeOverviewRates(a: Analysis): OverviewRates {
  return {
    savingsRate: a.totalInc > 0 ? (a.netBal / a.totalInc) * 100 : 0,
    passiveRatio: a.totalInc > 0 ? (a.totalDiv / a.totalInc) * 100 : 0,
    investRate: a.totalInc > 0 ? (netInvested(a) / a.totalInc) * 100 : 0,
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
      status: rates.savingsRate >= TARGETS.savingsRate ? 'good' : 'warn',
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
  const cardRatio = cardShare(a);
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
    { label: 'Sparquote', value: fmtP(savingsRate), good: savingsRate >= TARGETS.savingsRate },
    { label: 'Investitionsrate (netto)', value: fmtP(investRate), good: investRate >= TARGETS.investRate },
    { label: 'Passives Einkommen', value: fmtP(passiveRatio), good: passiveRatio >= TARGETS.passiveRate },
    { label: 'Kartenzahlungsanteil', value: fmtP(cardRatio), good: cardRatio < TARGETS.cardShare },
    { label: 'Gebührenquote', value: a.totalInv > 0 ? fmtP(feeRatio) : '–', good: a.totalInv > 0 ? feeRatio < TARGETS.feeRate : null },
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
  if (savingsRate < TARGETS.savingsRate / 2 && a.netBal >= 0) {
    alerts.push({ color: 'yellow', title: 'Niedrige Sparquote', desc: `Nur ${fmtP(savingsRate)} des Einkommens verbleibt als Netto.` });
  }
  if (a.totalDiv > 0) {
    alerts.push({ color: 'green', title: 'Passives Einkommen', desc: `${fmt(a.totalDiv)} Dividenden aus ${Object.keys(a.byAsset).length} Positionen.` });
  }
  if (netInvested(a) > 0) {
    alerts.push({ color: 'green', title: 'Sparplan aktiv', desc: `${fmt(netInvested(a))} netto in Wertpapiere investiert (Rate: ${fmtP(investRate)}).` });
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
  const fixed = getFixedCosts(a);
  const fixedPct = a.avgExp > 0 ? (fixed.totalPerMonth / a.avgExp) * 100 : 0;
  if (fixedPct > 50) {
    alerts.push({
      color: 'yellow',
      title: 'Hoher Fixkostenanteil',
      desc: `${fixed.rows.length} Fixkosten binden Ø ${fmt(fixed.totalPerMonth)}/Monat (${fmtP(fixedPct)} der Ausgaben).`,
    });
  }
  const cardRatio = cardShare(a);
  if (cardRatio > TARGETS.cardShare + 10) {
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

/** Direction of the monthly series (linear regression over the months), as hints. */
export function computeTrends(a: Analysis): Alert[] {
  const trends: Alert[] = [];
  const months = a.mKeys.map((mk) => a.months[mk]!);
  const n = months.length;

  const incomes = months.map((m) => m.income);
  const { slope: incSlope } = linReg(incomes);
  if (incSlope > 50) trends.push({ color: 'green', title: 'Einnahmen steigend', desc: `Die monatlichen Einnahmen steigen um durchschnittlich ${fmt(incSlope)} pro Monat. Positiver Langzeittrend.` });
  else if (incSlope < -50) trends.push({ color: 'red', title: 'Einnahmen rückläufig', desc: `Die monatlichen Einnahmen sinken um Ø ${fmt(Math.abs(incSlope))}/Monat. Ursache prüfen.` });
  else trends.push({ color: 'blue', title: 'Einnahmen stabil', desc: `Die Einnahmen bewegen sich konstant um Ø ${fmt(incomes.reduce((s, v) => s + v, 0) / n)}/Monat.` });

  const expenses = months.map((m) => Math.abs(m.expense));
  const { slope: expSlope } = linReg(expenses);
  if (expSlope > 50) trends.push({ color: 'yellow', title: 'Ausgaben steigend', desc: `Die monatlichen Ausgaben wachsen um Ø ${fmt(expSlope)}/Monat. Kostenkontrolle empfohlen.` });
  else if (expSlope < -50) trends.push({ color: 'green', title: 'Ausgaben sinkend', desc: `Die Ausgaben sinken um Ø ${fmt(Math.abs(expSlope))}/Monat. Gute Disziplin.` });

  const srs = months.map((m) => m.savingsRate);
  const { slope: srSlope } = linReg(srs);
  if (srSlope > 1) trends.push({ color: 'green', title: 'Sparquote verbessert sich', desc: `Die Sparquote steigt um Ø ${fmtP(srSlope).replace(' %', '')} Prozentpunkte pro Monat. Von ${fmtP(srs[0]!)} auf ${fmtP(srs[n - 1]!)}.` });
  else if (srSlope < -1) trends.push({ color: 'yellow', title: 'Sparquote sinkt', desc: `Die Sparquote fällt um Ø ${fmtP(Math.abs(srSlope)).replace(' %', '')} Prozentpunkte pro Monat. Von ${fmtP(srs[0]!)} auf ${fmtP(srs[n - 1]!)}.` });

  const divs = months.map((m) => m.dividend);
  const avgDiv = divs.reduce((s, v) => s + v, 0) / n;
  if (avgDiv > 50) {
    const { slope: divSlope } = linReg(divs);
    if (divSlope > 10) trends.push({ color: 'green', title: 'Passives Einkommen wächst', desc: `Dividenden steigen um Ø ${fmt(divSlope)}/Monat. Das passive Einkommen (Ø ${fmt(avgDiv)}/Monat) wird ein zunehmend relevanter Einkommensfaktor.` });
  }

  const cardRatios = months.map((m) => (m.expense < 0 ? (m.cardExpense / Math.abs(m.expense)) * 100 : 0));
  const avgCardRatio = cardRatios.reduce((s, v) => s + v, 0) / n;
  if (avgCardRatio > 30) trends.push({ color: 'blue', title: `Ø ${Math.round(avgCardRatio)} % per Karte`, desc: `Durchschnittlich ${fmtP(avgCardRatio)} der Ausgaben über Kartenzahlungen. Bandbreite: ${fmtP(Math.min(...cardRatios))} bis ${fmtP(Math.max(...cardRatios))}.` });

  return trends;
}
