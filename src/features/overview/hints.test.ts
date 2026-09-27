import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { computeHints } from './hints';

const HEADER = 'date,type,amount,fee,tax,name,category,asset_class';
function row(
  date: string, type: string, amount: string,
  opts: { fee?: string; tax?: string; name?: string; asset?: string } = {},
): string {
  return `${date},${type},${amount},${opts.fee ?? '0'},${opts.tax ?? '0'},${opts.name ?? ''},,${opts.asset ?? ''}`;
}
const hintsOf = (rows: string[]) => computeHints(analyze(parseCSV([HEADER, ...rows].join('\n'))));
const titles = (rows: string[]) => hintsOf(rows).map((h) => h.title);

describe('computeHints — rich fixture (positive cashflow, strong savings/investing)', () => {
  const rows: string[] = [];
  for (const mn of ['01', '02', '03', '04']) {
    const d = `2024-${mn}-05`;
    rows.push(row(d, 'TRANSFER_INBOUND', '4000'));
    rows.push(row(d, 'BUY', '-1000', { fee: '5' }));
    rows.push(row(d, 'DIVIDEND', '150', { tax: '-30', name: 'AssetA' }));
    rows.push(row(d, 'DIVIDEND', '30', { tax: '-6', name: 'AssetB' }));
    rows.push(row(d, 'CARD_TRANSACTION', '-400', { name: 'Supermarkt XY' }));
    rows.push(row(d, 'CARD_TRANSACTION', '-20', { name: 'Streaming Service' }));
    rows.push(row(d, 'TRANSFER_OUTBOUND', '-200', { name: 'Miete' }));
  }
  rows.push(row('2024-01-05', 'CARD_TRANSACTION', '-600', { name: 'Elektronik Laden' }));
  const hints = hintsOf(rows);
  const has = (pred: (t: string) => boolean) => hints.some((h) => pred(h.title));

  it('names each topic once', () => {
    const all = hints.map((h) => h.title);
    expect(new Set(all).size).toBe(all.length);
    // one savings-rate level; a trend of the rate is a separate topic
    expect(all.filter((t) => /Sparquote: |Sparquote .* unter Ziel/.test(t))).toHaveLength(1);
  });

  it('praises the savings and investment rates', () => {
    expect(has((t) => t.startsWith('Exzellente Sparquote'))).toBe(true);
    expect(has((t) => t.startsWith('Gute Investitionsrate'))).toBe(true);
  });

  it('flags dividend concentration and low diversification', () => {
    expect(hints.find((h) => h.title === 'Dividenden-Klumpenrisiko')?.desc).toContain('AssetA');
    expect(has((t) => t === 'Nur 2 Dividendenpositionen')).toBe(true);
  });

  it('flags fees above the target share of buys', () => {
    expect(has((t) => t.startsWith('Gebühren '))).toBe(true);
  });

  it('flags the one-time >500 € expense', () => {
    expect(hints.find((h) => h.title === '1 Ausgaben über 500 €')?.desc).toContain('Elektronik Laden');
  });

  it('reports the fixed costs as a high share of spending', () => {
    const fixed = hints.find((h) => h.title.startsWith('Fixkosten'));
    expect(fixed?.color).toBe('yellow');
    expect(fixed?.desc).toContain('3 Posten');
  });

  it('flags card-heavy spending and merchant concentration', () => {
    expect(has((t) => t.includes('per Karte'))).toBe(true);
    expect(has((t) => t.startsWith('Top-3-Empfänger'))).toBe(true);
  });

  it('sorts by urgency: warnings before information before praise', () => {
    const order = { red: 0, yellow: 1, blue: 2, green: 3 };
    for (let i = 1; i < hints.length; i++) expect(order[hints[i]!.color]).toBeGreaterThanOrEqual(order[hints[i - 1]!.color]);
  });
});

describe('computeHints — problems', () => {
  it('puts a negative cashflow first, in red', () => {
    const hints = hintsOf([row('2024-01-05', 'TRANSFER_INBOUND', '1000'), row('2024-01-10', 'CARD_TRANSACTION', '-1500', { name: 'Shop' })]);
    expect(hints[0]).toMatchObject({ color: 'red', title: 'Negativer Cashflow' });
  });

  it('flags two or more negative months', () => {
    expect(titles([
      row('2024-01-05', 'TRANSFER_INBOUND', '500'), row('2024-01-10', 'CARD_TRANSACTION', '-800'),
      row('2024-02-05', 'TRANSFER_INBOUND', '3000'), row('2024-02-10', 'CARD_TRANSACTION', '-500'),
      row('2024-03-05', 'TRANSFER_INBOUND', '400'), row('2024-03-10', 'CARD_TRANSACTION', '-900'),
    ])).toContain('2 negative Monate');
  });
});

describe('computeHints — trends', () => {
  const months = (inc: number[], exp: number[]) => inc.flatMap((v, i) => [
    row(`2024-0${i + 1}-05`, 'TRANSFER_INBOUND', String(v)),
    row(`2024-0${i + 1}-10`, 'CARD_TRANSACTION', String(-exp[i]!), { name: 'Shop' }),
  ]);

  it('reports a three-month expense streak instead of the regression trend', () => {
    const t = titles(months([3000, 3000, 3000, 3000], [500, 800, 1000, 1500]));
    expect(t).toContain('Ausgaben 3 Monate steigend');
    expect(t).not.toContain('Ausgaben steigend');
  });

  it('reports a three-month income streak', () => {
    expect(titles(months([1000, 1500, 2000], [100, 100, 100]))).toContain('Einnahmen 3 Monate steigend');
  });

  it('flags disproportionately high weekend spending', () => {
    expect(titles([
      row('2024-01-06', 'CARD_TRANSACTION', '-500', { name: 'Club' }), // Saturday
      row('2024-01-08', 'CARD_TRANSACTION', '-10', { name: 'Kiosk' }), // Monday
    ]).some((t) => t.startsWith('Wochenende'))).toBe(true);
  });
});
