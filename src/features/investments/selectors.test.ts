import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  getAssetClassBreakdown,
  getDividendChartData,
  getDividendsBySecurity,
  getInvestmentKpis,
  getTradeVolumeData,
} from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv')));

describe('getInvestmentKpis', () => {
  it('reports buy volume, net dividends and the passive-income share', () => {
    const k = getInvestmentKpis(a);
    expect(k.invested).toBe(1000);
    expect(k.dividends).toBeCloseTo(70, 6); // 85 + -15, net
    expect(k.positions).toBe(1);
    expect(k.passiveRate).toBeCloseTo((70 / 2115) * 100, 6);
  });
});

describe('getDividendChartData / getTradeVolumeData', () => {
  it('reports per-month dividends and positive buy/sell volumes', () => {
    expect(getDividendChartData(a).values.reduce((s, v) => s + v, 0)).toBeCloseTo(70, 6);
    const trades = getTradeVolumeData(a);
    expect(trades.buys.reduce((s, v) => s + v, 0)).toBe(1000);
    expect(trades.buys.every((v) => v >= 0) && trades.sells.every((v) => v >= 0)).toBe(true);
  });
});

describe('getAssetClassBreakdown', () => {
  it('sums buy volume by asset class', () => {
    expect(getAssetClassBreakdown(a)).toEqual([['FUND', 1000]]);
  });
});

describe('getDividendsBySecurity', () => {
  it('aggregates net dividends per security with their share', () => {
    const rows = getDividendsBySecurity(a);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'TestCorp', count: 2, amount: '70,00 €', pct: 100, pctLabel: '100,0 %' });
  });
});
