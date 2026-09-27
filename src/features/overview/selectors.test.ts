import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { cardShare, computeAlerts, computeFinancialRatios, computeOverviewRates, computeTrends, getOverviewKpis } from './selectors';

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
    expect(kpis[0]?.value).toBe('2.115,00 €');
    expect(kpis[2]?.value).toBe('+2.024,50 €');
  });

  it('judges the savings rate against the 15 % mark', () => {
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

describe('computeAlerts', () => {
  it('fires exactly the passive-income and sparplan alerts for the fixture', () => {
    const alerts = computeAlerts(a, computeOverviewRates(a));
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.color).toBe('green');
    expect(alerts[0]?.title).toBe('Passives Einkommen');
    expect(alerts[1]?.title).toBe('Sparplan aktiv');
  });

  it('fires the negative-balance alert when expenses exceed income', () => {
    const neg = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 500 },
      { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -800 },
    ])));
    const alerts = computeAlerts(neg, computeOverviewRates(neg));
    expect(alerts.some((al) => al.title === 'Negativer Saldo')).toBe(true);
  });

  it('fires the "2+ negative months" alert independently of the balance alert', () => {
    const rows = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 500 },
      { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -800 },
      { date: '2024-02-05', type: 'TRANSFER_INBOUND', amount: 3000 },
      { date: '2024-02-10', type: 'CARD_TRANSACTION', amount: -500 },
      { date: '2024-03-05', type: 'TRANSFER_INBOUND', amount: 400 },
      { date: '2024-03-10', type: 'CARD_TRANSACTION', amount: -900 },
    ])));
    const alerts = computeAlerts(rows, computeOverviewRates(rows));
    expect(alerts.some((al) => al.title === '2 negative Monate')).toBe(true);
  });

  it('fires the 3-month rising-expenses trend alert', () => {
    const rows = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 3000 },
      { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -500 },
      { date: '2024-02-05', type: 'TRANSFER_INBOUND', amount: 3000 },
      { date: '2024-02-10', type: 'CARD_TRANSACTION', amount: -800 },
      { date: '2024-03-05', type: 'TRANSFER_INBOUND', amount: 3000 },
      { date: '2024-03-10', type: 'CARD_TRANSACTION', amount: -1000 },
      { date: '2024-04-05', type: 'TRANSFER_INBOUND', amount: 3000 },
      { date: '2024-04-10', type: 'CARD_TRANSACTION', amount: -1500 },
    ])));
    const alerts = computeAlerts(rows, computeOverviewRates(rows));
    expect(alerts.some((al) => al.title === 'Steigende Ausgaben')).toBe(true);
  });

  it('produces no alerts for a small, unremarkable dataset', () => {
    // Uses a non-card expense type deliberately, since a 100%-via-card
    // dataset would (correctly) trip the "Kartenlastig" alert on its own.
    const rows = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 1000 },
      { date: '2024-01-10', type: 'TRANSFER_DIRECT_DEBIT_INBOUND', amount: -100 },
    ])));
    expect(computeAlerts(rows, computeOverviewRates(rows))).toEqual([]);
  });
});

describe('computeTrends', () => {
  const HEADER = 'date,type,amount,tax,name,category';
  const row = (date: string, type: string, amount: number, name = '', category = '') => `${date},${type},${amount},0,${name},${category}`;
  // 4 months; April has a sharp income drop.
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
  const trends = computeTrends(a);

  it('keeps the dividend trend below its >50 €/month gate', () => {
    expect(trends.some((t) => t.title === 'Passives Einkommen wächst')).toBe(false); // avg 45 €
  });

  it('reports the income direction', () => {
    expect(trends.some((t) => t.title === 'Einnahmen stabil' || t.title === 'Einnahmen rückläufig')).toBe(true);
  });

  it('reads the card share from the monthly aggregates (all spending here is by card)', () => {
    expect(cardShare(a)).toBeCloseTo(100, 6);
    expect(trends.some((t) => t.title === 'Ø 100 % per Karte')).toBe(true);
  });
});
