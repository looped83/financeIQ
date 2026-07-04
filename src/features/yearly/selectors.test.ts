import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  computeQuarterlyBreakdown,
  getQuarterlyChartData,
  getYearlyChartData,
  getYearlyKpiCards,
  getYearlyTableRows,
  isMultiYear,
} from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const MINI_HEADER = 'date,type,amount,tax,name,category';
function miniCsv(rows: Array<{ date: string; type: string; amount: number; tax?: number }>): string {
  const lines = rows.map((r) => `${r.date},${r.type},${r.amount},${r.tax ?? 0},,`);
  return [MINI_HEADER, ...lines].join('\n');
}

describe('single-year (quarterly) view', () => {
  const a = analyze(parseCSV(fixture('dividends-and-corrections.csv'))); // only 2024

  it('isMultiYear is false for a single-year dataset', () => {
    expect(isMultiYear(a)).toBe(false);
  });

  it('assigns months to the correct quarter', () => {
    const { year, quarters } = computeQuarterlyBreakdown(a);
    expect(year).toBe('2024');
    // Feb -> Q1, Mar -> Q1 as well (both within months 1-3)
    expect(quarters.Q1.income).toBeCloseTo(2085 + 30, 3); // Feb (2000+85) + Mar (30 refund)
    expect(quarters.Q2.income).toBe(0);
  });

  it('getQuarterlyChartData mirrors the breakdown in chart-ready arrays', () => {
    const breakdown = computeQuarterlyBreakdown(a);
    const chart = getQuarterlyChartData(breakdown);
    expect(chart.labels).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(chart.income[0]).toBeCloseTo(2115, 3); // all fixture income falls in Q1
  });
});

describe('multi-year comparison view', () => {
  const a = analyze(parseCSV(miniCsv([
    { date: '2024-06-01', type: 'TRANSFER_INBOUND', amount: 2000 },
    { date: '2024-06-05', type: 'CARD_TRANSACTION', amount: -500 },
    { date: '2025-06-01', type: 'TRANSFER_INBOUND', amount: 3000 },
    { date: '2025-06-05', type: 'CARD_TRANSACTION', amount: -600 },
  ])));

  it('isMultiYear is true once 2+ years are present', () => {
    expect(isMultiYear(a)).toBe(true);
  });

  it('computes year-over-year income change for every year after the first', () => {
    const cards = getYearlyKpiCards(a);
    expect(cards[0]?.yoyIncomeChange).toBeNull(); // no prior year to compare 2024 against
    expect(cards[1]?.yoyIncomeChange).toBe('+50.0%'); // 3000 vs 2000
    expect(cards[1]?.yoyIncomeUp).toBe(true);
  });

  it('getYearlyChartData returns one entry per year in order', () => {
    const chart = getYearlyChartData(a);
    expect(chart.labels).toEqual(['2024', '2025']);
    expect(chart.income).toEqual([2000, 3000]);
    expect(chart.expense).toEqual([500, 600]);
  });

  it('getYearlyTableRows flags the best and worst year by net', () => {
    const rows = getYearlyTableRows(a);
    // 2024 net=1500, 2025 net=2400 -> 2025 is best, 2024 is worst (only 2 years, so both flags apply)
    expect(rows[0]?.isWorst).toBe(true);
    expect(rows[1]?.isBest).toBe(true);
  });
});
