import { fmt, fmtP, mLabel } from '../../domain/format';
import type { Analysis } from '../../domain/types';

export interface MonthlyGroupedChartData {
  labels: string[];
  income: number[];
  expense: number[];
  invested: number[];
}

export function getMonthlyGroupedChartData(a: Analysis): MonthlyGroupedChartData {
  return {
    labels: a.mKeys.map(mLabel),
    income: a.mKeys.map((m) => a.months[m]?.income ?? 0),
    expense: a.mKeys.map((m) => Math.abs(a.months[m]?.expense ?? 0)),
    invested: a.mKeys.map((m) => a.months[m]?.invested ?? 0),
  };
}

export interface MonthlyCumulativeChartData {
  labels: string[];
  cumBal: number[];
}

export function getMonthlyCumulativeChartData(a: Analysis): MonthlyCumulativeChartData {
  return { labels: a.mKeys.map(mLabel), cumBal: a.mKeys.map((m) => a.months[m]?.cumBal ?? 0) };
}

export interface MonthlySavingsRateChartData {
  labels: string[];
  savingsRate: number[];
}

export function getMonthlySavingsRateChartData(a: Analysis): MonthlySavingsRateChartData {
  return { labels: a.mKeys.map(mLabel), savingsRate: a.mKeys.map((m) => a.months[m]?.savingsRate ?? 0) };
}

export interface MonthlyTableRow {
  month: string;
  income: string;
  expense: string;
  invested: string;
  dividend: string;
  net: string;
  netPositive: boolean;
  savingsRate: string;
  savingsRateCls: 'pos' | 'warn' | 'neg';
  cumBal: string;
  cumBalPositive: boolean;
  count: number;
  isBest: boolean;
  isWorst: boolean;
}

export function getMonthlyTableRows(a: Analysis): MonthlyTableRow[] {
  const nets = a.mKeys.map((m) => a.months[m]?.net ?? 0);
  const bestIdx = nets.indexOf(Math.max(...nets));
  const worstIdx = nets.indexOf(Math.min(...nets));

  return a.mKeys.map((mk, i) => {
    const m = a.months[mk]!;
    return {
      month: mLabel(mk),
      income: fmt(m.income),
      expense: fmt(Math.abs(m.expense)),
      invested: fmt(m.invested),
      dividend: fmt(m.dividend),
      net: fmt(m.net),
      netPositive: m.net >= 0,
      savingsRate: fmtP(m.savingsRate),
      savingsRateCls: m.savingsRate >= 20 ? 'pos' : m.savingsRate >= 10 ? 'warn' : 'neg',
      cumBal: fmt(m.cumBal),
      cumBalPositive: m.cumBal >= 0,
      count: m.count,
      isBest: i === bestIdx,
      isWorst: i === worstIdx,
    };
  });
}
