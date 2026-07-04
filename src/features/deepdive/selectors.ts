import { analyze } from '../../domain/analyze';
import { fmt, fmtP, fmtPP, mLabel, typeLabel } from '../../domain/format';
import { linReg } from '../../domain/stats';
import type { Analysis } from '../../domain/types';

export interface MonthSnapshot {
  month: string;
  analysis: Analysis;
}

/** Splits the uploaded CSV's enriched rows by month and re-analyzes each month in isolation. */
export function buildMonthlySnapshots(a: Analysis): MonthSnapshot[] {
  const snapshots: MonthSnapshot[] = [];
  for (const mk of a.mKeys) {
    const monthRows = a.enriched.filter((r) => r._month === mk);
    if (monthRows.length) snapshots.push({ month: mk, analysis: analyze(monthRows) });
  }
  return snapshots;
}

// ── KPIs ──────────────────────────────────────────────────────
export interface DeepDiveKpi {
  label: string;
  value: string;
  cls: string;
  sub: string;
}

export function computeDeepDiveKpis(snapshots: MonthSnapshot[]): DeepDiveKpi[] {
  const n = snapshots.length;
  const totalInc = snapshots.reduce((s, sn) => s + sn.analysis.totalInc, 0);
  const totalExp = snapshots.reduce((s, sn) => s + Math.abs(sn.analysis.totalExp), 0);
  const totalDiv = snapshots.reduce((s, sn) => s + sn.analysis.totalDiv, 0);
  const netBal = totalInc - totalExp;
  const savingsRate = totalInc > 0 ? (netBal / totalInc) * 100 : 0;
  const avgExp = totalExp / n;

  const l = snapshots[n - 1]!.analysis;
  const p = snapshots[n - 2]!.analysis;
  const incChg = p.totalInc > 0 ? ((l.totalInc - p.totalInc) / p.totalInc) * 100 : 0;

  return [
    { label: 'Gesamteinnahmen', value: fmt(totalInc), cls: 'income', sub: `Ø ${fmt(totalInc / n)}/Monat` },
    { label: 'Gesamtausgaben', value: fmt(totalExp), cls: 'expense', sub: `Ø ${fmt(avgExp)}/Monat` },
    { label: 'Netto-Cashflow', value: fmt(netBal), cls: netBal >= 0 ? 'balance' : 'expense', sub: netBal >= 0 ? 'Positiv' : 'Negativ' },
    { label: 'Sparquote gesamt', value: fmtP(savingsRate), cls: savingsRate >= 20 ? 'income' : savingsRate >= 10 ? 'warn' : 'expense', sub: 'Ziel: ≥ 20%' },
    { label: 'Dividenden-Einnahmen', value: fmt(totalDiv), cls: 'dividend', sub: `Ø ${fmt(totalDiv / n)}/Monat` },
    { label: 'Letzter Monat', value: fmt(l.totalInc + l.totalExp), cls: l.totalInc + l.totalExp >= 0 ? 'income' : 'expense', sub: `Einnahmen ${incChg >= 0 ? '▲' : '▼'} ${fmtPP(incChg)}` },
  ];
}

// ── Charts ────────────────────────────────────────────────────
export interface CategoryStackSeries {
  label: string;
  data: number[];
}

export interface DeepDiveChartsData {
  labels: string[];
  income: number[];
  expense: number[];
  dividend: number[];
  net: number[];
  savingsRate: number[];
  cumNet: number[];
  categoryStack: CategoryStackSeries[];
}

