import { describe, expect, it } from 'vitest';
import { parseLine, parseCSV, findCol } from './csv';

describe('parseLine', () => {
  it('splits on the given delimiter', () => {
    expect(parseLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
  });
  it('keeps delimiters inside quoted fields literal', () => {
    expect(parseLine('a,"b, and c",d', ',')).toEqual(['a', 'b, and c', 'd']);
  });
  it('unescapes doubled quotes inside a quoted field', () => {
    expect(parseLine('a,"say ""hi""",c', ',')).toEqual(['a', 'say "hi"', 'c']);
  });
});

describe('parseCSV', () => {
  it('auto-detects the delimiter with the most occurrences in the header', () => {
    const rows = parseCSV('a;b;c\n1;2;3\n');
    expect(rows).toEqual([{ a: '1', b: '2', c: '3' }]);
  });
  it('normalizes headers to lowercase snake_case', () => {
    const rows = parseCSV('Buchungs Datum,Betrag\n15.03.2024,100\n');
    expect(Object.keys(rows[0]!)).toEqual(['buchungs_datum', 'betrag']);
  });
  it('returns an empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });
});

describe('findCol', () => {
  const rows = [{ buchungsdatum: '15.03.2024', betrag: '100' }];
  it('matches an exact (case-insensitive) header first', () => {
    expect(findCol(rows, ['date', 'datum', 'buchungsdatum'])).toBe('buchungsdatum');
  });
  it('falls back to a substring match', () => {
    expect(findCol(rows, ['amount', 'betr'])).toBe('betrag');
  });
  it('returns null when nothing matches', () => {
    expect(findCol(rows, ['nonexistent'])).toBeNull();
  });
  it('returns null for an empty row set', () => {
    expect(findCol([], ['date'])).toBeNull();
  });
});
