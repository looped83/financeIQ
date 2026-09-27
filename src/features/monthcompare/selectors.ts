import { isSpend } from '../../domain/analyze';
import { fmt, fmtP, fmtPP, mLabel, typeLabel } from '../../domain/format';
import type { Analysis, MonthAgg } from '../../domain/types';
import type { MonthCompareMetric } from '../../state/appState';

export interface MonthKpi {
  label: string;
  vA: number;
  vB: number;
  /** Which direction of change is good — expenses should go down. */
  goodWhen: 'up' | 'down';
}

export function computeMonthKpis(a: MonthAgg, b: MonthAgg): MonthKpi[] {
  return [
    { label: 'Einnahmen', vA: a.income, vB: b.income, goodWhen: 'up' },
    { label: 'Ausgaben', vA: Math.abs(a.expense), vB: Math.abs(b.expense), goodWhen: 'down' },
    { label: 'Netto', vA: a.net, vB: b.net, goodWhen: 'up' },
    { label: 'Investiert', vA: a.invested, vB: b.invested, goodWhen: 'up' },
    { label: 'Dividenden', vA: a.dividend, vB: b.dividend, goodWhen: 'up' },
    { label: 'Sparquote', vA: a.savingsRate, vB: b.savingsRate, goodWhen: 'up' },
  ];
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
    if (!isSpend(row)) continue;
    const cat = typeLabel(row._type);
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
      desc: `${labelB}: ${fmtP(b.savingsRate)} vs. ${labelA}: ${fmtP(a.savingsRate)} — ${fmtPP(srDelta).replace(' %', '')} Prozentpunkte.`,
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
      desc: `${labelA} hatte ${txA} Transaktionen — ${fmtPP(txChg)} Veränderung.`,
    });
  }

  return ins;
}

export interface MonthDeltaRow {
  label: string;
  vA: string;
  vB: string;
  delta: string;
  deltaPct: string;
  /** Whether the change is an improvement; `null` when it is neither (no change, booking count). */
  good: boolean | null;
}

export function getMonthDeltaTableRows(analysis: Analysis, monthA: string, monthB: string): MonthDeltaRow[] {
  const a = analysis.months[monthA]!;
  const b = analysis.months[monthB]!;
  const rows: MonthDeltaRow[] = computeMonthKpis(a, b).map((k) => {
    const d = k.vB - k.vA;
    const isRate = k.label === 'Sparquote';
    const p = isRate ? d : (k.vA ? (d / Math.abs(k.vA)) * 100 : 0);
    return {
      label: k.label,
      vA: isRate ? fmtP(k.vA) : fmt(k.vA),
      vB: isRate ? fmtP(k.vB) : fmt(k.vB),
      delta: isRate ? fmtPP(d).replace(' %', ' Pp.') : `${d >= 0 ? '+' : ''}${fmt(d)}`,
      deltaPct: isRate ? '—' : fmtPP(p),
      good: Math.abs(d) < 0.005 ? null : (d > 0) === (k.goodWhen === 'up'),
    };
  });
  const txDelta = b.count - a.count;
  rows.push({
    label: 'Buchungen',
    vA: String(a.count),
    vB: String(b.count),
    delta: `${txDelta >= 0 ? '+' : ''}${txDelta}`,
    deltaPct: '—',
    good: null,
  });
  return rows;
}

// ── 1. Händler-Vergleich ──

export interface MerchantCompareRow {
  name: string;
  countA: number;
  countB: number;
  totalA: number;
  totalB: number;
  delta: number;
  deltaPositive: boolean;
}

export function getMerchantComparison(analysis: Analysis, monthA: string, monthB: string, limit = 10): MerchantCompareRow[] {
  const mapA = new Map<string, { count: number; total: number }>();
  const mapB = new Map<string, { count: number; total: number }>();

  for (const r of analysis.enriched) {
    if (!isSpend(r)) continue;
    const name = r._name || 'Sonstiges';
    if (r._month === monthA) {
      const e = mapA.get(name) ?? { count: 0, total: 0 };
      e.count++;
      e.total += Math.abs(r._amt);
      mapA.set(name, e);
    }
    if (r._month === monthB) {
      const e = mapB.get(name) ?? { count: 0, total: 0 };
      e.count++;
      e.total += Math.abs(r._amt);
      mapB.set(name, e);
    }
  }

  const allNames = new Set([...mapA.keys(), ...mapB.keys()]);
  const rows: MerchantCompareRow[] = [];
  for (const name of allNames) {
    const a = mapA.get(name) ?? { count: 0, total: 0 };
    const b = mapB.get(name) ?? { count: 0, total: 0 };
    const delta = b.total - a.total;
    rows.push({ name, countA: a.count, countB: b.count, totalA: a.total, totalB: b.total, delta, deltaPositive: delta >= 0 });
  }

  rows.sort((a, b) => (b.totalA + b.totalB) - (a.totalA + a.totalB));
  return rows.slice(0, limit);
}

// ── 2. Neue & weggefallene Händler ──

export interface UniqueExpense {
  name: string;
  total: number;
  count: number;
}