export function computeDeepDiveChartsData(snapshots: MonthSnapshot[]): DeepDiveChartsData {
  const labels = snapshots.map((s) => mLabel(s.month));
  const income = snapshots.map((s) => s.analysis.totalInc);
  const expense = snapshots.map((s) => Math.abs(s.analysis.totalExp));
  const dividend = snapshots.map((s) => s.analysis.totalDiv);
  const net = snapshots.map((s) => s.analysis.totalInc + s.analysis.totalExp);
  const savingsRate = snapshots.map((s) =>
    s.analysis.totalInc > 0 ? ((s.analysis.totalInc + s.analysis.totalExp) / s.analysis.totalInc) * 100 : 0,
  );
  let cum = 0;
  const cumNet = net.map((v) => (cum += v));

  const allCats: Record<string, true> = {};
  for (const s of snapshots) for (const k of Object.keys(s.analysis.expCat)) allCats[k] = true;
  const catKeys = Object.keys(allCats)
    .sort((a, b) => {
      const totA = snapshots.reduce((sum, s) => sum + (s.analysis.expCat[a] ?? 0), 0);
      const totB = snapshots.reduce((sum, s) => sum + (s.analysis.expCat[b] ?? 0), 0);
      return totB - totA;
    })
    .slice(0, 8);
  const categoryStack = catKeys.map((cat) => ({
    label: cat,
    data: snapshots.map((s) => s.analysis.expCat[cat] ?? 0),
  }));

  return { labels, income, expense, dividend, net, savingsRate, cumNet, categoryStack };
}

// ── Month-over-month changes ─────────────────────────────────
export interface MonthChange {
  color: 'green' | 'red' | 'yellow' | 'blue';
  icon: string;
  title: string;
  desc: string;
  impact: number;
}

