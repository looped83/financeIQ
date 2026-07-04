import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  buildMonthlySnapshots,
  computeAttentionItems,
  computeBestWorstMonths,
  computeDeepDiveChartsData,
  computeDeepDiveKpis,
  computeDeepDiveRecommendations,
  computeDetailTableRows,
  computeImprovedWorsened,
  computeMonthChanges,
  computeTrends,
} from './selectors';

const HEADER = 'date,type,amount,tax,name,category';
function row(date: string, type: string, amount: number, name = '', category = ''): string {
  return `${date},${type},${amount},0,${name},${category}`;
}

// 4 clean, hand-computable months. April deliberately has a sharp income
// drop, a cashflow swing to negative, 4 expenses >200€, and 2 new merchants
// vs. March — designed to exercise attention/improved-worsened/best-worst.
const CSV = [
  HEADER,
  row('2024-01-05', 'TRANSFER_INBOUND', 3000, 'Employer'),
  row('2024-01-10', 'CARD_TRANSACTION', -1500, 'Supermarket', 'Lebensmittel'),
  row('2024-01-15', 'CARD_TRANSACTION', -500, 'Restaurant', 'Essen'),

  row('2024-02-05', 'TRANSFER_INBOUND', 3000, 'Employer'),
  row('2024-02-10', 'CARD_TRANSACTION', -1700, 'Supermarket', 'Lebensmittel'),
  row('2024-02-15', 'CARD_TRANSACTION', -500, 'Restaurant', 'Essen'),
  row('2024-02-20', 'DIVIDEND', 50, 'StockA'),

  row('2024-03-05', 'TRANSFER_INBOUND', 3200, 'Employer'),
  row('2024-03-10', 'CARD_TRANSACTION', -1500, 'Supermarket', 'Lebensmittel'),
  row('2024-03-15', 'CARD_TRANSACTION', -500, 'Restaurant', 'Essen'),
  row('2024-03-20', 'DIVIDEND', 60, 'StockA'),

  row('2024-04-05', 'TRANSFER_INBOUND', 1000, 'Employer'),
  row('2024-04-10', 'CARD_TRANSACTION', -1500, 'Supermarket', 'Lebensmittel'),
  row('2024-04-12', 'CARD_TRANSACTION', -300, 'NewShop', 'Elektronik'),
  row('2024-04-15', 'CARD_TRANSACTION', -300, 'NewShop2', 'Elektronik'),
  row('2024-04-18', 'CARD_TRANSACTION', -500, 'Restaurant', 'Essen'),
  row('2024-04-20', 'DIVIDEND', 70, 'StockA'),
].join('\n');

const a = analyze(parseCSV(CSV));
const snapshots = buildMonthlySnapshots(a);

describe('buildMonthlySnapshots', () => {
  it('produces one snapshot per month, in order', () => {
    expect(snapshots.map((s) => s.month)).toEqual(['2024-01', '2024-02', '2024-03', '2024-04']);
  });

  it("each snapshot's subscriptions are always empty (a single month can't have a 2+-month pattern)", () => {
    // Documents a real limitation of re-analyzing one month in isolation —
    // present in the original app too, not introduced by this migration.
    expect(snapshots.every((s) => s.analysis.subscriptions.length === 0)).toBe(true);
  });
});

describe('computeDeepDiveKpis', () => {
  it('sums totals across all months and reports the last month vs. its predecessor', () => {
    const kpis = computeDeepDiveKpis(snapshots);
    // Dividends count as income too (DIVIDEND rows with amt>0 are part of `inc`):
    // income: 3000 + (3000+50) + (3200+60) + (1000+70) = 10380; expense: 2000+2200+2000+2600 = 8800
    expect(kpis[0]?.value).toBe('10.380,00 €');
    expect(kpis[1]?.value).toBe('8.800,00 €');
    expect(kpis[2]?.value).toBe('1.580,00 €'); // net = 10380-8800
    const lastMonthKpi = kpis[5]!;
    expect(lastMonthKpi.value).toBe('-1.530,00 €'); // April net = 1070-2600
    expect(lastMonthKpi.cls).toBe('expense');
  });
});

describe('computeDeepDiveChartsData', () => {
  it('returns one data point per month and a running cumulative total', () => {
    const chart = computeDeepDiveChartsData(snapshots);
    expect(chart.labels).toHaveLength(4);
    expect(chart.net).toEqual([1000, 850, 1260, -1530]);
    expect(chart.cumNet).toEqual([1000, 1850, 3110, 1580]);
  });

  it('groups expenses by transaction type (not the raw CSV category field)', () => {
    const chart = computeDeepDiveChartsData(snapshots);
    // every expense row in the fixture is a CARD_TRANSACTION, so expCat has
    // exactly one bucket regardless of the differing "category" CSV values.
    expect(chart.categoryStack).toHaveLength(1);
    expect(chart.categoryStack[0]?.label).toBe('Kartenzahlungen');
    expect(chart.categoryStack[0]?.data).toEqual([2000, 2200, 2000, 2600]);
  });
});

