import { fmt, fmtP, mLabel } from '../../domain/format';
import { TARGETS } from '../../domain/targets';
import { changeDir, type Direction } from '../../domain/stats';
import type { Analysis } from '../../domain/types';

export interface MonthlySavingsRateChartData {
  labels: string[];
  savingsRate: number[];
}

export function getMonthlySavingsRateChartData(a: Analysis): MonthlySavingsRateChartData {
  return { labels: a.mKeys.map(mLabel), savingsRate: a.mKeys.map((m) => a.months[m]?.savingsRate ?? 0) };
}

export interface MonthDetailRow {
  month: string;
  income: string;
  incomeDelta: Direction;
  expense: string;
  /** 'up' = spending went up (bad), 'down' = it went down (good). */
  expenseDelta: Direction;
  net: string;
  netPositive: boolean;
  savingsRate: string;
  savingsRateLevel: 'good' | 'ok' | 'bad';
  dividend: string;
  invested: string;
  cardCount: number;
  txCount: number;
  isBest: boolean;
  isWorst: boolean;
}

/** One row per month, straight from the monthly aggregates, best/worst month by net flagged. */
export function getMonthlyDetailRows(a: Analysis): MonthDetailRow[] {
  const months = a.mKeys.map((mk) => a.months[mk]!);
  const nets = months.map((m) => m.net);
  const bestIdx = nets.indexOf(Math.max(...nets));
  const worstIdx = nets.indexOf(Math.min(...nets));

  return months.map((m, i) => {
    const prev = months[i - 1];
    const expense = Math.abs(m.expense);
    return {
      month: mLabel(a.mKeys[i]!),
      income: fmt(m.income),
      incomeDelta: changeDir(m.income, prev?.income),
      expense: fmt(expense),
      expenseDelta: changeDir(expense, prev && Math.abs(prev.expense)),
      net: fmt(m.net),
      netPositive: m.net >= 0,
      savingsRate: fmtP(m.savingsRate),
      savingsRateLevel: m.savingsRate >= TARGETS.savingsRate ? 'good' : m.savingsRate >= TARGETS.savingsRate / 2 ? 'ok' : 'bad',
      dividend: fmt(m.dividend),
      invested: fmt(m.invested),
      cardCount: m.cardCount,
      txCount: m.count,
      isBest: months.length > 1 && i === bestIdx,
      isWorst: months.length > 1 && i === worstIdx,
    };
  });
}
