import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  buildMonthAlign,
  computeCompareInsights,
  computeCompareKpis,
  computeCompareLabels,
  deriveYearLabel,
  getCategoryDeltaChartData,
  getCompareDeltaTableRows,
  getMonthlyMetricChartData,
  getNetDeltaChartData,
} from './selectors';

const HEADER = 'date,type,amount,tax,name,category';
function row(date: string, type: string, amount: number, name = ''): string {
  return `${date},${type},${amount},0,${name},`;
}

const a1 = analyze(parseCSV([
  HEADER,
  row('2024-01-05', 'TRANSFER_INBOUND', 3000, 'Employer'),
  row('2024-01-10', 'CARD_TRANSACTION', -2000, 'Shop'),
  row('2024-02-05', 'TRANSFER_INBOUND', 3000, 'Employer'),
  row('2024-02-10', 'CARD_TRANSACTION', -2200, 'Shop'),
  row('2024-02-15', 'DIVIDEND', 50, 'StockA'),
].join('\n')));

const a2 = analyze(parseCSV([
  HEADER,
  row('2025-01-05', 'TRANSFER_INBOUND', 3500, 'Employer'),
  row('2025-01-10', 'CARD_TRANSACTION', -1800, 'Shop'),
  row('2025-02-05', 'TRANSFER_INBOUND', 3200, 'Employer'),
  row('2025-02-10', 'CARD_TRANSACTION', -2200, 'Shop'),
  row('2025-02-15', 'DIVIDEND', 80, 'StockA'),
  row('2025-02-20', 'TRANSFER_DIRECT_DEBIT_INBOUND', -300, 'Insurance'),
].join('\n')));

describe('deriveYearLabel', () => {
  it('returns the single year when all months share one year', () => {
    expect(deriveYearLabel(['2024-01', '2024-06'], 'fallback.csv')).toBe('2024');
  });
  it('returns a range for multiple years', () => {
    expect(deriveYearLabel(['2024-11', '2025-02'], 'fallback.csv')).toBe('2024–2025');
  });
  it('falls back when there are no months at all', () => {
    expect(deriveYearLabel([], 'fallback.csv')).toBe('fallback.csv');
  });
});

describe('computeCompareLabels', () => {
  it('uses the year labels when they differ', () => {
    expect(computeCompareLabels(a1, a2, 'base.csv', 'compare.csv')).toEqual({ y1: '2024', y2: '2025' });
  });
  it('falls back to file names (extension stripped) when both years match', () => {
    const labels = computeCompareLabels(a1, a1, 'jan-export.csv', 'jan-export-2.csv');
    expect(labels).toEqual({ y1: 'jan-export', y2: 'jan-export-2' });
  });
});

describe('computeCompareKpis', () => {
  it('reports the 6 headline KPIs for both analyses', () => {
    const kpis = computeCompareKpis(a1, a2);
    expect(kpis.map((k) => k.label)).toEqual(['Einnahmen', 'Ausgaben', 'Netto-Saldo', 'Investiert', 'Dividenden', 'Gebühren']);
    // a1 income: 3000+3000+50 (dividend counts as income) = 6050
    expect(kpis[0]).toEqual({ label: 'Einnahmen', v1: 6050, v2: 6780 });
    // a2 expense now includes the new -300 direct-debit row: 1800+2200+300 = 4300
    expect(kpis[1]).toEqual({ label: 'Ausgaben', v1: 4200, v2: 4300 });
  });
});

describe('buildMonthAlign', () => {
  const align = buildMonthAlign(a1, a2);

  it('aligns by calendar month number regardless of year', () => {
    expect(align.MN).toEqual(['01', '02']);
  });

  it('sums income/expense/dividend per calendar month for each analysis', () => {
    expect(align.m1['02']).toEqual({ income: 3050, expense: -2200, invested: 0, net: 850, dividend: 50 });
    expect(align.m2['02']).toEqual({ income: 3280, expense: -2500, invested: 0, net: 780, dividend: 80 });
  });
});

describe('getMonthlyMetricChartData', () => {
  const align = buildMonthAlign(a1, a2);

  it('returns the requested metric per aligned month, taking abs() for expense', () => {
    const incomeChart = getMonthlyMetricChartData(align, 'income');
    expect(incomeChart.series1).toEqual([3000, 3050]);
    expect(incomeChart.series2).toEqual([3500, 3280]);

    const expenseChart = getMonthlyMetricChartData(align, 'expense');
    expect(expenseChart.series1).toEqual([2000, 2200]); // positive, not -2000/-2200
  });
});

describe('getNetDeltaChartData', () => {
  it('computes vergleich-minus-basis net delta per month', () => {
    const align = buildMonthAlign(a1, a2);
    const delta = getNetDeltaChartData(align);
    // Jan: 1700-1000=700; Feb: 780-850=-70
    expect(delta.deltas).toEqual([700, -70]);
  });
});

describe('getCategoryDeltaChartData', () => {
  it('ranks category deltas by absolute size, largest first', () => {
    const data = getCategoryDeltaChartData(a1, a2);
    // Lastschriften is new in a2 (delta +300), Kartenzahlungen delta is -200
    expect(data.labels[0]).toBe('Lastschriften');
    expect(data.deltas[0]).toBe(300);
    expect(data.labels[1]).toBe('Kartenzahlungen');
    expect(data.deltas[1]).toBe(-200);
  });
});

describe('computeCompareInsights', () => {
  const labels = computeCompareLabels(a1, a2, 'base.csv', 'compare.csv');
  const align = buildMonthAlign(a1, a2);

  it('flags rising income, rising expenses, and dividend growth', () => {
    const insights = computeCompareInsights(a1, a2, labels, align);
    expect(insights.some((i) => i.title === 'Einnahmen gestiegen')).toBe(true);
    expect(insights.some((i) => i.title === 'Ausgaben gestiegen')).toBe(true);
    expect(insights.some((i) => i.title === 'Dividenden gewachsen')).toBe(true);
  });

  it('flags the new expense category introduced in the compare file', () => {
    const insights = computeCompareInsights(a1, a2, labels, align);
    const newCat = insights.find((i) => i.title === 'Neue Ausgabenkategorien');
    expect(newCat?.desc).toContain('Lastschriften');
  });

  it('identifies January as the best month and February as the worst', () => {
    const insights = computeCompareInsights(a1, a2, labels, align);
    expect(insights.some((i) => i.title.includes('Beste Monatsverbesserung: Jan'))).toBe(true);
    expect(insights.some((i) => i.title.includes('Stärkste Verschlechterung: Feb'))).toBe(true);
  });
});

describe('getCompareDeltaTableRows', () => {
  it('includes all 6 KPI rows plus a transaction-count row', () => {
    const rows = getCompareDeltaTableRows(a1, a2);
    expect(rows).toHaveLength(7);
    expect(rows[6]?.label).toBe('Transaktionen');
    expect(rows[6]?.deltaPct).toBe('—');
  });
});
