import { fmt, fmtP, fmtPts, mLabel, typeLabel } from '../../domain/format';
import { linReg } from '../../domain/stats';
import { TARGETS } from '../../domain/targets';
import type { Analysis, Hint, Tone } from '../../domain/types';
import { getFixedCosts, getSpendBreakdown } from '../shared/commonSelectors';
import { cardShare, computeOverviewRates } from './selectors';

/** Problems first, then things worth a look, information, and what already works. */
const TONE_ORDER: Record<Tone, number> = { red: 0, yellow: 1, blue: 2, green: 3 };

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

/** Strictly rising (+1) or falling (-1) over the last three months, else 0. */
function streak(values: number[]): -1 | 0 | 1 {
  const [a, b, c] = values.slice(-3);
  if (values.length < 3) return 0;
  if (c! > b! && b! > a!) return 1;
  if (c! < b! && b! < a!) return -1;
  return 0;
}

/**
 * Every hint of the Übersicht in one list — each topic once, sorted by urgency.
 * Replaces the former separate "Auffälligkeiten", trend and "Empfehlungen" lists,
 * which said several things twice.
 */
export function computeHints(a: Analysis): Hint[] {
  const hints: Hint[] = [];
  const add = (color: Tone, title: string, desc: string) => hints.push({ color, title, desc });
  const { savingsRate: sr, investRate: ir } = computeOverviewRates(a);
  const avgInc = a.avgInc;
  const avgExp = a.avgExp;
  const months = a.mKeys.map((mk) => a.months[mk]!);

  // Cashflow
  if (a.netBal < 0) {
    const top3 = getSpendBreakdown(a, 'type').entries.slice(0, 3);
    add('red', 'Negativer Cashflow',
      `Ausgaben (${fmt(Math.abs(a.totalExp))}) übersteigen Einnahmen (${fmt(a.totalInc)}) um ${fmt(Math.abs(a.netBal))}. Größte Posten: ${top3.map(([k, v]) => `${k}: ${fmt(v)}`).join(', ')}. Diese um 10 % zu senken spart ${fmt(sum(top3.map(([, v]) => v)) * 0.1)}.`);
  }
  const negMonths = a.mKeys.filter((mk) => a.months[mk]!.net < 0);
  if (negMonths.length >= 2) {
    add('red', `${negMonths.length} negative Monate`, `${negMonths.map(mLabel).join(', ')} — wiederkehrendes Muster.`);
  }

  // Saving
  if (a.netBal >= 0) {
    const gap = avgInc * (TARGETS.savingsRate / 100) - a.avgNet;
    if (sr < TARGETS.savingsRate) {
      add('yellow', `Sparquote ${fmtP(sr)} — unter Ziel`,
        `Ziel sind ${fmtP(TARGETS.savingsRate)}: noch ${fmt(gap)}/Monat mehr sparen. Ein Dauerauftrag direkt nach Gehaltseingang hilft.`);
    } else if (sr < 35) {
      add('green', `Starke Sparquote: ${fmtP(sr)}`, `Über dem Ziel von ${fmtP(TARGETS.savingsRate)} — ${fmt(a.avgNet)}/Monat für den Vermögensaufbau.`);
    } else {
      const years = Math.round((25 * (1 - sr / 100)) / (sr / 100));
      add('green', `Exzellente Sparquote: ${fmtP(sr)}`, `Bei diesem Tempo in rund ${years} Jahren finanziell unabhängig (4-%-Regel).`);
    }
  }

  // Investing (net: buys − sells)
  if (ir < TARGETS.investRate) {
    add('yellow', `Investitionsrate ${fmtP(ir)} — Potenzial vorhanden`,
      `Ziel: ${fmtP(TARGETS.investRate)} des Einkommens, also ${fmt(avgInc * (TARGETS.investRate / 100))}/Monat. Automatische Sparpläne sind günstig und disziplinieren.`);
  } else {
    add('green', `Gute Investitionsrate: ${fmtP(ir)}`, `${fmt(a.totalInv - a.totalSold)} netto investiert. Rebalancing 1–2× im Jahr empfohlen.`);
  }

  // Dividends and diversification
  const positions = Object.keys(a.byAsset).length;
  if (a.totalDiv > 0) {
    const divMonthly = a.totalDiv / a.mc;
    add('green', 'Passives Einkommen',
      `${fmt(a.totalDiv)} Dividenden aus ${positions} Positionen, Ø ${fmt(divMonthly)}/Monat — deckt ${fmtP(avgExp > 0 ? (divMonthly / avgExp) * 100 : 0)} der Ausgaben.`);
    const [topName, top] = Object.entries(a.byAsset).sort((x, y) => y[1].total - x[1].total)[0]!;
    if (top.total / a.totalDiv > 0.3) {
      add('yellow', 'Dividenden-Klumpenrisiko',
        `${topName} macht ${fmtP((top.total / a.totalDiv) * 100)} aller Dividenden aus. Empfohlen: höchstens 25 % pro Position.`);
    }
  }
  if (positions > 0 && positions < 5) {
    add('yellow', `Nur ${positions} Dividendenpositionen`, 'Wenige Positionen erhöhen das Klumpenrisiko. Breit gestreute Dividenden-ETFs als Basis nutzen.');
  }

  // Fees
  if (a.totalFee > 0 && a.totalInv > 0) {
    const fr = (a.totalFee / a.totalInv) * 100;
    if (fr >= TARGETS.feeRate) {
      add('yellow', `Gebühren ${fmt(a.totalFee)} (${fmtP(fr)} der Käufe)`,
        `Hochgerechnet ${fmt((a.totalFee / a.mc) * 12)}/Jahr. Sparpläne statt Einzelorders sind oft kostenlos.`);
    }
  }

  // Spending
  const bigExp = a.exp.filter((r) => Math.abs(r._amt) > 500).sort((x, y) => x._amt - y._amt);
  if (bigExp.length) {
    add('yellow', `${bigExp.length} Ausgaben über 500 €`,
      `Zusammen ${fmt(sum(bigExp.map((r) => Math.abs(r._amt))))}. Größte: ${bigExp.slice(0, 3).map((r) => `${r._name || typeLabel(r._type)} (${fmt(Math.abs(r._amt))})`).join(', ')}.`);
  }
  const fixed = getFixedCosts(a);
  if (fixed.rows.length) {
    const pct = avgExp > 0 ? (fixed.totalPerMonth / avgExp) * 100 : 0;
    add(pct > 50 ? 'yellow' : 'blue', `Fixkosten ${fmt(fixed.totalPerMonth)}/Monat`,
      `${fixed.rows.length} Posten, ${fmtP(pct)} der Ausgaben, ≈ ${fmt(fixed.totalPerMonth * 12, 0)}/Jahr. Größte: ${fixed.rows.slice(0, 3).map((f) => f.name).join(', ')}.`);
  }
  const card = cardShare(a);
  if (card > TARGETS.cardShare + 10) {
    add('blue', `${fmtP(card)} der Ausgaben per Karte`, `Ø ${fmt((card / 100) * avgExp)}/Monat über Karte. Ein Wochenbudget macht Kartenausgaben bewusster.`);
  }
  const topMerch = Object.entries(a.merchants).sort((x, y) => y[1].total - x[1].total).slice(0, 3);
  const topPct = topMerch.length === 3 && a.totalExp < 0 ? (sum(topMerch.map(([, v]) => v.total)) / Math.abs(a.totalExp)) * 100 : 0;
  if (topPct > 30) {
    add('blue', `Top-3-Empfänger: ${fmtP(topPct)} der Ausgaben`, `${topMerch.map(([n, v]) => `${n}: ${fmt(v.total)}`).join(', ')}. Preise vergleichen lohnt sich hier am meisten.`);
  }
  const dayOf = (r: (typeof a.exp)[number]) => r._date.getUTCDay();
  const weekend = sum(a.exp.filter((r) => dayOf(r) === 0 || dayOf(r) === 6).map((r) => Math.abs(r._amt))) / (a.mc * 8.7);
  const weekday = sum(a.exp.filter((r) => dayOf(r) >= 1 && dayOf(r) <= 5).map((r) => Math.abs(r._amt))) / (a.mc * 21.7);
  if (weekend > 0 && weekday > 0 && weekend > weekday * 1.5) {
    add('blue', `Wochenende: ${fmtP((weekend / weekday) * 100 - 100)} höhere Tagesausgaben`,
      `Ø ${fmt(weekend)}/Tag am Wochenende vs. ${fmt(weekday)}/Tag unter der Woche.`);
  }

  // Stability and reserves
  const nets = months.map((m) => m.net);
  const netStd = Math.sqrt(sum(nets.map((v) => (v - a.avgNet) ** 2)) / nets.length);
  if (a.avgNet !== 0 && netStd > Math.abs(a.avgNet) * 1.5) {
    add('yellow', 'Stark schwankender Cashflow',
      `σ ${fmt(netStd)} bei Ø ${fmt(a.avgNet)}/Monat (${fmt(Math.min(...nets))} bis ${fmt(Math.max(...nets))}). Puffer von ${fmt(avgExp * 2.5)} empfohlen.`);
  }
  if (a.avgNet > 0) {
    const target = avgExp * 4;
    add(a.avgNet > avgExp * 0.2 ? 'green' : 'yellow', `Notfallrücklage: ${fmt(target, 0)}`,
      `3–6 Monatsausgaben (${fmt(avgExp * 3, 0)}–${fmt(avgExp * 6, 0)}). Beim aktuellen Überschuss in ${Math.ceil(target / a.avgNet)} Monaten erreichbar.`);
  }

  // Trends: a three-month streak says more than the regression slope, so it wins.
  if (months.length >= 2) trends(months, add);

  return hints.sort((x, y) => TONE_ORDER[x.color] - TONE_ORDER[y.color]);
}