export function computeMonthChanges(snapshots: MonthSnapshot[], month: string | null): MonthChange[] {
  const idx = snapshots.findIndex((s) => s.month === month);
  if (idx < 1) return [];

  const curr = snapshots[idx]!.analysis;
  const prev = snapshots[idx - 1]!.analysis;
  const changes: MonthChange[] = [];

  const incDiff = curr.totalInc - prev.totalInc;
  const incPct = prev.totalInc > 0 ? (incDiff / prev.totalInc) * 100 : 0;
  changes.push({
    color: incDiff >= 0 ? 'green' : 'red', icon: incDiff >= 0 ? '▲' : '▼',
    title: `Einnahmen ${incDiff >= 0 ? 'gestiegen' : 'gesunken'}: ${fmtPP(incPct)}`,
    desc: `${fmt(curr.totalInc)} vs. ${fmt(prev.totalInc)} im Vormonat (${incDiff >= 0 ? '+' : ''}${fmt(incDiff)}).`,
    impact: Math.abs(incDiff),
  });

  const expDiff = Math.abs(curr.totalExp) - Math.abs(prev.totalExp);
  const expPct = Math.abs(prev.totalExp) > 0 ? (expDiff / Math.abs(prev.totalExp)) * 100 : 0;
  changes.push({
    color: expDiff <= 0 ? 'green' : 'red', icon: expDiff <= 0 ? '▼' : '▲',
    title: `Ausgaben ${expDiff <= 0 ? 'gesunken' : 'gestiegen'}: ${fmtPP(expPct)}`,
    desc: `${fmt(Math.abs(curr.totalExp))} vs. ${fmt(Math.abs(prev.totalExp))} (${expDiff >= 0 ? '+' : ''}${fmt(expDiff)}).`,
    impact: Math.abs(expDiff),
  });

  const currSR = curr.totalInc > 0 ? ((curr.totalInc + curr.totalExp) / curr.totalInc) * 100 : 0;
  const prevSR = prev.totalInc > 0 ? ((prev.totalInc + prev.totalExp) / prev.totalInc) * 100 : 0;
  const srDiff = currSR - prevSR;
  changes.push({
    color: srDiff >= 0 ? 'green' : 'yellow', icon: srDiff >= 0 ? '▲' : '▼',
    title: `Sparquote: ${fmtP(currSR)} (${srDiff >= 0 ? '+' : ''}${srDiff.toFixed(1)} PP)`,
    desc: `${fmtP(prevSR)} → ${fmtP(currSR)}. ${currSR >= 20 ? 'Über dem Zielwert von 20%.' : 'Unter dem Zielwert von 20%.'}`,
    impact: Math.abs(srDiff) * 10,
  });

  const divDiff = curr.totalDiv - prev.totalDiv;
  if (curr.totalDiv > 0 || prev.totalDiv > 0) {
    const divPct = prev.totalDiv > 0 ? (divDiff / prev.totalDiv) * 100 : 0;
    changes.push({
      color: divDiff >= 0 ? 'green' : 'yellow', icon: '💰',
      title: `Dividenden: ${fmt(curr.totalDiv)} (${divDiff >= 0 ? '+' : ''}${fmt(divDiff)})`,
      desc: `${prev.totalDiv > 0 ? fmtPP(divPct) + ' zum Vormonat.' : 'Erstmals Dividenden erhalten.'} Aus ${Object.keys(curr.byAsset).length} Positionen.`,
      impact: Math.abs(divDiff),
    });
  }

  const allCats = new Set([...Object.keys(curr.expCat), ...Object.keys(prev.expCat)]);
  const catDeltas: { cat: string; curr: number; prev: number; diff: number }[] = [];
  for (const cat of allCats) {
    const cv = curr.expCat[cat] ?? 0;
    const pv = prev.expCat[cat] ?? 0;
    const diff = cv - pv;
    if (Math.abs(diff) > 10) catDeltas.push({ cat, curr: cv, prev: pv, diff });
  }
  catDeltas.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  for (const cd of catDeltas.slice(0, 4)) {
    const pct = cd.prev > 0 ? (cd.diff / cd.prev) * 100 : 0;
    changes.push({
      color: cd.diff > 0 ? 'red' : 'green', icon: cd.diff > 0 ? '📈' : '📉',
      title: `${cd.cat}: ${cd.diff > 0 ? '+' : ''}${fmt(cd.diff)}`,
      desc: `${fmt(cd.prev)} → ${fmt(cd.curr)}${cd.prev > 0 ? ` (${fmtPP(pct)})` : ' (neu)'}. ${cd.diff > 0 ? 'Anstieg prüfen.' : 'Einsparung erzielt.'}`,
      impact: Math.abs(cd.diff),
    });
  }

  const currMerch = new Set(Object.keys(curr.merchants));
  const prevMerch = new Set(Object.keys(prev.merchants));
  const newMerch = [...currMerch].filter((m) => !prevMerch.has(m));
  if (newMerch.length > 0) {
    const newTotal = newMerch.reduce((s, m) => s + curr.merchants[m]!.total, 0);
    changes.push({
      color: 'blue', icon: '🆕', title: `${newMerch.length} neue Händler`,
      desc: `${newMerch.slice(0, 4).join(', ')}${newMerch.length > 4 ? ' …' : ''} — Gesamt: ${fmt(newTotal)}.`,
      impact: newTotal,
    });
  }

  changes.sort((a, b) => b.impact - a.impact);
  return changes;
}

// ── Improved / worsened ──────────────────────────────────────
export interface ImprovedWorsenedItem {
  icon: string;
  title: string;
  desc: string;
}

export interface ImprovedWorsenedResult {
  improved: ImprovedWorsenedItem[];
  worsened: ImprovedWorsenedItem[];
}

