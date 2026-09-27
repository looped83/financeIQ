import { describe, expect, it } from 'vitest';
import { href, resolveRoute } from './routes';

describe('resolveRoute', () => {
  it('resolves an area without sub pages', () => {
    const r = resolveRoute('#/ausgaben');
    expect(r.key).toBe('ausgaben');
    expect(r.sub).toBeUndefined();
    expect(r.usesPeriod).toBe(true);
  });

  it('resolves an area/sub pair and takes usesPeriod from the sub page', () => {
    expect(resolveRoute('#/cashflow/monate').key).toBe('cashflow/monate');
    expect(resolveRoute('#/cashflow/prognose').usesPeriod).toBe(false);
    expect(resolveRoute('#/vergleich/jahre').usesPeriod).toBe(false);
  });

  it('falls back to the first sub page and to the Übersicht', () => {
    expect(resolveRoute('#/cashflow').key).toBe('cashflow/verlauf');
    expect(resolveRoute('#/cashflow/unbekannt').key).toBe('cashflow/verlauf');
    expect(resolveRoute('').key).toBe('uebersicht');
    expect(resolveRoute('#/gibtsnicht').key).toBe('uebersicht');
  });

  it('round-trips through href()', () => {
    expect(resolveRoute(href('vergleich', 'jahre')).key).toBe('vergleich/jahre');
    expect(resolveRoute(href('transaktionen')).key).toBe('transaktionen');
  });
});
