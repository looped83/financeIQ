import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  getMonthlyCumulativeChartData,
  getMonthlyGroupedChartData,
  getMonthlySavingsRateChartData,
  getMonthlyTableRows,
} from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv'))); // Feb + Mar 2024

describe('getMonthlyGroupedChartData', () => {
  it('returns one income/expense/invested entry per month, in order', () => {
    const data = getMonthlyGroupedChartData(a);
    expect(data.labels).toHaveLength(2);
    expect(data.income).toEqual([2085, 30]); // Feb: 2000+85, Mar: 30 (tax refund)
    expect(data.expense).toEqual([60.5, 30]); // Feb: 45.50+15, Mar: 30
    expect(data.invested).toEqual([1000, 0]); // BUY only in Feb
  });
});

describe('getMonthlyCumulativeChartData', () => {
  it('reports the running balance per month', () => {
    const data = getMonthlyCumulativeChartData(a);
    // Feb net = 2085-60.5 = 2024.5; Mar net = 30-30 = 0 -> cumBal stays 2024.5
    expect(data.cumBal[0]).toBeCloseTo(2024.5, 3);
    expect(data.cumBal[1]).toBeCloseTo(2024.5, 3);
  });
});

describe('getMonthlySavingsRateChartData', () => {
  it('reports savingsRate straight from analyze()', () => {
    const data = getMonthlySavingsRateChartData(a);
    expect(data.savingsRate[0]).toBeCloseTo((2024.5 / 2085) * 100, 3);
  });
});

describe('getMonthlyTableRows', () => {
  it('flags the best and worst month by net', () => {
    const rows = getMonthlyTableRows(a);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.isBest).toBe(true); // Feb, net 2024.50
    expect(rows[1]?.isWorst).toBe(true); // Mar, net 0
  });

  it('formats each row with the right currency/percentage strings', () => {
    const rows = getMonthlyTableRows(a);
    expect(rows[0]?.income).toBe('2.085,00 €');
    expect(rows[0]?.count).toBeGreaterThan(0);
  });
});
