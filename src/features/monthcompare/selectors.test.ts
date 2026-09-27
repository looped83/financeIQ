import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  computeMonthKpis,
  getMonthCategoryComparison,
  getMonthDeltaTableRows,
  getMonthMetricTimelineData,
} from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv')));
const mA = a.months['2024-02']!;
const mB = a.months['2024-03']!;

describe('computeMonthKpis', () => {
  it('returns KPIs for both months', () => {
    const kpis = computeMonthKpis(mA, mB);
    expect(kpis).toHaveLength(6);
    expect(kpis[0]!.label).toBe('Einnahmen');
    expect(kpis[0]!.vA).toBe(mA.income);
    expect(kpis[0]!.vB).toBe(mB.income);
  });

  it('uses absolute values for expenses', () => {
    const kpis = computeMonthKpis(mA, mB);
    const expKpi = kpis.find((k) => k.label === 'Ausgaben')!;
    expect(expKpi.vA).toBe(Math.abs(mA.expense));
    expect(expKpi.vB).toBe(Math.abs(mB.expense));
  });

  it('includes savings rate', () => {
    const kpis = computeMonthKpis(mA, mB);
    const sr = kpis.find((k) => k.label === 'Sparquote')!;
    expect(sr.vA).toBe(mA.savingsRate);
    expect(sr.vB).toBe(mB.savingsRate);
  });
});

describe('getMonthCategoryComparison', () => {
  it('returns per-category expense breakdown for both months', () => {
    const cat = getMonthCategoryComparison(a, '2024-02', '2024-03');
    expect(cat.labels.length).toBeGreaterThan(0);
    expect(cat.deltasA.length).toBe(cat.labels.length);
    expect(cat.deltasB.length).toBe(cat.labels.length);
  });

  it('respects the limit parameter', () => {
    const cat = getMonthCategoryComparison(a, '2024-02', '2024-03', 1);
    expect(cat.labels.length).toBeLessThanOrEqual(1);
  });
});

describe('getMonthDeltaTableRows', () => {
  const rows = getMonthDeltaTableRows(a, '2024-02', '2024-03');

  it('returns formatted delta rows including the booking count', () => {
    expect(rows.length).toBe(7);
    const txRow = rows.find((r) => r.label === 'Buchungen')!;
    expect(Number(txRow.vA)).toBe(mA.count);
    expect(txRow.good).toBeNull();
  });

  it('judges a change by its effect: less spending is good, less income is not', () => {
    const exp = rows.find((r) => r.label === 'Ausgaben')!;
    const inc = rows.find((r) => r.label === 'Einnahmen')!;
    expect(exp.good).toBe(Math.abs(mB.expense) < Math.abs(mA.expense));
    expect(inc.good).toBe(mB.income > mA.income);
  });
});

describe('getMonthMetricTimelineData', () => {
  it('returns all months with highlighted indices', () => {
    const tl = getMonthMetricTimelineData(a, 'income', '2024-02', '2024-03');
    expect(tl.labels).toHaveLength(a.mKeys.length);
    expect(tl.values).toHaveLength(a.mKeys.length);
    expect(tl.highlightA).toBe(0);
    expect(tl.highlightB).toBe(1);
  });

  it('uses absolute expense values', () => {
    const tl = getMonthMetricTimelineData(a, 'expense', '2024-02', '2024-03');
    expect(tl.values[0]).toBe(Math.abs(mA.expense));
  });

  it('returns -1 for months not in mKeys', () => {
    const tl = getMonthMetricTimelineData(a, 'income', '2099-01', '2024-03');
    expect(tl.highlightA).toBe(-1);
  });
});
