import { fmt, fmtP, fmtPP } from '../../domain/format';
import type { Analysis } from '../../domain/types';

export function isMultiYear(a: Analysis): boolean {
  return a.yKeys.length > 1;
}

export interface QuarterAgg {
  income: number;
  expense: number;
  invested: number;
  dividend: number;
  net: number;
}

export type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTER_KEYS: QuarterKey[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export interface QuarterlyBreakdown {
  year: string;
  quarters: Record<QuarterKey, QuarterAgg>;
}

/** Single-year view: aggregates all months into 4 quarters. */
export function computeQuarterlyBreakdown(a: Analysis): QuarterlyBreakdown {
  const year = a.yKeys[0] ?? '';
  const quarters: Record<QuarterKey, QuarterAgg> = {
    Q1: { income: 0, expense: 0, invested: 0, dividend: 0, net: 0 },
    Q2: { income: 0, expense: 0, invested: 0, dividend: 0, net: 0 },
    Q3: { income: 0, expense: 0, invested: 0, dividend: 0, net: 0 },
    Q4: { income: 0, expense: 0, invested: 0, dividend: 0, net: 0 },
  };
  for (const mk of a.mKeys) {
    const month = parseInt(mk.split('-')[1]!, 10);
    const q = QUARTER_KEYS[Math.ceil(month / 3) - 1]!;
    const md = a.months[mk]!;
    const qa = quarters[q];
    qa.income += md.income;
    qa.expense += md.expense;
    qa.invested += md.invested;
    qa.dividend += md.dividend;
    qa.net += md.net;
  }
  return { year, quarters };
}

export interface QuarterlyChartData {
  labels: QuarterKey[];
  income: number[];
  expense: number[];
  invested: number[];
  dividend: number[];
}

export function getQuarterlyChartData(breakdown: QuarterlyBreakdown): QuarterlyChartData {
  return {
    labels: QUARTER_KEYS,
    income: QUARTER_KEYS.map((q) => breakdown.quarters[q].income),
    expense: QUARTER_KEYS.map((q) => Math.abs(breakdown.quarters[q].expense)),
    invested: QUARTER_KEYS.map((q) => breakdown.quarters[q].invested),
    dividend: QUARTER_KEYS.map((q) => breakdown.quarters[q].dividend),
  };
}

export interface YearlyKpiCard {
  year: string;
  net: string;
  income: string;
  expense: string;
  netPositive: boolean;
  yoyIncomeChange: string | null;
  yoyIncomeUp: boolean;
}

/** Multi-year view: one KPI card per year, with year-over-year income change vs. the prior year. */
export function getYearlyKpiCards(a: Analysis): YearlyKpiCard[] {
  return a.yKeys.map((y, i) => {
    const yr = a.years[y]!;
    const prev = i > 0 ? a.years[a.yKeys[i - 1]!] : null;
    const yoyChange = prev && prev.income > 0 ? ((yr.income - prev.income) / prev.income) * 100 : null;
    return {
      year: y,
      net: fmt(yr.net),
      income: fmt(yr.income),
      expense: fmt(Math.abs(yr.expense)),
      netPositive: yr.net >= 0,
      yoyIncomeChange: yoyChange !== null ? fmtPP(yoyChange) : null,
      yoyIncomeUp: yoyChange !== null && yoyChange >= 0,
    };
  });
}

export interface YearlyChartData {
  labels: string[];
  income: number[];
  expense: number[];
  invested: number[];
  dividend: number[];
}

export function getYearlyChartData(a: Analysis): YearlyChartData {
  return {
    labels: a.yKeys,
    income: a.yKeys.map((y) => a.years[y]!.income),
    expense: a.yKeys.map((y) => Math.abs(a.years[y]!.expense)),
    invested: a.yKeys.map((y) => a.years[y]!.invested),
    dividend: a.yKeys.map((y) => a.years[y]!.dividend),
  };
}

export interface YearlyTableRow {
  year: string;
  income: string;
  expense: string;
  net: string;
  netPositive: boolean;
  invested: string;
  dividend: string;
  fees: string;
  tax: string;
  savingsRate: string;
  savingsRateCls: 'pos' | 'warn' | 'neg';
  isBest: boolean;
  isWorst: boolean;
}

export function getYearlyTableRows(a: Analysis): YearlyTableRow[] {
  const nets = a.yKeys.map((y) => a.years[y]!.net);
  const bestIdx = nets.indexOf(Math.max(...nets));
  const worstIdx = nets.indexOf(Math.min(...nets));

  return a.yKeys.map((y, i) => {
    const yr = a.years[y]!;
    const sr = yr.income > 0 ? (yr.net / yr.income) * 100 : 0;
    return {
      year: y,
      income: fmt(yr.income),
      expense: fmt(Math.abs(yr.expense)),
      net: fmt(yr.net),
      netPositive: yr.net >= 0,
      invested: fmt(yr.invested),
      dividend: fmt(yr.dividend),
      fees: fmt(yr.fees),
      tax: fmt(yr.tax),
      savingsRate: fmtP(sr),
      savingsRateCls: sr >= 20 ? 'pos' : sr >= 10 ? 'warn' : 'neg',
      isBest: i === bestIdx,
      isWorst: i === worstIdx,
    };
  });
}
