import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  computeAlerts,
  computeFinancialRatios,
  computeOverviewRates,
  getIncomeSources,
  getLast6MonthsChartData,
  getOverviewKpis,
  getRecurringExpenses,
  getTopExpenseCategoriesData,
  getTopMerchants,
  getTopTransactions,
  getVolumeByTypeChartData,
} from './selectors';

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
    // investRate = totalInv/totalInc = 1000/2115 * 100
    expect(rates.investRate).toBeCloseTo((1000 / 2115) * 100, 3);
  });
});

describe('getOverviewKpis', () => {
  it('returns 6 KPI cards with the totals from the fixture', () => {
    const kpis = getOverviewKpis(a, computeOverviewRates(a));
    expect(kpis).toHaveLength(6);
    expect(kpis.map((k) => k.label)).toEqual([
      'Gesamteinnahmen', 'Gesamtausgaben', 'Netto-Saldo', 'Investiert', 'Dividenden', 'Sparquote',
    ]);
    expect(kpis[0]?.value).toBe('2.115,00 €');
    expect(kpis[2]?.sub).toBe('Positiv ✓');
  });

  it('flags savings rate class by threshold (>=20 income, >=10 warn, else expense)', () => {
    const kpis = getOverviewKpis(a, computeOverviewRates(a));
    // fixture's savings rate is ~95.7% -> well above 20
    expect(kpis[5]?.cls).toBe('income');
  });
});

describe('getLast6MonthsChartData', () => {
  it('returns per-month income/expense series (fixture only has 2 months, both included)', () => {
    const data = getLast6MonthsChartData(a);
    expect(data.labels).toHaveLength(2);
    expect(data.income).toEqual([2085, 30]); // Feb: 2000+85, Mar: 30 (tax refund)
    expect(data.expense).toEqual([60.5, 30]); // Feb: 45.50+15, Mar: 30
  });
});

describe('getVolumeByTypeChartData', () => {
  it('sorts transaction types by total volume descending', () => {
    const data = getVolumeByTypeChartData(a);
    expect(data.labels[0]).toBe('Eingehend'); // TRANSFER_INBOUND, 2000 — largest single row
    expect(data.labels.length).toBeLessThanOrEqual(8);
  });
});

describe('getTopExpenseCategoriesData', () => {
  it('excludes dividends from expense categories (per the domain-layer fix)', () => {
    const data = getTopExpenseCategoriesData(a);
    expect(data.labels).not.toContain('Dividenden');
    expect(data.labels).toContain('Kartenzahlungen');
  });
});

describe('computeFinancialRatios', () => {
  it('returns exactly 9 ratio rows including best/worst month', () => {
    const rows = computeFinancialRatios(a, computeOverviewRates(a));
    expect(rows).toHaveLength(9);
    const bestMonth = rows.find((r) => r.label === 'Bester Monat');
    expect(bestMonth?.value).toContain('Feb'); // Feb has the higher net (2024.50 vs 0)
  });
});

describe('getTopMerchants / getIncomeSources / getRecurringExpenses / getTopTransactions', () => {
  it('getTopMerchants falls back to "Unbekannt" for a nameless CARD_TRANSACTION row', () => {
    const merchants = getTopMerchants(a);
    expect(merchants).toEqual([{ name: 'Unbekannt', count: 1, avg: '45,50 €', total: '45,50 €' }]);
  });

  it('getIncomeSources groups income by type label with percentage share', () => {
    const sources = getIncomeSources(a);
    const salary = sources.find((s) => s.label === 'Eingehend');
    expect(salary?.count).toBe(1);
    expect(salary?.total).toBe('2.000,00 €');
  });

  it('getRecurringExpenses is empty for the fixture (no name repeats across 2+ months)', () => {
    const summary = getRecurringExpenses(a);
    expect(summary.rows).toEqual([]);
  });

  it('getTopTransactions ranks cash rows by absolute amount, excluding BUY/SELL', () => {
    // |tx-001|=2000, |tx-003|=85, |tx-002|=45.50, |tx-004|=15 — top 3 by |amount|
    const top = getTopTransactions(a, 3);
    expect(top.map((r) => r.transaction_id)).toEqual(['tx-001', 'tx-003', 'tx-002']);
  });
});

describe('computeAlerts', () => {
  it('fires exactly the passive-income and sparplan alerts for the fixture', () => {
    const alerts = computeAlerts(a, computeOverviewRates(a));
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.color).toBe('green');
    expect(alerts[0]?.text).toContain('Passives Einkommen');
    expect(alerts[1]?.text).toContain('Sparplan aktiv');
  });

  it('fires the negative-balance alert when expenses exceed income', () => {
    const neg = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 500 },
      { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -800 },
    ])));
    const alerts = computeAlerts(neg, computeOverviewRates(neg));
    expect(alerts.some((al) => al.text.includes('Negativer Saldo'))).toBe(true);
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
    expect(alerts.some((al) => al.text.includes('2 negative Monate'))).toBe(true);
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
    expect(alerts.some((al) => al.text.includes('Steigende Ausgaben'))).toBe(true);
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
