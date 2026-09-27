import { aggregate } from '../../domain/analyze';
import { fmt, fmtP } from '../../domain/format';
import { linReg } from '../../domain/stats';
import type { Analysis, EnrichedRow } from '../../domain/types';

/**
 * Per-month views of an analysis: each month aggregated on its own, feeding the
 * trend hints on the Übersicht (e.g. a rising savings rate or growing dividends).
 */
export interface MonthSnapshot {
  month: string;
  analysis: Analysis;
}

/** Splits the enriched rows by month (one pass) and aggregates each month in isolation. */
export function buildMonthlySnapshots(a: Analysis): MonthSnapshot[] {
  const byMonth = new Map<string, EnrichedRow[]>();
  for (const r of a.enriched) {
    const rows = byMonth.get(r._month);
    if (rows) rows.push(r);
    else byMonth.set(r._month, [r]);
  }
  return a.mKeys.flatMap((mk) => {
    const rows = byMonth.get(mk);
    return rows ? [{ month: mk, analysis: aggregate(rows) }] : [];
  });
}

// ── Trends ────────────────────────────────────────────────────
export interface Trend {
  color: 'green' | 'red' | 'blue' | 'yellow';
  title: string;
  desc: string;
}

export function computeTrends(snapshots: MonthSnapshot[]): Trend[] {
  const trends: Trend[] = [];
  const n = snapshots.length;

  const incomes = snapshots.map((s) => s.analysis.totalInc);
  const { slope: incSlope } = linReg(incomes);
  if (incSlope > 50) trends.push({ color: 'green', title: 'Einnahmen steigend', desc: `Die monatlichen Einnahmen steigen um durchschnittlich ${fmt(incSlope)} pro Monat. Positiver Langzeittrend.` });
  else if (incSlope < -50) trends.push({ color: 'red', title: 'Einnahmen rückläufig', desc: `Die monatlichen Einnahmen sinken um Ø ${fmt(Math.abs(incSlope))}/Monat. Ursache prüfen.` });
  else trends.push({ color: 'blue', title: 'Einnahmen stabil', desc: `Die Einnahmen bewegen sich konstant um Ø ${fmt(incomes.reduce((s, v) => s + v, 0) / n)}/Monat.` });

  const expenses = snapshots.map((s) => Math.abs(s.analysis.totalExp));
  const { slope: expSlope } = linReg(expenses);
  if (expSlope > 50) trends.push({ color: 'yellow', title: 'Ausgaben steigend', desc: `Die monatlichen Ausgaben wachsen um Ø ${fmt(expSlope)}/Monat. Kostenkontrolle empfohlen.` });
  else if (expSlope < -50) trends.push({ color: 'green', title: 'Ausgaben sinkend', desc: `Die Ausgaben sinken um Ø ${fmt(Math.abs(expSlope))}/Monat. Gute Disziplin.` });

  const srs = snapshots.map((s) => (s.analysis.totalInc > 0 ? ((s.analysis.totalInc + s.analysis.totalExp) / s.analysis.totalInc) * 100 : 0));
  const { slope: srSlope } = linReg(srs);
  if (srSlope > 1) trends.push({ color: 'green', title: 'Sparquote verbessert sich', desc: `Die Sparquote steigt um Ø ${fmtP(srSlope).replace(' %', '')} Prozentpunkte pro Monat. Von ${fmtP(srs[0]!)} auf ${fmtP(srs[n - 1]!)}.` });
  else if (srSlope < -1) trends.push({ color: 'yellow', title: 'Sparquote sinkt', desc: `Die Sparquote fällt um Ø ${fmtP(Math.abs(srSlope)).replace(' %', '')} Prozentpunkte pro Monat. Von ${fmtP(srs[0]!)} auf ${fmtP(srs[n - 1]!)}.` });

  const divs = snapshots.map((s) => s.analysis.totalDiv);
  const avgDiv = divs.reduce((s, v) => s + v, 0) / n;
  if (avgDiv > 50) {
    const { slope: divSlope } = linReg(divs);
    if (divSlope > 10) trends.push({ color: 'green', title: 'Passives Einkommen wächst', desc: `Dividenden steigen um Ø ${fmt(divSlope)}/Monat. Das passive Einkommen (Ø ${fmt(avgDiv)}/Monat) wird ein zunehmend relevanter Einkommensfaktor.` });
  }

  const cardRatios = snapshots.map((s) => {
    const a = s.analysis;
    const cardExp = a.exp.filter((r) => r._isCard).reduce((sum, r) => sum + Math.abs(r._amt), 0);
    return Math.abs(a.totalExp) > 0 ? (cardExp / Math.abs(a.totalExp)) * 100 : 0;
  });
  const avgCardRatio = cardRatios.reduce((s, v) => s + v, 0) / n;
  if (avgCardRatio > 30) trends.push({ color: 'blue', title: `Ø ${Math.round(avgCardRatio)} % per Karte`, desc: `Durchschnittlich ${fmtP(avgCardRatio)} der Ausgaben über Kartenzahlungen. Bandbreite: ${fmtP(Math.min(...cardRatios))} bis ${fmtP(Math.max(...cardRatios))}.` });

  return trends;
}
