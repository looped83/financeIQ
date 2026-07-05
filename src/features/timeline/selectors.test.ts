import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  computeMainChartData,
  getCumulativeIncExpChartData,
  getDividendChartData,
  getInvestChartData,
  getMonthlyNetChartData,
} from './selectors';

const HEADER = 'date,type,amount,tax,name,category';
function row(date: string, type: string, amount: number): string {
  return `${date},${type},${amount},0,,`;
}

const a = analyze(parseCSV([
  HEADER,
  row('2024-01-05', 'TRANSFER_INBOUND', 3000),
  row('2024-01-10', 'CARD_TRANSACTION', -1000),
  row('2024-01-15', 'BUY', -500),
  row('2024-02-05', 'TRANSFER_INBOUND', 3000),
  row('2024-02-10', 'CARD_TRANSACTION', -1200),
  row('2024-02-15', 'DIVIDEND', 50),
  row('2024-02-20', 'SELL', 200),
  row('2024-03-05', 'TRANSFER_INBOUND', 3000),
  row('2024-03-10', 'CARD_TRANSACTION', -800),
].join('\n')));

describe('computeMainChartData — monthly view', () => {
  const data = computeMainChartData(a, 'monthly');

  it('is not date-scaled and uses month labels', () => {
    expect(data.isDate).toBe(false);
    expect(data.labels).toHaveLength(3);
  });

  it('accumulates net cashflow across months', () => {
    // Jan net: 3000-1000=2000 (BUY doesn't count as expense); Feb net: 3000-1200+50=1850; Mar net: 3000-800=2200
    expect(data.cumData).toEqual([2000, 3850, 6050]);
  });

  it('computes a trailing 3-month moving average of the cumulative series', () => {
    // i=0: avg([2000])=2000; i=1: avg([2000,3850])=2925; i=2: avg([2000,3850,6050])=3966.67
    const ma = data.maData as number[];
    expect(ma[0]).toBeCloseTo(2000);
    expect(ma[1]).toBeCloseTo(2925);
    expect(ma[2]).toBeCloseTo(3966.6667, 3);
  });
});

describe('computeMainChartData — quarterly view', () => {
  it('groups all 3 months into a single Q1 bucket', () => {
    const data = computeMainChartData(a, 'quarterly');
    expect(data.labels).toEqual(['2024-Q1']);
    expect(data.cumData).toEqual([6050]);
  });
});

describe('computeMainChartData — daily view', () => {
  it('returns date-keyed {x,y} points accumulating cash-only transactions', () => {
    const data = computeMainChartData(a, 'daily');
    expect(data.isDate).toBe(true);
    expect(data.labels).toBeUndefined();
    const cum = data.cumData as { x: string; y: number }[];
    // BUY/SELL are excluded from `cash`; last point accumulates all cash amounts.
    const lastPoint = cum[cum.length - 1]!;
    expect(lastPoint.y).toBe(2000 + 1850 + 2200); // same cash-only net totals as monthly view
  });
});

describe('getMonthlyNetChartData', () => {
  it('colors positive months green and would color negative months red', () => {
    const data = getMonthlyNetChartData(a);
    expect(data.values).toEqual([2000, 1850, 2200]);
    expect(data.colors.every((c) => c === 'rgba(16,185,129,.7)')).toBe(true);
  });
});

describe('getDividendChartData', () => {
  it('reports dividend income per month, zero where none occurred', () => {
    expect(getDividendChartData(a).values).toEqual([0, 50, 0]);
  });
});

describe('getInvestChartData', () => {
  it('negates buys (drawn downward) and reports sells as positive', () => {
    const data = getInvestChartData(a);
    expect(data.buys).toEqual([-500, -0, -0]);
    expect(data.sells).toEqual([0, 200, 0]);
  });
});

describe('getCumulativeIncExpChartData', () => {
  it('accumulates income and (absolute) expense separately', () => {
    const data = getCumulativeIncExpChartData(a);
    expect(data.cumInc).toEqual([3000, 6050, 9050]); // dividend rolls into income too
    expect(data.cumExp).toEqual([1000, 2200, 3000]);
  });
});
