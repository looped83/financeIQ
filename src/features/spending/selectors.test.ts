import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import {
  getFixVarTimelineData,
  getMerchantTimelineData,
  getOutlierRows,
  getSpendingKpis,
  getTypeStackData,
} from './selectors';

const HEADER = 'date,type,amount,tax,name,category';
const row = (date: string, type: string, amount: number, name = '') => `${date},${type},${amount},0,${name},`;

const a = analyze(parseCSV([
  HEADER,
  row('2024-01-01', 'TRANSFER_INBOUND', 4000, 'Employer'),
  row('2024-01-02', 'TRANSFER_OUTBOUND', -1200, 'Hausverwaltung'),
  row('2024-01-03', 'CARD_TRANSACTION', -80, 'REWE'),
  row('2024-01-15', 'BUY', -500, 'ETF'),
  row('2024-02-02', 'TRANSFER_OUTBOUND', -1200, 'Hausverwaltung'),
  row('2024-02-03', 'CARD_TRANSACTION', -120, 'REWE'),
  row('2024-03-02', 'TRANSFER_OUTBOUND', -1200, 'Hausverwaltung'),
  row('2024-03-03', 'CARD_TRANSACTION', -40, 'REWE'),
  row('2024-03-04', 'DIVIDEND', -5, 'Storno'),
].join('\n')));

describe('getSpendingKpis', () => {
  it('reports total spend and the average per booking', () => {
    const k = getSpendingKpis(a);
    expect(k.total).toBeCloseTo(3845, 6); // includes the dividend correction, like totalExp
    expect(k.bookings).toBe(7);
    expect(k.avgPerBooking).toBeCloseTo(3845 / 7, 6);
  });
});

describe('getTypeStackData', () => {
  it('sums spend per month and type, trades and corrections excluded', () => {
    const d = getTypeStackData(a);
    expect(d.labels).toHaveLength(3);
    expect(d.series).toEqual([
      { label: 'Überweisungen', data: [1200, 1200, 1200] },
      { label: 'Kartenzahlungen', data: [80, 120, 40] },
    ]);
  });
});

describe('getMerchantTimelineData', () => {
  it('lists the top payees with their monthly spend', () => {
    expect(getMerchantTimelineData(a).series.map((s) => s.label)).toEqual(['Hausverwaltung', 'REWE']);
  });
});

describe('getFixVarTimelineData', () => {
  it('splits every month into fixed (stable recurring) and variable spend', () => {
    const d = getFixVarTimelineData(a);
    expect(d.fixed).toEqual([1200, 1200, 1200]);
    expect(d.variable).toEqual([80, 120, 40]);
  });
});

describe('getOutlierRows', () => {
  it('flags a booking far beyond 2σ and grades it', () => {
    const big = analyze(parseCSV([
      HEADER,
      ...Array.from({ length: 20 }, (_, i) => row(`2024-01-${String(i + 1).padStart(2, '0')}`, 'CARD_TRANSACTION', -20)),
      row('2024-02-01', 'CARD_TRANSACTION', -5000, 'Big One'),
    ].join('\n')));
    const hit = getOutlierRows(big).find((r) => r.name === 'Big One');
    expect(hit).toMatchObject({ level: 'Kritisch' });
  });

  it('is empty when nothing varies', () => {
    const flat = analyze(parseCSV([HEADER, row('2024-01-01', 'CARD_TRANSACTION', -10), row('2024-01-02', 'CARD_TRANSACTION', -10)].join('\n')));
    expect(getOutlierRows(flat)).toEqual([]);
  });
});