export function computeImprovedWorsened(snapshots: MonthSnapshot[]): ImprovedWorsenedResult {
  const n = snapshots.length;
  const latest = snapshots[n - 1]!.analysis;
  const prev = snapshots[n - 2]!.analysis;
  const improved: ImprovedWorsenedItem[] = [];
  const worsened: ImprovedWorsenedItem[] = [];

  if (latest.totalInc > prev.totalInc * 1.03) improved.push({ icon: '💵', title: 'Einnahmen gestiegen', desc: `${fmt(latest.totalInc)} vs. ${fmt(prev.totalInc)} — plus ${fmt(latest.totalInc - prev.totalInc)}.` });
  else if (latest.totalInc < prev.totalInc * 0.97) worsened.push({ icon: '💵', title: 'Einnahmen gesunken', desc: `${fmt(latest.totalInc)} vs. ${fmt(prev.totalInc)} — minus ${fmt(prev.totalInc - latest.totalInc)}.` });

  if (Math.abs(latest.totalExp) < Math.abs(prev.totalExp) * 0.97) improved.push({ icon: '📉', title: 'Ausgaben reduziert', desc: `${fmt(Math.abs(latest.totalExp))} vs. ${fmt(Math.abs(prev.totalExp))} — ${fmt(Math.abs(prev.totalExp) - Math.abs(latest.totalExp))} weniger.` });
  else if (Math.abs(latest.totalExp) > Math.abs(prev.totalExp) * 1.03) worsened.push({ icon: '📈', title: 'Ausgaben gestiegen', desc: `${fmt(Math.abs(latest.totalExp))} vs. ${fmt(Math.abs(prev.totalExp))} — ${fmt(Math.abs(latest.totalExp) - Math.abs(prev.totalExp))} mehr.` });

  const lSR = latest.totalInc > 0 ? ((latest.totalInc + latest.totalExp) / latest.totalInc) * 100 : 0;
  const pSR = prev.totalInc > 0 ? ((prev.totalInc + prev.totalExp) / prev.totalInc) * 100 : 0;
  if (lSR > pSR + 2) improved.push({ icon: '🎯', title: `Sparquote verbessert: ${fmtP(lSR)}`, desc: `Von ${fmtP(pSR)} auf ${fmtP(lSR)} — ${(lSR - pSR).toFixed(1)} Prozentpunkte mehr.` });
  else if (lSR < pSR - 2) worsened.push({ icon: '🎯', title: `Sparquote verschlechtert: ${fmtP(lSR)}`, desc: `Von ${fmtP(pSR)} auf ${fmtP(lSR)} — ${(pSR - lSR).toFixed(1)} Prozentpunkte weniger.` });

  if (latest.totalDiv > prev.totalDiv * 1.05 && latest.totalDiv > 0) improved.push({ icon: '💰', title: 'Dividenden gewachsen', desc: `${fmt(latest.totalDiv)} vs. ${fmt(prev.totalDiv)} — passives Einkommen steigt.` });
  else if (latest.totalDiv < prev.totalDiv * 0.9 && prev.totalDiv > 50) worsened.push({ icon: '💰', title: 'Dividenden gesunken', desc: `${fmt(latest.totalDiv)} vs. ${fmt(prev.totalDiv)} — Dividendeneinnahmen prüfen.` });

  const allCats = new Set([...Object.keys(latest.expCat), ...Object.keys(prev.expCat)]);
  for (const cat of allCats) {
    const cv = latest.expCat[cat] ?? 0;
    const pv = prev.expCat[cat] ?? 0;
    const diff = cv - pv;
    if (diff < -50) improved.push({ icon: '✅', title: `${cat} reduziert`, desc: `${fmt(pv)} → ${fmt(cv)} — ${fmt(Math.abs(diff))} Einsparung.` });
    else if (diff > 100) worsened.push({ icon: '⚠️', title: `${cat} gestiegen`, desc: `${fmt(pv)} → ${fmt(cv)} — ${fmt(diff)} mehr als im Vormonat.` });
  }

  const lCard = latest.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  const pCard = prev.exp.filter((r) => r._isCard).reduce((s, r) => s + Math.abs(r._amt), 0);
  if (lCard < pCard * 0.85 && pCard > 100) improved.push({ icon: '💳', title: 'Kartenzahlungen reduziert', desc: `${fmt(lCard)} vs. ${fmt(pCard)} — ${fmt(pCard - lCard)} weniger Kartenausgaben.` });
  else if (lCard > pCard * 1.2 && lCard > 100) worsened.push({ icon: '💳', title: 'Kartenzahlungen gestiegen', desc: `${fmt(lCard)} vs. ${fmt(pCard)} — Einzelausgaben prüfen.` });

  return { improved, worsened };
}

// ── Best / worst months ───────────────────────────────────────
export interface ScoredMonth {
  month: string;
  netValue: number;
  income: string;
  expense: string;
  net: string;
  savingsRate: string;
  dividend: string;
  txCount: number;
}