export function getUniqueMerchants(analysis: Analysis, monthA: string, monthB: string): { onlyA: UniqueExpense[]; onlyB: UniqueExpense[] } {
  const mapA = new Map<string, { count: number; total: number }>();
  const mapB = new Map<string, { count: number; total: number }>();

  for (const r of analysis.enriched) {
    if (!isSpend(r)) continue;
    const name = r._name || 'Sonstiges';
    if (r._month === monthA) {
      const e = mapA.get(name) ?? { count: 0, total: 0 };
      e.count++;
      e.total += Math.abs(r._amt);
      mapA.set(name, e);
    }
    if (r._month === monthB) {
      const e = mapB.get(name) ?? { count: 0, total: 0 };
      e.count++;
      e.total += Math.abs(r._amt);
      mapB.set(name, e);
    }
  }

  const onlyA: UniqueExpense[] = [];
  const onlyB: UniqueExpense[] = [];
  for (const [name, v] of mapA) {
    if (!mapB.has(name)) onlyA.push({ name, total: v.total, count: v.count });
  }
  for (const [name, v] of mapB) {
    if (!mapA.has(name)) onlyB.push({ name, total: v.total, count: v.count });
  }
  onlyA.sort((a, b) => b.total - a.total);
  onlyB.sort((a, b) => b.total - a.total);

  return { onlyA: onlyA.slice(0, 8), onlyB: onlyB.slice(0, 8) };
}

// ── 3. Top-Einzelausgaben ──

export interface TopExpense {
  name: string;
  amount: number;
  date: string;
}

export function getTopSingleExpenses(analysis: Analysis, month: string, limit = 5): TopExpense[] {
  const txs = analysis.enriched
    .filter((r) => r._month === month && isSpend(r))
    .sort((a, b) => a._amt - b._amt)
    .slice(0, limit);

  return txs.map((r) => ({
    name: r._name || r._desc || 'Unbekannt',
    amount: Math.abs(r._amt),
    date: r._date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
  }));
}

// ── 4. Dividenden-Vergleich ──

export interface DividendComparison {
  countA: number;
  countB: number;
  totalA: number;
  totalB: number;
}

export function getDividendComparison(analysis: Analysis, monthA: string, monthB: string): DividendComparison {
  let countA = 0, countB = 0, totalA = 0, totalB = 0;

  for (const r of analysis.enriched) {
    if (!r._isDiv) continue;
    if (r._month === monthA) { countA++; totalA += r._amt; }
    if (r._month === monthB) { countB++; totalB += r._amt; }
  }

  return { countA, countB, totalA, totalB };
}

// ── 5. Wiederkehrende Ausgaben Delta ──

export interface RecurringDelta {
  name: string;
  amountA: number;
  amountB: number;
  delta: number;
  deltaPositive: boolean;
}

export function getRecurringExpensesDelta(analysis: Analysis, monthA: string, monthB: string): RecurringDelta[] {
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();
  for (const r of analysis.enriched) {
    if (!r._isFixed) continue;
    if (r._month === monthA) mapA.set(r._name, (mapA.get(r._name) ?? 0) + Math.abs(r._amt));
    if (r._month === monthB) mapB.set(r._name, (mapB.get(r._name) ?? 0) + Math.abs(r._amt));
  }

  const shared: RecurringDelta[] = [];
  for (const [name, amtA] of mapA) {
    if (mapB.has(name)) {
      const amtB = mapB.get(name)!;
      const delta = amtB - amtA;
      shared.push({ name, amountA: amtA, amountB: amtB, delta, deltaPositive: delta <= 0 });
    }
  }

  shared.sort((a, b) => (b.amountA + b.amountB) - (a.amountA + a.amountB));
  return shared;
}

export interface IntraMonthCashflowData {
  days: number[];
  seriesA: (number | null)[];
  seriesB: (number | null)[];
  labelA: string;
  labelB: string;
  endA: number;
  endB: number;
}

/**
 * Intra-month cumulative cashflow for the two compared months, indexed by day-of-month
 * (1…31). Each series is the running sum of that month's cash movements (`a.cash` =
 * everything except BUY/SELL) day by day, so the two months' cashflow trajectories can
 * be overlaid and compared directly — not an account-balance overview across months.
 * The final value of each line equals that month's net cashflow (income + expense).
 * Days beyond a month's length are `null` so the shorter month's line ends naturally.
 */
export function getIntraMonthCashflowData(
  analysis: Analysis, monthA: string, monthB: string,
): IntraMonthCashflowData {
  const build = (month: string): { cum: number[]; daysInMonth: number } => {
    const daily = new Map<number, number>();
    for (const r of analysis.cash) {
      if (r._month !== month) continue;
      const d = r._date.getDate();
      daily.set(d, (daily.get(d) ?? 0) + r._amt);
    }
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y!, m!, 0).getDate();
    const cum: number[] = [];
    let run = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      run += daily.get(d) ?? 0;
      cum.push(run);
    }
    return { cum, daysInMonth };
  };

  const A = build(monthA);
  const B = build(monthB);
  const maxDay = Math.max(A.daysInMonth, B.daysInMonth);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const pad = (x: { cum: number[]; daysInMonth: number }): (number | null)[] =>
    days.map((d) => (d <= x.daysInMonth ? x.cum[d - 1]! : null));

  return {
    days,
    seriesA: pad(A),
    seriesB: pad(B),
    labelA: mLabel(monthA),
    labelB: mLabel(monthB),
    endA: A.cum[A.daysInMonth - 1] ?? 0,
    endB: B.cum[B.daysInMonth - 1] ?? 0,
  };
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
