import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { getFixedCosts, getSpendBreakdown, getTopMerchants } from './commonSelectors';

const HEADER = 'date,type,amount,tax,name,category';
const row = (date: string, type: string, amount: number, name = '') => `${date},${type},${amount},0,${name},`;

const a = analyze(parseCSV([
  HEADER,
  row('2024-01-01', 'TRANSFER_INBOUND', 4000, 'Employer'),
  row('2024-01-02', 'TRANSFER_OUTBOUND', -1200, 'Hausverwaltung'),
  row('2024-01-03', 'CARD_TRANSACTION', -80, 'REWE'),
  row('2024-01-04', 'CARD_TRANSACTION', -20, ''),
  row('2024-02-02', 'TRANSFER_OUTBOUND', -1200, 'Hausverwaltung'),
  row('2024-02-03', 'CARD_TRANSACTION', -120, 'REWE'),
  row('2024-03-02', 'TRANSFER_OUTBOUND', -1200, 'Hausverwaltung'),
  row('2024-03-03', 'CARD_TRANSACTION', -40, 'REWE'),
  row('2024-03-04', 'DIVIDEND', -5, 'Storno'),
].join('\n')));

describe('getSpendBreakdown', () => {
  it('groups by payee, falling back to the type label for nameless rows', () => {
    const { entries, total } = getSpendBreakdown(a, 'payee');
    expect(entries).toEqual([['Hausverwaltung', 3600], ['REWE', 240], ['Kartenzahlungen', 20]]);
    expect(total).toBe(3860); // the dividend correction is not spending
  });

  it('groups by transaction type', () => {
    expect(getSpendBreakdown(a, 'type').entries).toEqual([['Überweisungen', 3600], ['Kartenzahlungen', 260]]);
  });
});

describe('getTopMerchants / getFixedCosts', () => {
  it('ranks card merchants and labels nameless ones "Unbekannt"', () => {
    expect(getTopMerchants(a).map((m) => m.name)).toEqual(['REWE', 'Unbekannt']);
  });

  it('detects the stable monthly transfer as recurring and as a fixed cost', () => {
    const fixed = getFixedCosts(a); // REWE varies too much (CV > 0.3)
    expect(fixed.rows).toEqual([{ name: 'Hausverwaltung', monthCount: 3, perMonth: 1200 }]);
    expect(fixed.totalPerMonth).toBe(1200);
  });
});