export interface BestWorstMonthsResult {
  best: ScoredMonth[];
  worst: ScoredMonth[];
}

export function computeBestWorstMonths(snapshots: MonthSnapshot[]): BestWorstMonthsResult {
  const scored: ScoredMonth[] = snapshots.map((s) => {
    const a = s.analysis;
    const net = a.totalInc + a.totalExp;
    const sr = a.totalInc > 0 ? (net / a.totalInc) * 100 : 0;
    return {
      month: s.month, netValue: net,
      income: fmt(a.totalInc), expense: fmt(Math.abs(a.totalExp)), net: fmt(net),
      savingsRate: fmtP(sr), dividend: fmt(a.totalDiv), txCount: a.enriched.length,
    };
  });

  const best = [...scored].sort((a, b) => b.netValue - a.netValue).slice(0, 3);
  const worst = [...scored].sort((a, b) => a.netValue - b.netValue).slice(0, 3);
  return { best, worst };
}

// ── Trends ────────────────────────────────────────────────────
export interface Trend {
  icon: string;
  color: 'green' | 'red' | 'blue' | 'yellow';
  title: string;
  desc: string;
}

export function computeTrends(snapshots: MonthSnapshot[]): Trend[] {
  const trends: Trend[] = [];
  const n = snapshots.length;

  const incomes = snapshots.map((s) => s.analysis.totalInc);
  const { slope: incSlope } = linReg(incomes);
  if (incSlope > 50) trends.push({ icon: '📈', color: 'green', title: 'Einnahmen steigend', desc: `Die monatlichen Einnahmen steigen um durchschnittlich ${fmt(incSlope)} pro Monat. Positiver Langzeittrend.` });
  else if (incSlope < -50) trends.push({ icon: '📉', color: 'red', title: 'Einnahmen rückläufig', desc: `Die monatlichen Einnahmen sinken um Ø ${fmt(Math.abs(incSlope))}/Monat. Ursache prüfen.` });
  else trends.push({ icon: '➡️', color: 'blue', title: 'Einnahmen stabil', desc: `Die Einnahmen bewegen sich konstant um Ø ${fmt(incomes.reduce((s, v) => s + v, 0) / n)}/Monat.` });

  const expenses = snapshots.map((s) => Math.abs(s.analysis.totalExp));
  const { slope: expSlope } = linReg(expenses);
  if (expSlope > 50) trends.push({ icon: '⚠️', color: 'yellow', title: 'Ausgaben steigend', desc: `Die monatlichen Ausgaben wachsen um Ø ${fmt(expSlope)}/Monat. Kostenkontrolle empfohlen.` });
  else if (expSlope < -50) trends.push({ icon: '✅', color: 'green', title: 'Ausgaben sinkend', desc: `Die Ausgaben sinken um Ø ${fmt(Math.abs(expSlope))}/Monat. Gute Disziplin.` });

  const srs = snapshots.map((s) => (s.analysis.totalInc > 0 ? ((s.analysis.totalInc + s.analysis.totalExp) / s.analysis.totalInc) * 100 : 0));
  const { slope: srSlope } = linReg(srs);
  if (srSlope > 1) trends.push({ icon: '🎯', color: 'green', title: 'Sparquote verbessert sich', desc: `Die Sparquote steigt um Ø ${srSlope.toFixed(1)} PP/Monat. Von ${fmtP(srs[0]!)} auf ${fmtP(srs[n - 1]!)}.` });
  else if (srSlope < -1) trends.push({ icon: '⚠️', color: 'yellow', title: 'Sparquote sinkt', desc: `Die Sparquote fällt um Ø ${Math.abs(srSlope).toFixed(1)} PP/Monat. Von ${fmtP(srs[0]!)} auf ${fmtP(srs[n - 1]!)}.` });

  const divs = snapshots.map((s) => s.analysis.totalDiv);
  const avgDiv = divs.reduce((s, v) => s + v, 0) / n;
  if (avgDiv > 50) {
    const { slope: divSlope } = linReg(divs);
    if (divSlope > 10) trends.push({ icon: '💰', color: 'green', title: 'Passives Einkommen wächst', desc: `Dividenden steigen um Ø ${fmt(divSlope)}/Monat. Das passive Einkommen (Ø ${fmt(avgDiv)}/Monat) wird ein zunehmend relevanter Einkommensfaktor.` });
  }

  const subCounts = snapshots.map((s) => s.analysis.subscriptions.length);
  if (subCounts[n - 1]! > subCounts[0]!) trends.push({ icon: '🔄', color: 'yellow', title: 'Mehr wiederkehrende Ausgaben', desc: `Von ${subCounts[0]} auf ${subCounts[n - 1]} erkannte wiederkehrende Zahlungen. Fixkosten regelmäßig prüfen.` });

  const cardRatios = snapshots.map((s) => {
    const a = s.analysis;
    const cardExp = a.exp.filter((r) => r._isCard).reduce((sum, r) => sum + Math.abs(r._amt), 0);
    return Math.abs(a.totalExp) > 0 ? (cardExp / Math.abs(a.totalExp)) * 100 : 0;
  });
  const avgCardRatio = cardRatios.reduce((s, v) => s + v, 0) / n;
  if (avgCardRatio > 30) trends.push({ icon: '💳', color: 'blue', title: `Ø ${avgCardRatio.toFixed(0)}% per Karte`, desc: `Durchschnittlich ${fmtP(avgCardRatio)} der Ausgaben über Kartenzahlungen. Bandbreite: ${fmtP(Math.min(...cardRatios))} bis ${fmtP(Math.max(...cardRatios))}.` });

  return trends;
}

