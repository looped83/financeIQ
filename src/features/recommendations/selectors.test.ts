import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { computeRecommendations } from './selectors';

const HEADER = 'date,type,amount,fee,tax,name,category,asset_class';
function row(
  date: string, type: string, amount: string,
  opts: { fee?: string; tax?: string; name?: string; category?: string; asset?: string } = {},
): string {
  return `${date},${type},${amount},${opts.fee ?? '0'},${opts.tax ?? '0'},${opts.name ?? ''},${opts.category ?? ''},${opts.asset ?? ''}`;
}

const MONTHS = ['01', '02', '03', '04'];
const richRows: string[] = [HEADER];
for (const mn of MONTHS) {
  const d = `2024-${mn}-05`;
  richRows.push(row(d, 'TRANSFER_INBOUND', '4000'));
  richRows.push(row(d, 'BUY', '-1000', { fee: '5' }));
  richRows.push(row(d, 'DIVIDEND', '150', { tax: '-30', name: 'AssetA' }));
  richRows.push(row(d, 'DIVIDEND', '30', { tax: '-6', name: 'AssetB' }));
  richRows.push(row(d, 'CARD_TRANSACTION', '-400', { name: 'Supermarkt XY' }));
  richRows.push(row(d, 'CARD_TRANSACTION', '-20', { name: 'Streaming Service' }));
  richRows.push(row(d, 'TRANSFER_OUTBOUND', '-200', { name: 'Miete' }));
}
richRows.push(row('2024-01-05', 'CARD_TRANSACTION', '-600', { name: 'Elektronik Laden' }));
const rich = analyze(parseCSV(richRows.join('\n')));

describe('computeRecommendations — rich fixture (positive cashflow, strong savings/investing)', () => {
  const recs = computeRecommendations(rich);

  it('flags an excellent savings rate rather than a low one', () => {
    expect(recs.some((r) => r.category === 'Sparen' && r.title.includes('Exzellente Sparquote'))).toBe(true);
    expect(recs.some((r) => r.title.includes('unter 10%'))).toBe(false);
  });

  it('flags a good investment rate', () => {
    expect(recs.some((r) => r.category === 'Investieren' && r.title.includes('Gute Investitionsrate'))).toBe(true);
  });

  it('flags dividend growth and dividend concentration risk (AssetA > 30% of dividends)', () => {
    expect(recs.some((r) => r.title === 'Dividenden-Portfolio wächst')).toBe(true);
    expect(recs.some((r) => r.title === 'Dividenden-Klumpenrisiko' && r.desc.includes('AssetA'))).toBe(true);
  });

  it('flags fee optimization since the fee ratio exceeds 0.3% of invested volume', () => {
    expect(recs.some((r) => r.category === 'Kosten' && r.title.startsWith('Gebühren optimieren'))).toBe(true);
  });

  it('does not show tax-related recommendations (dividends arrive net)', () => {
    expect(recs.some((r) => r.title === 'Freistellungsauftrag prüfen')).toBe(false);
  });

  it('flags the one-time >500€ expense (Elektronik Laden)', () => {
    expect(recs.some((r) => r.title === '1 Großausgaben >500€' && r.desc.includes('Elektronik Laden'))).toBe(true);
  });

  it('flags 3 recurring subscriptions and that they exceed 20% of monthly expenses', () => {
    expect(recs.some((r) => r.title.includes('3 wiederkehrende Ausgaben'))).toBe(true);
    expect(recs.some((r) => r.title === 'Wiederkehrende Ausgaben über 20%')).toBe(true);
  });

  it('flags low portfolio diversification (only 2 dividend positions)', () => {
    expect(recs.some((r) => r.title.includes('Nur 2 Dividendenpositionen'))).toBe(true);
    expect(recs.some((r) => r.title === 'Gute Portfolio-Diversifikation')).toBe(false);
  });

  it('flags high card-spending ratio (> 60% of expenses)', () => {
    expect(recs.some((r) => r.category === 'Verhalten' && r.title.includes('Kartenzahlungen'))).toBe(true);
  });

  it('flags a reachable emergency-fund target from the positive net cashflow', () => {
    expect(recs.some((r) => r.title.includes('Notfallrücklage'))).toBe(true);
  });

  it('flags merchant concentration (top-3 card merchants > 30% of expenses)', () => {
    expect(recs.some((r) => r.title.startsWith('Top-3-Händler'))).toBe(true);
  });

  it('sorts recommendations ascending by priority', () => {
    for (let i = 1; i < recs.length; i++) expect(recs[i]!.priority).toBeGreaterThanOrEqual(recs[i - 1]!.priority);
  });
});

describe('computeRecommendations — negative cashflow', () => {
  const negRows = [
    HEADER,
    row('2024-01-05', 'TRANSFER_INBOUND', '1000'),
    row('2024-01-10', 'CARD_TRANSACTION', '-1500', { name: 'Shop' }),
  ].join('\n');
  const neg = analyze(parseCSV(negRows));

  it('flags a red, top-priority negative-cashflow warning', () => {
    const recs = computeRecommendations(neg);
    const cashflowRec = recs.find((r) => r.category === 'Cashflow');
    expect(cashflowRec?.level).toBe('red');
    expect(cashflowRec?.title).toBe('Negativer Cashflow — sofort handeln');
    expect(recs[0]).toBe(cashflowRec);
  });
});

describe('computeRecommendations — spending/income trends', () => {
  it('flags 3 months of strictly rising expenses', () => {
    const rows = [
      HEADER,
      row('2024-01-05', 'TRANSFER_INBOUND', '1000'),
      row('2024-02-05', 'TRANSFER_INBOUND', '1000'),
      row('2024-03-05', 'TRANSFER_INBOUND', '1000'),
      row('2024-01-10', 'CARD_TRANSACTION', '-100', { name: 'Shop' }),
      row('2024-02-10', 'CARD_TRANSACTION', '-200', { name: 'Shop' }),
      row('2024-03-10', 'CARD_TRANSACTION', '-300', { name: 'Shop' }),
    ].join('\n');
    const recs = computeRecommendations(analyze(parseCSV(rows)));
    expect(recs.some((r) => r.title === 'Ausgaben 3 Monate steigend')).toBe(true);
  });

  it('flags 3 months of strictly rising income', () => {
    const rows = [
      HEADER,
      row('2024-01-05', 'TRANSFER_INBOUND', '1000'),
      row('2024-02-05', 'TRANSFER_INBOUND', '1500'),
      row('2024-03-05', 'TRANSFER_INBOUND', '2000'),
      row('2024-01-10', 'CARD_TRANSACTION', '-100', { name: 'Shop' }),
      row('2024-02-10', 'CARD_TRANSACTION', '-100', { name: 'Shop' }),
      row('2024-03-10', 'CARD_TRANSACTION', '-100', { name: 'Shop' }),
    ].join('\n');
    const recs = computeRecommendations(analyze(parseCSV(rows)));
    expect(recs.some((r) => r.title === 'Einnahmen 3 Monate steigend')).toBe(true);
  });
});

describe('computeRecommendations — weekend spending', () => {
  it('flags disproportionately high weekend daily spending', () => {
    const rows = [
      HEADER,
      row('2024-01-06', 'CARD_TRANSACTION', '-500', { name: 'Club' }), // Saturday
      row('2024-01-08', 'CARD_TRANSACTION', '-10', { name: 'Kiosk' }), // Monday
    ].join('\n');
    const recs = computeRecommendations(analyze(parseCSV(rows)));
    expect(recs.some((r) => r.category === 'Verhalten' && r.title.startsWith('Wochenende'))).toBe(true);
  });
});