function trends(months: Analysis['months'][string][], add: (color: Tone, title: string, desc: string) => void): void {
  const incomes = months.map((m) => m.income);
  const expenses = months.map((m) => Math.abs(m.expense));
  const incStreak = streak(incomes);
  const expStreak = streak(expenses);
  const last3 = (xs: number[]) => xs.slice(-3).map((v) => fmt(v, 0)).join(' → ');

  if (expStreak === 1) add('yellow', 'Ausgaben 3 Monate steigend', `${last3(expenses)} — jetzt gegensteuern.`);
  else {
    const { slope } = linReg(expenses);
    if (slope > 50) add('yellow', 'Ausgaben steigend', `Die monatlichen Ausgaben wachsen um Ø ${fmt(slope)}/Monat.`);
    else if (slope < -50) add('green', 'Ausgaben sinkend', `Die Ausgaben sinken um Ø ${fmt(Math.abs(slope))}/Monat.`);
  }

  if (incStreak === -1) add('yellow', 'Einnahmen 3 Monate sinkend', `${last3(incomes)} — Ursache prüfen.`);
  else if (incStreak === 1) add('green', 'Einnahmen 3 Monate steigend', `${last3(incomes)} — Zuwachs direkt investieren oder zurücklegen.`);
  else {
    const { slope } = linReg(incomes);
    if (slope > 50) add('green', 'Einnahmen steigend', `Die monatlichen Einnahmen steigen um Ø ${fmt(slope)}/Monat.`);
    else if (slope < -50) add('yellow', 'Einnahmen rückläufig', `Die monatlichen Einnahmen sinken um Ø ${fmt(Math.abs(slope))}/Monat.`);
  }

  const srs = months.map((m) => m.savingsRate);
  const { slope: srSlope } = linReg(srs);
  const range = `Von ${fmtP(srs[0]!)} auf ${fmtP(srs[srs.length - 1]!)}.`;
  if (srSlope > 1) add('green', 'Sparquote verbessert sich', `Plus Ø ${fmtPts(srSlope, false)} pro Monat. ${range}`);
  else if (srSlope < -1) add('yellow', 'Sparquote sinkt', `Minus Ø ${fmtPts(Math.abs(srSlope), false)} pro Monat. ${range}`);

  const divs = months.map((m) => m.dividend);
  const avgDiv = sum(divs) / divs.length;
  if (avgDiv > 50 && linReg(divs).slope > 10) {
    add('green', 'Passives Einkommen wächst', `Dividenden steigen um Ø ${fmt(linReg(divs).slope)}/Monat (Ø ${fmt(avgDiv)}/Monat).`);
  }
}
