import { fmt, fmtPP, mLabel } from '../../domain/format';
import type { Analysis, MonthAgg } from '../../domain/types';
import type { MonthCompareMetric } from '../../state/appState';

export interface MonthKpi {
  label: string;
  vA: number;
  vB: number;
}

export function computeMonthKpis(a: MonthAgg, b: MonthAgg): MonthKpi[] {
  return [
    { label: 'Einnahmen', vA: a.income, vB: b.income },
    { label: 'Ausgaben', vA: Math.abs(a.expense), vB: Math.abs(b.expense) },
    { label: 'Netto-Cashflow', vA: a.net, vB: b.net },
    { label: 'Investiert', vA: a.invested, vB: b.invested },
    { label: 'Dividenden', vA: a.dividend, vB: b.dividend },
    { label: 'Sparquote', vA: a.savingsRate, vB: b.savingsRate },
  ];
}

export interface MonthMetricBarData {
  labels: string[];
  valuesA: number[];
  valuesB: number[];
}

export function getMonthMetricBarData(a: MonthAgg, b: MonthAgg, labelA: string, labelB: string): MonthMetricBarData {
  const metrics = ['Einnahmen', 'Ausgaben', 'Netto', 'Investiert', 'Dividenden'];
  const pick = (m: MonthAgg): number[] => [
    m.income,
    Math.abs(m.expense),
    m.net,
    m.invested,
    m.dividend,
  ];
  return { labels: metrics, valuesA: pick(a), valuesB: pick(b) };
}

export interface MonthCategoryDelta {
  labels: string[];
  deltasA: number[];
  deltasB: number[];
}

export function getMonthCategoryComparison(analysis: Analysis, monthA: string, monthB: string, limit = 12): MonthCategoryDelta {
  const catA: Record<string, number> = {};
  const catB: Record<string, number> = {};

  for (const row of analysis.enriched) {
    if (row._amt >= 0) continue;
    if (row._isDiv || row._isInterest) continue;
    const cat = row._cat || 'Sonstiges';
    if (row._month === monthA) catA[cat] = (catA[cat] ?? 0) + Math.abs(row._amt);
    if (row._month === monthB) catB[cat] = (catB[cat] ?? 0) + Math.abs(row._amt);
  }

  const allCats = [...new Set([...Object.keys(catA), ...Object.keys(catB)])];
  const sorted = allCats
    .map((c) => ({ c, a: catA[c] ?? 0, b: catB[c] ?? 0, total: (catA[c] ?? 0) + (catB[c] ?? 0) }))
    .sort((x, y) => y.total - x.total)
    .slice(0, limit);

  return {
    labels: sorted.map((x) => x.c),
    deltasA: sorted.map((x) => x.a),
    deltasB: sorted.map((x) => x.b),
  };
}

export interface MonthCompareInsight {
  color: 'green' | 'red' | 'yellow' | 'blue';
  title: string;
  desc: string;
}