// ── Attention items ──────────────────────────────────────────
export interface AttentionItem {
  icon: string;
  color: 'red' | 'yellow';
  title: string;
  desc: string;
}

export function computeAttentionItems(snapshots: MonthSnapshot[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  const n = snapshots.length;
  const latest = snapshots[n - 1]!.analysis;
  const prev = snapshots[n - 2]!.analysis;

  const avgExp = snapshots.reduce((s, sn) => s + Math.abs(sn.analysis.totalExp), 0) / n;
  if (Math.abs(latest.totalExp) > avgExp * 1.3) {
    items.push({ icon: '🔴', color: 'red', title: 'Ausgaben-Spitze im letzten Monat', desc: `${fmt(Math.abs(latest.totalExp))} — ${fmtP((Math.abs(latest.totalExp) / avgExp - 1) * 100)} über dem Ø von ${fmt(avgExp)}. Einmaleffekt oder neuer Trend?` });
  }

  const negMonths: string[] = [];
  for (let i = n - 1; i >= Math.max(0, n - 3); i--) {
    if (snapshots[i]!.analysis.totalInc + snapshots[i]!.analysis.totalExp < 0) negMonths.push(snapshots[i]!.month);
  }
  if (negMonths.length >= 2) {
    items.push({ icon: '⚠️', color: 'red', title: `${negMonths.length} Monate mit negativem Cashflow`, desc: `${negMonths.map((m) => mLabel(m)).join(', ')} — Ausgaben übersteigen Einnahmen. Sofortmaßnahmen empfohlen.` });
  }

  const lSubCost = latest.subscriptions.reduce((s, x) => s + x.amt, 0);
  const pSubCost = prev.subscriptions.reduce((s, x) => s + x.amt, 0);
  if (lSubCost > pSubCost * 1.1 && lSubCost > 50) {
    items.push({ icon: '🔄', color: 'yellow', title: `Wiederkehrende Kosten gestiegen: ${fmt(lSubCost)}/Monat`, desc: `Von ${fmt(pSubCost)} auf ${fmt(lSubCost)} — Hochrechnung: ${fmt(lSubCost * 12)}/Jahr. Unnötige Posten kündigen.` });
  }

  const bigOnes = latest.exp.filter((r) => Math.abs(r._amt) > 200).sort((a, b) => Math.abs(b._amt) - Math.abs(a._amt));
  if (bigOnes.length >= 3) {
    items.push({
      icon: '💸', color: 'yellow', title: `${bigOnes.length} Großausgaben im ${mLabel(snapshots[n - 1]!.month)}`,
      desc: `${bigOnes.slice(0, 3).map((r) => `${r._name || typeLabel(r._type)}: ${fmt(Math.abs(r._amt))}`).join(', ')}. Gesamt: ${fmt(bigOnes.reduce((s, r) => s + Math.abs(r._amt), 0))}.`,
    });
  }

  if (latest.totalInc < prev.totalInc * 0.8 && prev.totalInc > 500) {
    items.push({ icon: '📉', color: 'yellow', title: 'Einnahmen deutlich gesunken', desc: `${fmt(latest.totalInc)} vs. ${fmt(prev.totalInc)} im Vormonat — ${fmtP((1 - latest.totalInc / prev.totalInc) * 100)} Rückgang. Ursache prüfen.` });
  }

  return items;
}

// ── Recommendations ─────────────────────────────────────────
export interface DeepDiveRecommendation {
  color: 'red' | 'yellow' | 'green' | 'blue';
  title: string;
  desc: string;
}

export function computeDeepDiveRecommendations(snapshots: MonthSnapshot[]): DeepDiveRecommendation[] {
  const recs: DeepDiveRecommendation[] = [];
  const n = snapshots.length;
  const totals = { inc: 0, exp: 0, div: 0, inv: 0 };
  for (const s of snapshots) {
    totals.inc += s.analysis.totalInc;
    totals.exp += Math.abs(s.analysis.totalExp);
    totals.div += s.analysis.totalDiv;
    totals.inv += s.analysis.totalInv;
  }
  const avgInc = totals.inc / n;
  const avgExp = totals.exp / n;
  const sr = totals.inc > 0 ? ((totals.inc - totals.exp) / totals.inc) * 100 : 0;

  if (sr < 10) recs.push({ color: 'red', title: 'Sparquote kritisch niedrig', desc: `Nur ${fmtP(sr)} über ${n} Monate. Ziel: 20%. Monatlich ${fmt(avgInc * 0.2)} zurücklegen. Fixkosten (wiederkehrende Ausgaben, Lastschriften) systematisch prüfen.` });
  else if (sr < 20) recs.push({ color: 'yellow', title: 'Sparquote steigern', desc: `Aktuell ${fmtP(sr)}. Noch ${fmt(avgInc * 0.2 - (avgInc - avgExp))}/Monat mehr sparen, um das 20%-Ziel zu erreichen.` });
  else recs.push({ color: 'green', title: `Gute Sparquote: ${fmtP(sr)}`, desc: 'Über dem 20%-Zielwert. Überschüsse gezielt investieren oder Rücklagen aufbauen.' });

  const allExpCat: Record<string, number> = {};
  for (const s of snapshots) for (const [k, v] of Object.entries(s.analysis.expCat)) allExpCat[k] = (allExpCat[k] ?? 0) + v;
  const topCats = Object.entries(allExpCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topCats.length) {
    recs.push({
      color: 'blue', title: 'Größte Ausgabenkategorien optimieren',
      desc: `Top 3: ${topCats.map(([k, v]) => `${k} (${fmt(v)}, ${fmtP((v / totals.exp) * 100)})`).join(', ')}. Hier liegen die größten Einsparpotenziale.`,
    });
  }

  const monthlyNet = avgInc - avgExp;
  if (monthlyNet > 0) {
    const monthsToEmergency = (avgExp * 3) / monthlyNet;
    recs.push({
      color: monthlyNet > avgExp * 0.2 ? 'green' : 'yellow', title: 'Notfallrücklage aufbauen',
      desc: `Ziel: 3 Monatsausgaben (${fmt(avgExp * 3)}). Bei aktuellem Überschuss (${fmt(monthlyNet)}/Monat) in ${monthsToEmergency.toFixed(0)} Monaten erreichbar.`,
    });
  }

  if (totals.div > 0) {
    const divShare = (totals.div / totals.inc) * 100;
    recs.push({
      color: divShare >= 10 ? 'green' : 'blue', title: `Passives Einkommen: ${fmtP(divShare)} der Einnahmen`,
      desc: `${fmt(totals.div)} Dividenden in ${n} Monaten (Ø ${fmt(totals.div / n)}/Monat). ${divShare < 10 ? 'Dividendenwerte ausbauen für mehr Unabhängigkeit.' : 'Guter Anteil — weiter diversifizieren.'}`,
    });
  }

  const nets = snapshots.map((s) => s.analysis.totalInc + s.analysis.totalExp);
  const netAvg = nets.reduce((s, v) => s + v, 0) / n;
  const netStd = Math.sqrt(nets.reduce((s, v) => s + Math.pow(v - netAvg, 2), 0) / n);
  if (netStd > Math.abs(netAvg) * 1.2 && netAvg !== 0) {
    recs.push({
      color: 'yellow', title: 'Hohe Cashflow-Schwankungen',
      desc: `Monatlicher Netto-Cashflow schwankt stark (σ ${fmt(netStd)} bei Ø ${fmt(netAvg)}). Ein festes Budget und Pufferkonto können die Volatilität abfedern.`,
    });
  }

  return recs;
}

// ── Detail table ─────────────────────────────────────────────
export interface DeepDiveDetailRow {
  month: string;
  income: string;
  incomeDelta: 'up' | 'down' | null;
  expense: string;
  expenseDelta: 'up' | 'down' | null;
  net: string;
  netPositive: boolean;
  savingsRate: string;
  savingsRateCls: 'pos' | 'warn' | '' | 'neg';
  dividend: string;
  invested: string;
  tax: string;
  cardCount: number;
  txCount: number;
  isBest: boolean;
  isWorst: boolean;
}

/** `!prev` (not just `prev === null`) intentionally suppresses the delta arrow when the
 *  previous month's value was exactly 0 too — matches the original's `if(!prev)return''`. */
function deltaDirection(curr: number, prev: number | null): 'up' | 'down' | null {
  if (!prev) return null;
  const d = curr - prev;
  if (Math.abs(d) < 1) return null;
  return d > 0 ? 'up' : 'down';
}

export function computeDetailTableRows(snapshots: MonthSnapshot[]): DeepDiveDetailRow[] {
  const data = snapshots.map((s) => {
    const a = s.analysis;
    const net = a.totalInc + a.totalExp;
    const sr = a.totalInc > 0 ? (net / a.totalInc) * 100 : 0;
    return {
      month: s.month, income: a.totalInc, expense: Math.abs(a.totalExp), net, sr,
      dividend: a.totalDiv, invested: a.totalInv, tax: a.totalTax,
      count: a.enriched.length, cardCount: a.exp.filter((r) => r._isCard).length,
    };
  });

  const nets = data.map((d) => d.net);
  const bestIdx = nets.indexOf(Math.max(...nets));
  const worstIdx = nets.indexOf(Math.min(...nets));

  return data.map((d, i) => {
    const prev = i > 0 ? data[i - 1]! : null;
    return {
      month: mLabel(d.month),
      income: fmt(d.income), incomeDelta: deltaDirection(d.income, prev?.income ?? null),
      expense: fmt(d.expense), expenseDelta: deltaDirection(-d.expense, prev ? -prev.expense : null),
      net: fmt(d.net), netPositive: d.net >= 0,
      savingsRate: fmtP(d.sr), savingsRateCls: d.sr >= 20 ? 'pos' : d.sr >= 10 ? '' : 'neg',
      dividend: fmt(d.dividend), invested: fmt(d.invested), tax: fmt(d.tax),
      cardCount: d.cardCount, txCount: d.count,
      isBest: i === bestIdx, isWorst: i === worstIdx,
    };
  });
}
