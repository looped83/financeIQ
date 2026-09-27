import { describe, expect, it } from 'vitest';
import { addMonths, buildPresets, inPeriod, periodLabel, periodLabelShort, periodLength, samePeriod, shiftPeriod } from './period';

const KEYS = ['2024-03', '2024-07', '2025-01', '2025-06', '2026-02', '2026-09'];
const B = { first: '2024-03', last: '2026-09' };

describe('addMonths / periodLength / inPeriod', () => {
  it('rolls over year boundaries in both directions', () => {
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(addMonths('2025-02', -3)).toBe('2024-11');
  });

  it('counts months inclusively', () => {
    expect(periodLength({ from: '2025-10', to: '2026-09' })).toBe(12);
  });

  it('treats null as the whole history', () => {
    expect(inPeriod('2020-01', null)).toBe(true);
    expect(inPeriod('2026-01', { from: '2026-01', to: '2026-03' })).toBe(true);
    expect(inPeriod('2026-04', { from: '2026-01', to: '2026-03' })).toBe(false);
  });
});

describe('buildPresets', () => {
  it('anchors recent ranges on the last data month and clamps years to the data', () => {
    const presets = buildPresets(KEYS);
    const byId = Object.fromEntries(presets.map((p) => [p.id, p.period]));
    expect(byId.all).toBeNull();
    expect(byId.last12).toEqual({ from: '2025-10', to: '2026-09' });
    expect(byId.last1).toEqual({ from: '2026-09', to: '2026-09' });
    expect(byId.y2026).toEqual({ from: '2026-01', to: '2026-09' });
    expect(byId.y2024).toEqual({ from: '2024-03', to: '2024-12' });
    expect(presets.map((p) => p.id).slice(-3)).toEqual(['y2026', 'y2025', 'y2024']);
  });

  it('offers only the whole history without data', () => {
    expect(buildPresets([])).toEqual([{ id: 'all', label: 'Gesamter Zeitraum', period: null }]);
  });
});

describe('shiftPeriod', () => {
  it('steps a (clamped) calendar year by whole years', () => {
    expect(shiftPeriod({ from: '2026-01', to: '2026-09' }, -1, B)).toEqual({ from: '2025-01', to: '2025-12' });
    expect(shiftPeriod({ from: '2025-01', to: '2025-12' }, -1, B)).toEqual({ from: '2024-03', to: '2024-12' });
    expect(shiftPeriod({ from: '2024-03', to: '2024-12' }, -1, B)).toBeNull();
  });

  it('steps other ranges by their own length and clamps at the edges', () => {
    expect(shiftPeriod({ from: '2026-07', to: '2026-09' }, -1, B)).toEqual({ from: '2026-04', to: '2026-06' });
    expect(shiftPeriod({ from: '2024-05', to: '2024-07' }, -1, B)).toEqual({ from: '2024-03', to: '2024-04' });
    expect(shiftPeriod({ from: '2026-07', to: '2026-09' }, 1, B)).toBeNull();
  });

  it('cannot shift the whole history', () => {
    expect(shiftPeriod(null, -1, B)).toBeNull();
  });
});

describe('periodLabel / samePeriod', () => {
  it('formats single months, same-year and cross-year ranges', () => {
    expect(periodLabel(null)).toBe('Gesamter Zeitraum');
    expect(periodLabel({ from: '2026-09', to: '2026-09' })).toBe('Sep 2026');
    expect(periodLabel({ from: '2026-01', to: '2026-09' })).toBe('Jan – Sep 2026');
    expect(periodLabel({ from: '2025-10', to: '2026-09' })).toBe('Okt 2025 – Sep 2026');
  });

  it('has a compact form for narrow screens', () => {
    expect(periodLabelShort({ from: '2024-01', to: '2026-09' })).toBe('Jan 24 – Sep 26');
    expect(periodLabelShort({ from: '2026-09', to: '2026-09' })).toBe('Sep 26');
  });

  it('compares by value', () => {
    expect(samePeriod({ from: '2026-01', to: '2026-02' }, { from: '2026-01', to: '2026-02' })).toBe(true);
    expect(samePeriod(null, { from: '2026-01', to: '2026-02' })).toBe(false);
    expect(samePeriod(null, null)).toBe(true);
  });
});
