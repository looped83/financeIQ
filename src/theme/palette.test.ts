import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLORS, foldToSeries, SERIES, seriesColor } from './palette';

const CSS_NAME: Record<keyof typeof COLORS, string> = {
  text: '--text',
  textSecondary: '--text-2',
  textMuted: '--text-3',
  surface: '--surface',
  raised: '--raised',
  line: '--line',
  lineStrong: '--line-strong',
  axis: '--axis',
  accent: '--accent',
  income: '--income',
  expense: '--expense',
  invest: '--invest',
  dividend: '--dividend',
  warning: '--warning',
  other: '--other',
};

describe('palette ↔ tokens.css', () => {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

  it.each(Object.entries(CSS_NAME))('%s matches %s in tokens.css', (key, cssName) => {
    const m = css.match(new RegExp(`${cssName}:\\s*(#[0-9a-f]{6})\\s*;`, 'i'));
    expect(m?.[1]?.toLowerCase()).toBe(COLORS[key as keyof typeof COLORS]);
  });
});

describe('foldToSeries', () => {
  it('keeps up to SERIES.length entries as-is, sorted descending', () => {
    expect(foldToSeries([['a', 1], ['b', 3], ['c', 2]])).toEqual([['b', 3], ['c', 2], ['a', 1]]);
  });

  it('folds everything past the last series slot into one "Sonstige" bucket', () => {
    const entries = Array.from({ length: 9 }, (_, i): [string, number] => [`k${i}`, 9 - i]);
    const folded = foldToSeries(entries);
    expect(folded).toHaveLength(SERIES.length + 1);
    expect(folded[SERIES.length]).toEqual(['Sonstige', 3 + 2 + 1]);
  });

  it('colors the trailing bucket gray', () => {
    expect(seriesColor(0)).toBe(SERIES[0]);
    expect(seriesColor(SERIES.length)).toBe(COLORS.other);
  });
});
