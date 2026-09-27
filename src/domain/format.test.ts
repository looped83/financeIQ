import { describe, expect, it } from 'vitest';
import { fmt, fmtN, fmtP, fmtPts, fmtSigned, fmtSignedP, fmtD, mLabel, monthName, typeLabel } from './format';

describe('fmt', () => {
  it('formats with German thousands/decimal separators and a euro sign', () => {
    expect(fmt(1234.5)).toBe('1.234,50 €');
  });
  it('returns an em dash for NaN', () => {
    expect(fmt(NaN)).toBe('—');
  });
  it('respects the decimals argument', () => {
    expect(fmt(1234.5, 0)).toBe('1.235 €');
  });
});

describe('fmtN', () => {
  it('rounds and groups thousands without decimals', () => {
    expect(fmtN(1234.6)).toBe('1.235');
  });
});

describe('fmtP / fmtSignedP / fmtSigned / fmtPts', () => {
  it('fmtP never adds a sign', () => {
    expect(fmtP(12.34)).toBe('12,3 %');
    expect(fmtP(-5)).toBe('-5,0 %');
  });
  it('fmtSignedP adds a leading + for non-negative values', () => {
    expect(fmtSignedP(12.34)).toBe('+12,3 %');
    expect(fmtSignedP(-5)).toBe('-5,0 %');
    expect(fmtSignedP(0)).toBe('+0,0 %');
  });

  it('fmtSigned and fmtPts carry the sign the same way', () => {
    expect(fmtSigned(1234.5)).toBe('+1.234,50 €');
    expect(fmtSigned(-56, 0)).toBe('-56 €');
    expect(fmtPts(1.25)).toBe('+1,3 Pp.');
    expect(fmtPts(-2)).toBe('-2,0 Pp.');
    expect(fmtPts(2, false)).toBe('2,0 Pp.');
  });
});

describe('fmtD', () => {
  it('formats a date as dd.mm.yyyy', () => {
    expect(fmtD(new Date('2024-03-15'))).toBe('15.03.2024');
  });
  it('returns an em dash for null', () => {
    expect(fmtD(null)).toBe('—');
  });
});

describe('mLabel / monthName', () => {
  it('mLabel formats a YYYY-MM key as a short German label', () => {
    // Uses Intl's "short" month style (not the hardcoded MONTH_NAMES list
    // below, which backs monthName() instead) — German CLDR spells this "März".
    expect(mLabel('2024-03')).toBe('Mär 24');
  });
  it('monthName maps a two-digit month to its German abbreviation', () => {
    expect(monthName('01')).toBe('Jan');
    expect(monthName('12')).toBe('Dez');
  });
});

describe('typeLabel', () => {
  it('maps known transaction types to German labels', () => {
    expect(typeLabel('DIVIDEND')).toBe('Dividenden');
    expect(typeLabel('TAX_OPTIMIZATION')).toBe('Steuerkorrektur');
  });
  it('falls back to the raw type for unknown values', () => {
    expect(typeLabel('SOME_FUTURE_TYPE')).toBe('SOME_FUTURE_TYPE');
  });
});
