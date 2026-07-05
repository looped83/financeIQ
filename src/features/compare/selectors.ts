import { fmt, fmtPP, monthName } from '../../domain/format';
import type { Analysis } from '../../domain/types';
import type { CompareMetric } from '../../state/appState';

const MONTH_NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export interface MonthAlignEntry {
  income: number;
  expense: number;
  invested: number;
  net: number;
  dividend: number;
}

export interface MonthAlign {
  MN: string[];
  m1: Record<string, MonthAlignEntry>;
  m2: Record<string, MonthAlignEntry>;
}

function emptyEntry(): MonthAlignEntry {
  return { income: 0, expense: 0, invested: 0, net: 0, dividend: 0 };
}

/** Aligns two Analysis objects' months by calendar month number (01-12), summing across years. */
export function buildMonthAlign(a1: Analysis, a2: Analysis): MonthAlign {
  const m1: Record<string, MonthAlignEntry> = {};
  const m2: Record<string, MonthAlignEntry> = {};

  for (const mk of a1.mKeys) {
    const mn = mk.split('-')[1]!;
    const entry = (m1[mn] ??= emptyEntry());
    const m = a1.months[mk]!;
    entry.income += m.income;
    entry.expense += m.expense;
    entry.invested += m.invested;
    entry.net += m.net;
    entry.dividend += m.dividend;
  }
  for (const mk of a2.mKeys) {
    const mn = mk.split('-')[1]!;
    const entry = (m2[mn] ??= emptyEntry());
    const m = a2.months[mk]!;
    entry.income += m.income;
    entry.expense += m.expense;
    entry.invested += m.invested;
    entry.net += m.net;
    entry.dividend += m.dividend;
  }

  const MN = MONTH_NUMBERS.filter((mn) => m1[mn] || m2[mn]);
  return { MN, m1, m2 };
}

/** Single year -> that year; multiple years -> "first–last"; no months at all -> fallback (usually the filename). */
export function deriveYearLabel(mKeys: string[], fallback: string): string {
  const years = [...new Set(mKeys.map((k) => k.split('-')[0]!))];
  if (years.length === 1) return years[0]!;
  if (years.length > 1) return `${years[0]}–${years[years.length - 1]}`;
  return fallback;
}

export interface CompareLabels {
  y1: string;
  y2: string;
}

/** Falls back to the (extension-stripped) file names if both analyses resolve to the same year label. */
export function computeCompareLabels(a1: Analysis, a2: Analysis, name1: string, name2: string): CompareLabels {
  let y1 = deriveYearLabel(a1.mKeys, name1);
  let y2 = deriveYearLabel(a2.mKeys, name2);
  if (y1 === y2) {
    y1 = name1.replace(/\.csv$/i, '');
    y2 = name2.replace(/\.csv$/i, '');
  }
  return { y1, y2 };
}

export interface CompareKpi {
  label: string;
  v1: number;
  v2: number;
}

export function computeCompareKpis(a1: Analysis, a2: Analysis): CompareKpi[] {
  return [
    { label: 'Einnahmen', v1: a1.totalInc, v2: a2.totalInc },
    { label: 'Ausgaben', v1: Math.abs(a1.totalExp), v2: Math.abs(a2.totalExp) },
    { label: 'Netto-Saldo', v1: a1.netBal, v2: a2.netBal },
    { label: 'Investiert', v1: a1.totalInv, v2: a2.totalInv },
    { label: 'Dividenden', v1: a1.totalDiv, v2: a2.totalDiv },
    { label: 'Gebühren', v1: a1.totalFee, v2: a2.totalFee },
  ];
}

export interface MonthlyMetricChartData {
  labels: string[];
  series1: number[];
  series2: number[];
}

export function getMonthlyMetricChartData(align: MonthAlign, metric: CompareMetric): MonthlyMetricChartData {
  const pick = (entry: MonthAlignEntry | undefined): number => {
    const v = entry?.[metric] ?? 0;
    return metric === 'expense' ? Math.abs(v) : v;
  };
  return {
    labels: align.MN.map(monthName),
    series1: align.MN.map((mn) => pick(align.m1[mn])),
    series2: align.MN.map((mn) => pick(align.m2[mn])),
  };
}

export interface DeltaChartData {
  labels: string[];
  deltas: number[];
}

export function getNetDeltaChartData(align: MonthAlign): DeltaChartData {
  return {
    labels: align.MN.map(monthName),
    deltas: align.MN.map((mn) => (align.m2[mn]?.net ?? 0) - (align.m1[mn]?.net ?? 0)),
  };
}

export interface CategoryDeltaChartData {
  labels: string[];
  deltas: number[];
}

