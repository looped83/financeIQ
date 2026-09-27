import { fmt, fmtP, fmtSigned, fmtSignedP } from '../../domain/format';
import { TARGETS } from '../../domain/targets';
import { changeDir, type Direction } from '../../domain/stats';
import type { Analysis } from '../../domain/types';

export function isMultiYear(a: Analysis): boolean {
  return a.yKeys.length > 1;
}

export type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTER_KEYS: QuarterKey[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export interface QuarterAgg {
  quarter: QuarterKey;
  income: number;
  expense: number;
  invested: number;
  dividend: number;
  net: number;
}

export interface QuarterlyBreakdown {
  year: string;
  /** Only quarters the data covers, in order — no empty Q3/Q4 for a half year. */
  quarters: QuarterAgg[];
}

/** Single-year view: aggregates the months into quarters. */
export function computeQuarterlyBreakdown(a: Analysis): QuarterlyBreakdown {
  const byQuarter = new Map<QuarterKey, QuarterAgg>();
  for (const mk of a.mKeys) {
    const quarter = QUARTER_KEYS[Math.ceil(parseInt(mk.slice(5, 7), 10) / 3) - 1]!;
    const qa = byQuarter.get(quarter) ?? { quarter, income: 0, expense: 0, invested: 0, dividend: 0, net: 0 };
    const md = a.months[mk]!;
    qa.income += md.income;
    qa.expense += md.expense;
    qa.invested += md.invested;
    qa.dividend += md.dividend;
    qa.net += md.net;
    byQuarter.set(quarter, qa);
  }
  return { year: a.yKeys[0] ?? '', quarters: QUARTER_KEYS.flatMap((q) => byQuarter.get(q) ?? []) };
}

export interface QuarterlyChartData {
  labels: QuarterKey[];
  income: number[];
  expense: number[];
  invested: number[];
  dividend: number[];
}

export function getQuarterlyChartData({ quarters }: QuarterlyBreakdown): QuarterlyChartData {
  return {
    labels: quarters.map((q) => q.quarter),
    income: quarters.map((q) => q.income),
    expense: quarters.map((q) => Math.abs(q.expense)),
    invested: quarters.map((q) => q.invested),
    dividend: quarters.map((q) => q.dividend),
  };
}

export interface YearlyKpiCard {
  year: string;
  net: string;
  income: string;
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
      net: fmtSigned(yr.net, 0),
      income: fmt(yr.income, 0),
      yoyIncomeChange: yoyChange !== null ? fmtSignedP(yoyChange) : null,
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
  incomeDelta: Direction;
  expense: string;
  /** 'up' = spending rose (bad), 'down' = it fell (good). */
  expenseDelta: Direction;
  net: string;
  netPositive: boolean;
  invested: string;
  dividend: string;
  fees: string;
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
    const prev = i > 0 ? a.years[a.yKeys[i - 1]!]! : null;
    const sr = yr.income > 0 ? (yr.net / yr.income) * 100 : 0;
    return {
      year: y,
      income: fmt(yr.income),
      incomeDelta: changeDir(yr.income, prev?.income),
      expense: fmt(Math.abs(yr.expense)),
      expenseDelta: changeDir(Math.abs(yr.expense), prev && Math.abs(prev.expense)),
      net: fmt(yr.net),
      netPositive: yr.net >= 0,
      invested: fmt(yr.invested),
      dividend: fmt(yr.dividend),
      fees: fmt(yr.fees),
      savingsRate: fmtP(sr),
      savingsRateCls: sr >= TARGETS.savingsRate ? 'pos' : sr >= TARGETS.savingsRate / 2 ? 'warn' : 'neg',
      isBest: i === bestIdx,
      isWorst: i === worstIdx,
    };
  });
}
