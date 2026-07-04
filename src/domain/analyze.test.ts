import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from './csv';
import { analyze } from './analyze';

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

describe('analyze() — dividends, corrections, buy/sell, tax optimization', () => {
  const rows = parseCSV(fixture('dividends-and-corrections.csv'));
  const a = analyze(rows);

  it('parses all 9 data rows', () => {
    expect(rows.length).toBe(9);
  });

  it('excludes rows before MIN_DATE (2024-01-01)', () => {
    expect(a.enriched.length).toBe(8);
  });

  it('parses a quoted description containing a comma', () => {
    const r = a.enriched.find((r) => r.transaction_id === 'tx-002');
    expect(r?._desc).toBe('Coffee, Bakery & Bread');
  });

  it('dividend net amount = amount + tax (gross minus withholding)', () => {
    const r = a.enriched.find((r) => r.transaction_id === 'tx-003');
    expect(r?._amt).toBeCloseTo(85.0, 3);
  });

  it('dividend correction row nets negative (amount+tax) but stays a DIVIDEND', () => {
    const r = a.enriched.find((r) => r.transaction_id === 'tx-004');
    expect(r?._amt).toBeCloseTo(-15.0, 3);
    expect(r?._isDiv).toBe(true);
  });

  it('totalDiv reflects net (85 + -15 = 70), not gross (100 + -20 = 80)', () => {
    expect(a.totalDiv).toBeCloseTo(70.0, 3);
  });

  it('BUY amount stays gross — fee is tracked separately, not folded into _amt', () => {
    const r = a.enriched.find((r) => r.transaction_id === 'tx-005');
    expect(r?._amt).toBeCloseTo(-1000.0, 3);
  });

  it('SELL amount stays gross even though tax is present', () => {
    const r = a.enriched.find((r) => r.transaction_id === 'tx-006');
    expect(r?._amt).toBeCloseTo(550.0, 3);
  });

  it('totalInv / totalSold use the gross trade amount', () => {
    expect(a.totalInv).toBeCloseTo(1000.0, 3);
    expect(a.totalSold).toBeCloseTo(550.0, 3);
  });

  it('TAX_OPTIMIZATION rows with amount=0 surface the tax value as real cash flow', () => {
    const debit = a.enriched.find((r) => r.transaction_id === 'tx-007');
    const credit = a.enriched.find((r) => r.transaction_id === 'tx-008');
    expect(debit?._amt).toBeCloseTo(-30.0, 3);
    expect(credit?._amt).toBeCloseTo(30.0, 3);
  });

  it('totalInc / totalExp / netBal match hand-computed totals', () => {
    // income: 2000 (salary) + 85 (dividend) + 30 (tax refund) = 2115
    // expense: -45.50 (card) + -15 (dividend correction) + -30 (tax debit) = -90.50
    expect(a.totalInc).toBeCloseTo(2115.0, 3);
    expect(a.totalExp).toBeCloseTo(-90.5, 3);
    expect(a.netBal).toBeCloseTo(2024.5, 3);
  });

  it('totalFee sums only BUY/SELL fees', () => {
    expect(a.totalFee).toBeCloseTo(2.0, 3);
  });

  it('totalTax sums abs(tax) across every row type', () => {
    // 15 (div) + 5 (div correction) + 20 (sell) + 30 (tax debit) + 30 (tax credit) = 100
    expect(a.totalTax).toBeCloseTo(100.0, 3);
  });

  it('expense-by-category excludes dividends even when net-negative', () => {
    expect(a.expCat['Dividenden']).toBeUndefined();
  });

  it('expense-by-category still includes the card payment and tax debit', () => {
    expect(a.expCat['Kartenzahlungen']).toBeCloseTo(45.5, 3);
    expect(a.expCat['Steuerkorrektur']).toBeCloseTo(30.0, 3);
  });

  it('outlier detection does not divide by zero / crash on tiny datasets', () => {
    expect(Array.isArray(a.outliers)).toBe(true);
  });
});

describe('analyze() — German bank export, semicolon delimiter, comma decimals', () => {
  const rows = parseCSV(fixture('german-bank-semicolon.csv'));
  const a = analyze(rows);

  it('auto-detects the ";" delimiter', () => {
    expect(rows.length).toBe(2);
  });

  it('maps German column aliases (Buchungsdatum/Betrag) and parses comma decimals', () => {
    expect(a.totalInc).toBeCloseTo(1500.0, 3);
    expect(a.totalExp).toBeCloseTo(-25.5, 3);
  });

  it('parses dd.mm.yyyy dates correctly', () => {
    const r = a.enriched.find((r) => r.betrag === '1500,00');
    expect(r?._month).toBe('2024-03');
  });
});
