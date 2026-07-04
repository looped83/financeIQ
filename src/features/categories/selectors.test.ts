import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  getAssetClassChartData,
  getDividendsBySecurity,
  getExpenseCategoryDonutData,
  getExpenseCategoryLegend,
  getIncomeExpenseByTypeData,
  getTopMerchants,
} from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv')));

describe('getExpenseCategoryDonutData / getExpenseCategoryLegend', () => {
  it('excludes dividends (per the domain-layer fix) and sums to the reported total', () => {
    const data = getExpenseCategoryDonutData(a);
    expect(data.labels).not.toContain('Dividenden');
    expect(data.labels).toContain('Kartenzahlungen');
    expect(data.labels).toContain('Steuerkorrektur');
    expect(data.total).toBeCloseTo(data.values.reduce((s, v) => s + v, 0), 6);
  });

  it('legend rows report a percentage of the shown total, summing to ~100%', () => {
    const legend = getExpenseCategoryLegend(a);
    const totalPct = legend.reduce((s, r) => s + r.pct, 0);
    expect(totalPct).toBeCloseTo(100, 3);
  });
});

describe('getIncomeExpenseByTypeData', () => {
  it('splits income and expense per transaction type', () => {
    const data = getIncomeExpenseByTypeData(a);
    const divIdx = data.labels.indexOf('DIVIDEND');
    // net dividend across the fixture is 85 + -15 = 70; income bucket sums positive
    // dividend rows only (tx-003's +85), expense bucket sums the negative one (tx-004's -15)
    expect(data.income[divIdx]).toBeCloseTo(85, 3);
    expect(data.expense[divIdx]).toBeCloseTo(15, 3);
  });
});

describe('getAssetClassChartData', () => {
  it('sums BUY volume by asset class', () => {
    const data = getAssetClassChartData(a);
    expect(data.labels).toEqual(['FUND']);
    expect(data.values).toEqual([1000]);
  });
});

describe('getDividendsBySecurity', () => {
  it('aggregates net/tax/gross per security', () => {
    const rows = getDividendsBySecurity(a);
    expect(rows).toHaveLength(1);
    const testCorp = rows[0]!;
    expect(testCorp.name).toBe('TestCorp');
    expect(testCorp.count).toBe(2);
    expect(testCorp.netto).toBe(fmtTestValue(70)); // 85 + -15, matches totalDiv
    // "Brutto" is displayed as netto+steuer (v.total+v.tax) — this reconstructs
    // the true gross (100 + -20 = 80) only when every tax value for a security
    // has the same sign. Here tx-004's tax is a *positive* refund (+5), summed
    // as abs()=5 alongside tx-003's abs(-15)=15, so steuer=20 and the displayed
    // "Brutto" comes out to 90, not the actual raw-amount sum of 80. This is a
    // faithful port of the same formula index.html uses today — a pre-existing
    // rounding/edge-case quirk when a dividend reversal has a positive tax
    // component, not something introduced by this migration.
    expect(testCorp.steuer).toBe(fmtTestValue(20));
    expect(testCorp.brutto).toBe(fmtTestValue(90));
  });

  it('percentage share is based on total net dividend income', () => {
    const rows = getDividendsBySecurity(a);
    expect(rows[0]?.pctLabel).toBe('100.0%'); // only one security, 70/70
  });
});

describe('getTopMerchants (re-exported from shared)', () => {
  it('is still usable from this module', () => {
    expect(getTopMerchants(a)).toEqual([{ name: 'Unbekannt', count: 1, avg: '45,50 €', total: '45,50 €' }]);
  });
});

function fmtTestValue(v: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €';
}