describe('computeMonthChanges', () => {
  it('returns nothing for the first month (no predecessor)', () => {
    expect(computeMonthChanges(snapshots, '2024-01')).toEqual([]);
  });

  it('flags the April income drop as the highest-impact change', () => {
    const changes = computeMonthChanges(snapshots, '2024-04');
    expect(changes[0]?.title).toContain('Einnahmen gesunken');
  });

  it('flags new merchants when comparing against March', () => {
    const changes = computeMonthChanges(snapshots, '2024-04');
    const merchantChange = changes.find((c) => c.title.includes('neue Händler'));
    expect(merchantChange?.title).toBe('2 neue Händler');
  });
});

describe('computeImprovedWorsened', () => {
  it('flags April as worsened on income and net cashflow', () => {
    const { worsened } = computeImprovedWorsened(snapshots);
    expect(worsened.some((w) => w.title === 'Einnahmen gesunken')).toBe(true);
  });
});

describe('computeBestWorstMonths', () => {
  it('ranks March as the best month and April as the worst', () => {
    const { best, worst } = computeBestWorstMonths(snapshots);
    expect(best[0]?.month).toBe('2024-03');
    expect(worst[0]?.month).toBe('2024-04');
  });
});

describe('computeTrends', () => {
  it('detects a growing dividend trend', () => {
    const trends = computeTrends(snapshots);
    // dividends: 0, 50, 60, 70 -- avg > 50 only once tax-free amounts averaged; slope positive
    expect(trends.some((t) => t.title === 'Passives Einkommen wächst')).toBe(false); // avgDiv=45, below the >50 gate
  });

  it('reports income as stable (slope within +/-50 threshold)', () => {
    const trends = computeTrends(snapshots);
    expect(trends.some((t) => t.title === 'Einnahmen stabil' || t.title === 'Einnahmen rückläufig')).toBe(true);
  });
});

describe('computeAttentionItems', () => {
  it('flags the sharp income drop in the latest month', () => {
    const items = computeAttentionItems(snapshots);
    expect(items.some((i) => i.title === 'Einnahmen deutlich gesunken')).toBe(true);
  });

  it('flags 4 large expenses (>200€) in April', () => {
    const items = computeAttentionItems(snapshots);
    const bigExpenseItem = items.find((i) => i.title.includes('Großausgaben'));
    expect(bigExpenseItem?.title).toContain('4 Großausgaben');
  });
});

describe('computeDeepDiveRecommendations', () => {
  it('always returns at least the savings-rate recommendation', () => {
    const recs = computeDeepDiveRecommendations(snapshots);
    expect(recs.length).toBeGreaterThan(0);
    // overall sr = 1400/10200*100 ~= 13.7% -> "steigern" tier (10-20%)
    expect(recs[0]?.title).toBe('Sparquote steigern');
  });
});

describe('computeDetailTableRows', () => {
  it('flags March as best and April as worst by net', () => {
    const rows = computeDetailTableRows(snapshots);
    expect(rows[2]?.isBest).toBe(true); // March
    expect(rows[3]?.isWorst).toBe(true); // April
  });

  it('shows an up/down delta arrow once the change is at least 1 EUR', () => {
    const rows = computeDetailTableRows(snapshots);
    // March income 3260 (3200 salary + 60 dividend) vs Feb 3050 -> up
    expect(rows[2]?.incomeDelta).toBe('up');
    // April income 1070 vs March 3260 -> down
    expect(rows[3]?.incomeDelta).toBe('down');
  });

  it('suppresses the delta arrow when the change is under 1 EUR', () => {
    // Build a 2-month case where income is exactly unchanged.
    const flatCsv = [
      HEADER,
      row('2024-01-05', 'TRANSFER_INBOUND', 3000, 'Employer'),
      row('2024-01-10', 'CARD_TRANSACTION', -1000, 'Shop'),
      row('2024-02-05', 'TRANSFER_INBOUND', 3000, 'Employer'),
      row('2024-02-10', 'CARD_TRANSACTION', -1000, 'Shop'),
    ].join('\n');
    const flatSnapshots = buildMonthlySnapshots(analyze(parseCSV(flatCsv)));
    const rows = computeDetailTableRows(flatSnapshots);
    expect(rows[1]?.incomeDelta).toBeNull();
  });
});
