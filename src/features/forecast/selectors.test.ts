import { describe, expect, it } from 'vitest';
import { parseCSV } from '../../domain/csv';
import { analyze } from '../../domain/analyze';
import { computeForecast } from './selectors';

const MINI_HEADER = 'date,type,amount,tax,name,category';
function miniCsv(rows: Array<{ date: string; type: string; amount: number }>): string {
  const lines = rows.map((r) => `${r.date},${r.type},${r.amount},0,,`);
  return [MINI_HEADER, ...lines].join('\n');
}

// A perfectly linear net-cashflow trend: 100, 200, 300, 400 per month.
const a = analyze(parseCSV(miniCsv([
  { date: '2024-01-05', type: 'TRANSFER_INBOUND', amount: 1100 },
  { date: '2024-01-10', type: 'CARD_TRANSACTION', amount: -1000 },
  { date: '2024-02-05', type: 'TRANSFER_INBOUND', amount: 1200 },
  { date: '2024-02-10', type: 'CARD_TRANSACTION', amount: -1000 },
  { date: '2024-03-05', type: 'TRANSFER_INBOUND', amount: 1300 },
  { date: '2024-03-10', type: 'CARD_TRANSACTION', amount: -1000 },
  { date: '2024-04-05', type: 'TRANSFER_INBOUND', amount: 1400 },
  { date: '2024-04-10', type: 'CARD_TRANSACTION', amount: -1000 },
])));

describe('computeForecast', () => {
  it('produces history + forecast labels covering the full horizon', () => {
    const result = computeForecast(a, 3);
    expect(result.chart.labels).toHaveLength(4 + 3); // 4 historical months + 3 forecast months
    expect(result.chart.historical.filter((v) => v !== null)).toHaveLength(4);
    expect(result.chart.forecast.filter((v) => v !== null)).toHaveLength(4); // last actual + 3 forecast points
  });

  it('detects a positive slope for a rising trend', () => {
    const result = computeForecast(a, 3);
    const trendKpi = result.kpis[0]!;
    expect(trendKpi.cls).toBe('income');
    expect(trendKpi.value).toBe('100,00 €'); // perfectly linear net: +100/month
  });

  it('projects the cumulative balance forward using the linear trend', () => {
    const result = computeForecast(a, 3);
    // cumulative net after 4 months = 100+200+300+400 = 1000; net-cashflow forecast +100/month slope
    // starting from month index 3 (0-based) -> +400, +500, +600 -> 1000+400=1400... see selector for exact formula
    const projected = result.chart.forecast.filter((v): v is number => v !== null);
    expect(projected[0]).toBe(1000); // last actual carried over as the anchor point
    expect(projected[projected.length - 1]).toBeGreaterThan(1000);
  });

  it('a perfectly linear trend has zero residual std, so CI bands collapse onto the forecast line', () => {
    const result = computeForecast(a, 3);
    expect(result.chart.ciUpper).toEqual(result.chart.forecast);
    expect(result.chart.ciLower).toEqual(result.chart.forecast);
  });

  it('base-case scenario matches the KPI-projected value', () => {
    const result = computeForecast(a, 3);
    const baseScenario = result.scenarios.find((s) => s.title === 'Basisszenario (Lineartrend)')!;
    const projValueStr = result.kpis[1]!.sub.replace('Prognosewert: ', '');
    expect(baseScenario.desc).toContain(projValueStr);
  });

  it('returns exactly 3 scenarios in a fixed order', () => {
    const result = computeForecast(a, 6);
    expect(result.scenarios.map((s) => s.title)).toEqual([
      'Optimistisches Szenario', 'Basisszenario (Lineartrend)', 'Pessimistisches Szenario',
    ]);
  });
});
