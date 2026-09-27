import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { getMonthlyDetailRows, getMonthlySavingsRateChartData } from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv'))); // Feb + Mar 2024

describe('getMonthlySavingsRateChartData', () => {
  it('reports savingsRate straight from analyze()', () => {
    const data = getMonthlySavingsRateChartData(a);
    expect(data.savingsRate[0]).toBeCloseTo((2024.5 / 2085) * 100, 3);
  });
});

describe('getMonthlyDetailRows', () => {
  it('flags the best and worst month by net', () => {
    const rows = getMonthlyDetailRows(a);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.isBest).toBe(true); // Feb, net 2024.50
    expect(rows[1]?.isWorst).toBe(true); // Mar, net 0
  });

  it('formats amounts and marks month-over-month direction (≥ 1 € change)', () => {
    const rows = getMonthlyDetailRows(a);
    expect(rows[0]?.income).toBe('2.085,00 €');
    expect(rows[0]?.incomeDelta).toBeNull(); // first month
    expect(rows[1]?.incomeDelta).toBe('down'); // 30 vs 2085
    expect(rows[1]?.expenseDelta).toBe('down'); // 30 vs 60.50 — spending fell
  });

  it('suppresses the arrow when the change is under 1 €', () => {
    const flat = analyze(parseCSV([
      'date,type,amount,tax,name,category',
      '2024-01-05,TRANSFER_INBOUND,3000,0,Employer,',
      '2024-02-05,TRANSFER_INBOUND,3000.5,0,Employer,',
    ].join('\n')));
    expect(getMonthlyDetailRows(flat)[1]?.incomeDelta).toBeNull();
  });
});
