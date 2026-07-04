import type { RawRow } from './types';

/** Splits a single CSV line into fields, honoring double-quoted fields with escaped `""`. */
export function parseLine(line: string, delimiter: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      res.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  res.push(cur);
  return res;
}

/**
 * Parses CSV text into rows of normalized-header -> trimmed-string maps.
 * Delimiter is auto-detected from `,`, `;`, `\t` by counting occurrences in the header line.
 */
export function parseCSV(text: string): RawRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const delimiters = [',', ';', '\t'];
  let delim = ',';
  let maxCount = 0;
  for (const d of delimiters) {
    const count = (lines[0]!.match(new RegExp('\\' + d, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delim = d;
    }
  }

  const headers = parseLine(lines[0]!, delim).map((h) =>
    h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
  );

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = parseLine(line, delim);
      const row: RawRow = {};
      headers.forEach((h, i) => {
        row[h] = (vals[i] || '').trim();
      });
      return row;
    });
}

/**
 * Finds the actual column key matching one of `candidates`, trying exact
 * (case-insensitive) matches first, then substring matches. Used to support
 * differing bank/broker export column names (e.g. "amount" vs "Betrag").
 */
export function findCol(rows: RawRow[], candidates: string[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]!);
  for (const c of candidates) {
    const m = keys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (m) return m;
  }
  for (const c of candidates) {
    const m = keys.find((k) => k.toLowerCase().includes(c.toLowerCase()));
    if (m) return m;
  }
  return null;
}
