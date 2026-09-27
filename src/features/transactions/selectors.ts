import { monthName, typeLabel } from '../../domain/format';
import { memoize } from '../../domain/memo';
import type { EnrichedRow } from '../../domain/types';
import type { TransactionFilters, TransactionKind, TransactionSort } from '../../state/appState';

/** Distinct display categories (typeLabel'd) present in the data, alphabetical. */
export const getAvailableCategories = memoize((rows: EnrichedRow[]): string[] =>
  [...new Set(rows.map((r) => typeLabel(r._type)).filter(Boolean))].sort());

/** Lower-cased search text of a row, built once per row instead of on every keystroke. */
const haystack = memoize((r: EnrichedRow): string =>
  [r._name, r._desc, r._type, typeLabel(r._type), r._cat, r._asset].join(' ').toLowerCase());

/** In/out mean real cash movements; trades are their own kind, own-account transfers only show under "all". */
export function matchesKind(r: EnrichedRow, kind: TransactionKind): boolean {
  const trade = r._isBuy || r._isSell;
  switch (kind) {
    case 'all': return true;
    case 'in': return !trade && !r._isInternal && r._amt > 0;
    case 'out': return !trade && !r._isInternal && r._amt < 0;
    case 'invest': return trade;
    case 'div': return r._isDiv;
  }
}

export function filterTransactions(rows: EnrichedRow[], filters: TransactionFilters): EnrichedRow[] {
  const search = filters.search.toLowerCase().trim();

  return rows.filter((r) => {
    if (!matchesKind(r, filters.kind)) return false;
    if (filters.category && typeLabel(r._type) !== filters.category) return false;
    if (search && !haystack(r).includes(search)) return false;
    return true;
  });
}

export function sortTransactions(rows: EnrichedRow[], sort: TransactionSort): EnrichedRow[] {
  const sorted = [...rows];
  switch (sort) {
    case 'date-desc':
      return sorted.sort((a, b) => b._date.getTime() - a._date.getTime());
    case 'date-asc':
      return sorted.sort((a, b) => a._date.getTime() - b._date.getTime());
    case 'amount-desc':
      return sorted.sort((a, b) => Math.abs(b._amt) - Math.abs(a._amt));
    case 'amount-asc':
      return sorted.sort((a, b) => Math.abs(a._amt) - Math.abs(b._amt));
  }
}

/** Everything that came in vs. went out (trades included) — the list's summary line. */
export function sumInOut(rows: EnrichedRow[]): { inflow: number; outflow: number } {
  let inflow = 0, outflow = 0;
  for (const r of rows) {
    if (r._amt > 0) inflow += r._amt;
    else outflow += r._amt;
  }
  return { inflow, outflow };
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Dates are parsed as UTC midnight, so the UTC parts are the booking's calendar day. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "Fr, 26. Sep 2026" */
export function dayLabel(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${monthName(String(d.getUTCMonth() + 1))} ${d.getUTCFullYear()}`;
}

export interface DayGroup {
  key: string;
  label: string;
  /** Sum over ALL `filtered` rows of that day — a day split across pages still shows its full total. */
  sum: number;
  rows: EnrichedRow[];
}

/** Groups a (date-sorted) page into consecutive day blocks. */
export function groupByDay(pageRows: EnrichedRow[], filtered: EnrichedRow[]): DayGroup[] {
  const sums = new Map<string, number>();
  for (const r of filtered) {
    const k = dayKey(r._date);
    sums.set(k, (sums.get(k) ?? 0) + r._amt);
  }
  const groups: DayGroup[] = [];
  for (const r of pageRows) {
    const k = dayKey(r._date);
    const last = groups[groups.length - 1];
    if (last?.key === k) last.rows.push(r);
    else groups.push({ key: k, label: dayLabel(r._date), sum: sums.get(k) ?? 0, rows: [r] });
  }
  return groups;
}

export interface PageResult<T> {
  pageRows: T[];
  totalPages: number;
}

export function paginate<T>(rows: T[], page: number, perPage: number): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const start = page * perPage;
  return { pageRows: rows.slice(start, start + perPage), totalPages };
}

export type PaginationItem =
  | { type: 'prev'; page: number }
  | { type: 'next'; page: number }
  | { type: 'page'; page: number; active: boolean }
  | { type: 'ellipsis' };

/**
 * Builds the "‹ 1 2 … 7 8 9 … 14 15 ›" button/ellipsis sequence for a
 * pagination bar: always show first/last page, the current page ± `range`,
 * and collapse everything else into a single ellipsis on each side.
 */
export function computePaginationItems(page: number, totalPages: number, range = 2): PaginationItem[] {
  if (totalPages <= 1) return [];
  const items: PaginationItem[] = [];
  if (page > 0) items.push({ type: 'prev', page: page - 1 });
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= range) {
      items.push({ type: 'page', page: i, active: i === page });
    } else if (i === page - range - 1 || i === page + range + 1) {
      items.push({ type: 'ellipsis' });
    }
  }
  if (page < totalPages - 1) items.push({ type: 'next', page: page + 1 });
  return items;
}