export function getCategoryDeltaChartData(a1: Analysis, a2: Analysis, limit = 12): CategoryDeltaChartData {
  const cats = [...new Set([...Object.keys(a1.expCat), ...Object.keys(a2.expCat)])].sort();
  const entries = cats
    .map((c) => ({ c, d: (a2.expCat[c] ?? 0) - (a1.expCat[c] ?? 0) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, limit);
  return { labels: entries.map((x) => x.c), deltas: entries.map((x) => x.d) };
}

export interface CompareInsight {
  color: 'green' | 'red' | 'yellow' | 'blue';
  title: string;
  desc: string;
}

export function computeCompareInsights(a1: Analysis, a2: Analysis, labels: CompareLabels, align: MonthAlign): CompareInsight[] {
  const { y1, y2 } = labels;
  const ins: CompareInsight[] = [];

  const incChg = ((a2.totalInc - a1.totalInc) / a1.totalInc) * 100;
  const expChg = ((Math.abs(a2.totalExp) - Math.abs(a1.totalExp)) / Math.abs(a1.totalExp)) * 100;
  const divChg = a1.totalDiv > 0 ? ((a2.totalDiv - a1.totalDiv) / a1.totalDiv) * 100 : null;
  const invChg = a1.totalInv > 0 ? ((a2.totalInv - a1.totalInv) / a1.totalInv) * 100 : null;
  const balChg = a2.netBal - a1.netBal;

  ins.push({
    color: incChg >= 0 ? 'green' : 'red', title: `Einnahmen ${incChg >= 0 ? 'gestiegen' : 'gesunken'}`,
    desc: `${y2}: ${fmt(a2.totalInc)} vs. ${y1}: ${fmt(a1.totalInc)} — ${fmtPP(incChg)} Veränderung (${fmt(Math.abs(a2.totalInc - a1.totalInc))}).`,
  });
  ins.push({
    color: expChg <= 0 ? 'green' : 'red', title: `Ausgaben ${expChg >= 0 ? 'gestiegen' : 'gesunken'}`,
    desc: `${y2}: ${fmt(Math.abs(a2.totalExp))} vs. ${y1}: ${fmt(Math.abs(a1.totalExp))} — ${fmtPP(expChg)}.`,
  });
  if (divChg !== null) {
    ins.push({
      color: divChg >= 0 ? 'green' : 'yellow', title: `Dividenden ${divChg >= 0 ? 'gewachsen' : 'gesunken'}`,
      desc: `${fmt(a2.totalDiv)} (${y2}) vs. ${fmt(a1.totalDiv)} (${y1}) — ${fmtPP(divChg)}. ${divChg >= 20 ? 'Starkes Dividendenwachstum!' : divChg < 0 ? 'Portfolio prüfen.' : ''}`,
    });
  }
  if (invChg !== null) {
    ins.push({
      color: invChg >= 0 ? 'green' : 'yellow', title: `Investitionsvolumen ${invChg >= 0 ? 'erhöht' : 'reduziert'}`,
      desc: `${fmt(a2.totalInv)} (${y2}) vs. ${fmt(a1.totalInv)} (${y1}) — ${fmtPP(invChg)}.`,
    });
  }
  ins.push({
    color: balChg >= 0 ? 'green' : 'red', title: `Netto-Saldo ${balChg >= 0 ? 'verbessert' : 'verschlechtert'}`,
    desc: `Von ${fmt(a1.netBal)} auf ${fmt(a2.netBal)} — Delta: ${fmt(balChg)}.`,
  });

  const ndArr = align.MN.map((mn) => (align.m2[mn]?.net ?? 0) - (align.m1[mn]?.net ?? 0));
  const bestMN = align.MN[ndArr.indexOf(Math.max(...ndArr))]!;
  const worstMN = align.MN[ndArr.indexOf(Math.min(...ndArr))]!;
  ins.push({
    color: 'blue', title: `Beste Monatsverbesserung: ${monthName(bestMN)}`,
    desc: `Im ${monthName(bestMN)} verbesserte sich der Netto-Cashflow um ${fmt(Math.max(...ndArr))} im Vergleich zum Vorjahr.`,
  });
  ins.push({
    color: 'yellow', title: `Stärkste Verschlechterung: ${monthName(worstMN)}`,
    desc: `Im ${monthName(worstMN)} verschlechterte sich der Netto-Cashflow um ${fmt(Math.abs(Math.min(...ndArr)))} gegenüber dem Vorjahr.`,
  });

  if (a2.totalInc !== a1.totalInc) {
    // Faithful port of the original's `!a1.expCat[c]` — a falsy-value check,
    // not a key-existence check (a category with total 0 would also count
    // as "new" here, though that can't happen in practice since expCat only
    // ever accumulates positive amounts).
    const newCats = Object.keys(a2.expCat).filter((c) => !a1.expCat[c]);
    if (newCats.length) {
      ins.push({ color: 'yellow', title: 'Neue Ausgabenkategorien', desc: `In ${y2} erstmals: ${newCats.join(', ')}.` });
    }
  }

  return ins;
}

export interface CompareDeltaRow {
  label: string;
  v1: string;
  v2: string;
  delta: string;
  deltaPositive: boolean;
  deltaPct: string;
  deltaPctPositive: boolean;
}

export function getCompareDeltaTableRows(a1: Analysis, a2: Analysis): CompareDeltaRow[] {
  const kpis = computeCompareKpis(a1, a2);
  const rows: CompareDeltaRow[] = kpis.map((k) => {
    const d = k.v2 - k.v1;
    const p = k.v1 ? (d / Math.abs(k.v1)) * 100 : 0;
    return {
      label: k.label, v1: fmt(k.v1), v2: fmt(k.v2),
      delta: (d >= 0 ? '+' : '') + fmt(d), deltaPositive: d >= 0,
      deltaPct: fmtPP(p), deltaPctPositive: p >= 0,
    };
  });

  const txDelta = a2.enriched.length - a1.enriched.length;
  rows.push({
    label: 'Transaktionen', v1: String(a1.enriched.length), v2: String(a2.enriched.length),
    delta: (txDelta >= 0 ? '+' : '') + String(txDelta), deltaPositive: txDelta >= 0,
    deltaPct: '—', deltaPctPositive: true,
  });

  return rows;
}
