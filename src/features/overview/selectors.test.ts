import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { cardShare, computeFinancialRatios, computeOverviewRates, getOverviewKpis } from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv')));

const MINI_HEADER = 'date,type,amount,tax,name,category';
function miniCsv(rows: Array<{ date: string; type: string; amount: number; tax?: number; name?: string }>): string {
  const lines = rows.map((r) => `${r.date},${r.type},${r.amount},${r.tax ?? 0},${r.name ?? ''},`);
  return [MINI_HEADER, ...lines].join('\n');
}

describe('computeOverviewRates', () => {
  it('derives savings/passive/invest rates from the fixture totals', () => {
    const rates = computeOverviewRates(a);
    // savingsRate = netBal/totalInc = 2024.5/2115 * 100
    expect(rates.savingsRate).toBeCloseTo((2024.5 / 2115) * 100, 3);
    // passiveRatio = totalDiv/totalInc = 70/2115 * 100
    expect(rates.passiveRatio).toBeCloseTo((70 / 2115) * 100, 3);
    // investRate = (buys − sells)/totalInc = (1000 − 550)/2115 * 100
    expect(rates.investRate).toBeCloseTo((450 / 2115) * 100, 3);
  });
});

describe('getOverviewKpis', () => {
  it('returns the 4 headline tiles with the totals from the fixture', () => {
    const kpis = getOverviewKpis(a, computeOverviewRates(a));
    expect(kpis.map((k) => k.label)).toEqual(['Einnahmen', 'Ausgaben', 'Netto', 'Dividenden (netto)']);
    expect(kpis[0]?.value).toBe('2.115 €'); // KPI tiles show whole euros
    expect(kpis[2]?.value).toBe('+2.025 €');
  });

  it('judges the savings rate against the shared target', () => {
    const kpis = getOverviewKpis(a, computeOverviewRates(a));
    expect(kpis[2]?.status).toBe('good'); // fixture's savings rate is ~95.7 %
  });
});

describe('computeFinancialRatios', () => {
  it('returns 9 rows; informational ones carry no judgement', () => {
    const rows = computeFinancialRatios(a, computeOverviewRates(a));
    expect(rows).toHaveLength(9);
    expect(rows.find((r) => r.label === 'Bester Monat')?.value).toContain('Feb'); // 2024.50 vs 0
    expect(rows.find((r) => r.label === 'Ø Buchungen pro Monat')?.good).toBeNull();
    expect(rows.find((r) => r.label === 'Sparquote')?.good).toBe(true);
  });
});

describe('cardShare', () => {
  it('reads the card share of spending from the monthly aggregates', () => {
    const cardOnly = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 1000 },
      { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -300 },
      { date: '2024-01-11', type: 'TRANSFER_OUTBOUND', amount: -100 },
    ])));
    expect(cardShare(cardOnly)).toBeCloseTo(75, 6);
  });
});