export function computeMonthInsights(
  a: MonthAgg, b: MonthAgg, labelA: string, labelB: string,
  analysis: Analysis, monthA: string, monthB: string,
): MonthCompareInsight[] {
  const ins: MonthCompareInsight[] = [];

  if (a.income > 0) {
    const incChg = ((b.income - a.income) / a.income) * 100;
    ins.push({
      color: incChg >= 0 ? 'green' : 'red',
      title: `Einnahmen ${incChg >= 0 ? 'gestiegen' : 'gesunken'}`,
      desc: `${labelB}: ${fmt(b.income)} vs. ${labelA}: ${fmt(a.income)} — ${fmtPP(incChg)}.`,
    });
  }

  const absExpA = Math.abs(a.expense);
  const absExpB = Math.abs(b.expense);
  if (absExpA > 0) {
    const expChg = ((absExpB - absExpA) / absExpA) * 100;
    ins.push({
      color: expChg <= 0 ? 'green' : 'red',
      title: `Ausgaben ${expChg >= 0 ? 'gestiegen' : 'gesunken'}`,
      desc: `${labelB}: ${fmt(absExpB)} vs. ${labelA}: ${fmt(absExpA)} — ${fmtPP(expChg)}.`,
    });
  }

  const netDelta = b.net - a.net;
  ins.push({
    color: netDelta >= 0 ? 'green' : 'red',
    title: `Netto-Cashflow ${netDelta >= 0 ? 'verbessert' : 'verschlechtert'}`,
    desc: `Von ${fmt(a.net)} auf ${fmt(b.net)} — Delta: ${fmt(netDelta)}.`,
  });

  if (a.savingsRate > 0 || b.savingsRate > 0) {
    const srDelta = b.savingsRate - a.savingsRate;
    ins.push({
      color: srDelta >= 0 ? 'green' : 'yellow',
      title: `Sparquote ${srDelta >= 0 ? 'verbessert' : 'gesunken'}`,
      desc: `${labelB}: ${b.savingsRate.toFixed(1)}% vs. ${labelA}: ${a.savingsRate.toFixed(1)}% — ${srDelta >= 0 ? '+' : ''}${srDelta.toFixed(1)} Prozentpunkte.`,
    });
  }

  if (b.dividend > 0 || a.dividend > 0) {
    const divDelta = b.dividend - a.dividend;
    ins.push({
      color: divDelta >= 0 ? 'green' : 'yellow',
      title: `Dividenden ${divDelta >= 0 ? 'gestiegen' : 'gesunken'}`,
      desc: `${labelB}: ${fmt(b.dividend)} vs. ${labelA}: ${fmt(a.dividend)}.`,
    });
  }

  const txA = analysis.enriched.filter((r) => r._month === monthA).length;
  const txB = analysis.enriched.filter((r) => r._month === monthB).length;
  if (txA > 0) {
    const txChg = ((txB - txA) / txA) * 100;
    ins.push({
      color: 'blue',
      title: `${txB} Transaktionen in ${labelB}`,
      desc: `${labelA} hatte ${txA} Transaktionen — ${txChg >= 0 ? '+' : ''}${txChg.toFixed(0)}% Veränderung.`,
    });
  }

  return ins;
}

export interface MonthDeltaRow {
  label: string;
  vA: string;
  vB: string;
  delta: string;
  deltaPositive: boolean;
  deltaPct: string;
  deltaPctPositive: boolean;
}

export function getMonthDeltaTableRows(a: MonthAgg, b: MonthAgg, analysis: Analysis, monthA: string, monthB: string): MonthDeltaRow[] {
  const kpis = computeMonthKpis(a, b);
  const rows: MonthDeltaRow[] = kpis.map((k) => {
    const d = k.vB - k.vA;
    const isRate = k.label === 'Sparquote';
    const p = isRate ? d : (k.vA ? (d / Math.abs(k.vA)) * 100 : 0);
    return {
      label: k.label,
      vA: isRate ? `${k.vA.toFixed(1)}%` : fmt(k.vA),
      vB: isRate ? `${k.vB.toFixed(1)}%` : fmt(k.vB),
      delta: isRate ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} PP` : `${d >= 0 ? '+' : ''}${fmt(d)}`,
      deltaPositive: d >= 0,
      deltaPct: isRate ? '—' : fmtPP(p),
      deltaPctPositive: p >= 0,
    };
  });

  const txA = analysis.enriched.filter((r) => r._month === monthA).length;
  const txB = analysis.enriched.filter((r) => r._month === monthB).length;
  const txDelta = txB - txA;
  rows.push({
    label: 'Transaktionen',
    vA: String(txA),
    vB: String(txB),
    delta: `${txDelta >= 0 ? '+' : ''}${txDelta}`,
    deltaPositive: txDelta >= 0,
    deltaPct: '—',
    deltaPctPositive: true,
  });

  return rows;
}

export function getMonthMetricTimelineData(
  analysis: Analysis, metric: MonthCompareMetric, monthA: string, monthB: string,
): { labels: string[]; values: number[]; highlightA: number; highlightB: number } {
  const pick = (m: MonthAgg): number => {
    switch (metric) {
      case 'income': return m.income;
      case 'expense': return Math.abs(m.expense);
      case 'net': return m.net;
      case 'invested': return m.invested;
      case 'dividend': return m.dividend;
    }
  };

  const labels = analysis.mKeys.map(mLabel);
  const values = analysis.mKeys.map((mk) => pick(analysis.months[mk]!));
  const highlightA = analysis.mKeys.indexOf(monthA);
  const highlightB = analysis.mKeys.indexOf(monthB);

  return { labels, values, highlightA, highlightB };
}
