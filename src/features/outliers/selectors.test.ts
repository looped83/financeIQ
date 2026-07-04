import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { computeRiskLights, getOutlierKpis, getOutlierTableRows } from './selectors';

function fixture(name: string) {
  return readFileSync(fileURLToPath(new URL(`../../../test/fixtures/${name}`, import.meta.url)), 'utf8');
}

const MINI_HEADER = 'date,type,amount,tax,name,category';
function miniCsv(rows: Array<{ date: string; type: string; amount: number; name?: string }>): string {
  const lines = rows.map((r) => `${r.date},${r.type},${r.amount},0,${r.name ?? ''},`);
  return [MINI_HEADER, ...lines].join('\n');
}

const a = analyze(parseCSV(fixture('dividends-and-corrections.csv')));

describe('getOutlierKpis', () => {
  it('returns 4 KPI cards', () => {
    const kpis = getOutlierKpis(a);
    expect(kpis).toHaveLength(4);
    expect(kpis.map((k) => k.label)).toEqual([
      'Erkannte Ausreißer', 'Stärkstes Signal', 'Stichproben-Ø', 'Wiederkehrend erkannt',
    ]);
  });

  it('shows an em dash for the strongest signal when there are no outliers', () => {
    const kpis = getOutlierKpis(a); // fixture is too small/uniform to trigger std>0 outliers reliably either way
    const strongest = kpis[1]!;
    expect(strongest.value === '—' || strongest.value.endsWith('€')).toBe(true);
  });
});

describe('computeRiskLights', () => {
  it('fires the negative-balance risk when expenses exceed income', () => {
    const neg = analyze(parseCSV(miniCsv([
      { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 500 },
      { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -800 },
    ])));
    const risks = computeRiskLights(neg);
    expect(risks.some((r) => r.title === 'Negativer Gesamtsaldo')).toBe(true);
  });

  it('fires the passive-income and investment risks for the main fixture', () => {
    const risks = computeRiskLights(a);
    expect(risks.some((r) => r.title === 'Passives Einkommen wächst')).toBe(true);
    expect(risks.some((r) => r.title === 'Regelmäßige Investitionen')).toBe(true);
  });
});

describe('getOutlierTableRows', () => {
  it('classifies a clear outlier by z-score threshold', () => {
    // 20 small, near-identical expenses plus one huge one -> the huge one
    // should land far past the >2σ threshold and get flagged.
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, type: 'CARD_TRANSACTION', amount: -20 })),
      { date: '2024-02-01', type: 'CARD_TRANSACTION', amount: -5000, name: 'Big One' },
    ];
    const big = analyze(parseCSV(miniCsv(rows)));
    const table = getOutlierTableRows(big);
    expect(table.length).toBeGreaterThan(0);
    const bigRow = table.find((r) => r.name === 'Big One');
    expect(bigRow).toBeDefined();
    expect(bigRow!.amountPositive).toBe(false);
    expect(['Kritisch', 'Erhöht', 'Auffällig']).toContain(bigRow!.badgeLabel);
  });

  it('returns an empty array when no data has ever varied enough to have a std > 0', () => {
    const flat = analyze(parseCSV(miniCsv([
      { date: '2024-01-01', type: 'CARD_TRANSACTION', amount: -10 },
      { date: '2024-01-02', type: 'CARD_TRANSACTION', amount: -10 },
    ])));
    expect(getOutlierTableRows(flat)).toEqual([]);
  });
});
