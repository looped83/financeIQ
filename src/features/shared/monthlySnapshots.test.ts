import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { buildMonthlySnapshots, computeTrends } from './monthlySnapshots';

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
